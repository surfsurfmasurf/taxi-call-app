const { getRedisClient } = require('../config/redis');
const { Driver, User } = require('../models');

const MATCH_CONFIG = {
  INITIAL_RADIUS_KM: 3,
  MAX_RADIUS_KM: 10,
  RADIUS_INCREMENT_KM: 2,
  REQUEST_TIMEOUT_SEC: 15,
  MAX_RETRIES: 5,
  WEIGHT_DISTANCE: 0.4,
  WEIGHT_RATING: 0.3,
  WEIGHT_ACCEPTANCE: 0.3,
};

/**
 * 주변 가용 기사 검색 (Redis GEO)
 */
async function findNearbyDrivers(lat, lng, radiusKm = MATCH_CONFIG.INITIAL_RADIUS_KM) {
  const redis = await getRedisClient();

  // Redis GEOSEARCH로 반경 내 기사 검색
  const results = await redis.sendCommand([
    'GEOSEARCH',
    'drivers:active',
    'FROMLONLAT', lng.toString(), lat.toString(),
    'BYRADIUS', (radiusKm * 1000).toString(), 'm',
    'WITHCOORD',
    'WITHDIST',
    'ASC',
    'COUNT', '20',
  ]);

  if (!results || results.length === 0) return [];

  // 결과 파싱
  const drivers = [];
  for (let i = 0; i < results.length; i += 3) {
    const driverId = results[i];
    const distance = parseFloat(results[i + 1]);
    const [driverLng, driverLat] = results[i + 2];

    drivers.push({
      driver_id: driverId,
      distance_m: distance,
      lat: parseFloat(driverLat),
      lng: parseFloat(driverLng),
    });
  }

  return drivers;
}

/**
 * 기사 위치 업데이트 (Redis GEO)
 */
async function updateDriverLocation(driverId, lat, lng) {
  const redis = await getRedisClient();
  await redis.sendCommand([
    'GEOADD', 'drivers:active', lng.toString(), lat.toString(), driverId,
  ]);
}

/**
 * 기사 위치 제거 (오프라인 시)
 */
async function removeDriverLocation(driverId) {
  const redis = await getRedisClient();
  await redis.sendCommand(['ZREM', 'drivers:active', driverId]);
}

/**
 * 최적 기사 선정 (점수 기반)
 */
async function selectBestDriver(nearbyDrivers) {
  if (nearbyDrivers.length === 0) return null;

  const driverIds = nearbyDrivers.map((d) => d.driver_id);

  // DB에서 기사 상세정보 조회
  const dbDrivers = await Driver.findAll({
    where: { id: driverIds, status: 'AVAILABLE', is_approved: true },
    include: [{ model: User, as: 'user', attributes: ['rating'] }],
  });

  if (dbDrivers.length === 0) return null;

  // 점수 산정
  const maxDistance = Math.max(...nearbyDrivers.map((d) => d.distance_m));
  const scored = dbDrivers.map((driver) => {
    const nearby = nearbyDrivers.find((n) => n.driver_id === driver.id);
    const distanceScore = 1 - (nearby.distance_m / (maxDistance || 1));
    const ratingScore = (driver.user?.rating || 3) / 5;
    const acceptanceScore = (driver.acceptance_rate || 50) / 100;

    const totalScore =
      distanceScore * MATCH_CONFIG.WEIGHT_DISTANCE +
      ratingScore * MATCH_CONFIG.WEIGHT_RATING +
      acceptanceScore * MATCH_CONFIG.WEIGHT_ACCEPTANCE;

    return { driver, nearby, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 매칭 프로세스 실행
 */
async function executeMatching(rideId, pickupLat, pickupLng, io) {
  let radius = MATCH_CONFIG.INITIAL_RADIUS_KM;
  let attempts = 0;

  while (radius <= MATCH_CONFIG.MAX_RADIUS_KM && attempts < MATCH_CONFIG.MAX_RETRIES) {
    const nearbyDrivers = await findNearbyDrivers(pickupLat, pickupLng, radius);
    const rankedDrivers = await selectBestDriver(nearbyDrivers);

    if (rankedDrivers && rankedDrivers.length > 0) {
      // 최고 점수 기사에게 요청 전송
      for (const { driver, nearby } of rankedDrivers) {
        const accepted = await sendMatchRequest(rideId, driver.id, io);
        if (accepted) {
          return { success: true, driver_id: driver.id };
        }
        attempts++;
        if (attempts >= MATCH_CONFIG.MAX_RETRIES) break;
      }
    }

    // 반경 확대
    radius += MATCH_CONFIG.RADIUS_INCREMENT_KM;
  }

  return { success: false, reason: 'NO_DRIVER_AVAILABLE' };
}

/**
 * 기사에게 매칭 요청 전송
 */
function sendMatchRequest(rideId, driverId, io) {
  return new Promise((resolve) => {
    // Socket.IO로 기사에게 요청 전송
    io.to(`driver:${driverId}`).emit('ride:request', { ride_id: rideId });

    // 타임아웃 설정
    const timeout = setTimeout(() => {
      resolve(false);
    }, MATCH_CONFIG.REQUEST_TIMEOUT_SEC * 1000);

    // 응답 리스너 (실제로는 소켓 이벤트로 처리)
    const responseKey = `match:response:${rideId}:${driverId}`;
    const checkInterval = setInterval(async () => {
      const redis = await getRedisClient();
      const response = await redis.get(responseKey);
      if (response) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        await redis.del(responseKey);
        resolve(response === 'ACCEPTED');
      }
    }, 1000);

    // 타임아웃 시 인터벌도 정리
    setTimeout(() => clearInterval(checkInterval), (MATCH_CONFIG.REQUEST_TIMEOUT_SEC + 1) * 1000);
  });
}

module.exports = {
  findNearbyDrivers,
  updateDriverLocation,
  removeDriverLocation,
  selectBestDriver,
  executeMatching,
  MATCH_CONFIG,
};
