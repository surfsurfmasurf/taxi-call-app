/**
 * 택시 요금 계산 서비스
 *
 * 기본요금: 4,800원 (처음 1.6km)
 * 거리요금: 131m당 100원
 * 시간요금: 시속 15km 이하 시 30초당 100원
 * 심야할증: 22:00~04:00 20%
 */

const FARE_CONFIG = {
  BASE_FARE: 4800,
  BASE_DISTANCE_KM: 1.6,
  PER_131M: 100,
  DISTANCE_UNIT_M: 131,
  PER_30SEC_IDLE: 100,
  LOW_SPEED_THRESHOLD_KMH: 15,
  NIGHT_SURCHARGE_RATE: 0.2,
  NIGHT_START_HOUR: 22,
  NIGHT_END_HOUR: 4,
};

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= FARE_CONFIG.NIGHT_START_HOUR || hour < FARE_CONFIG.NIGHT_END_HOUR;
}

/**
 * 요금 예상 계산 (호출 전)
 */
function estimateFare(distanceKm, durationMin, surgeMult = 1.0) {
  let fare = FARE_CONFIG.BASE_FARE;

  // 거리 요금
  const extraDistanceM = Math.max(0, (distanceKm - FARE_CONFIG.BASE_DISTANCE_KM) * 1000);
  const distanceFare = Math.floor(extraDistanceM / FARE_CONFIG.DISTANCE_UNIT_M) * FARE_CONFIG.PER_131M;
  fare += distanceFare;

  // 시간 요금 (저속 구간 약 30% 추정)
  const idleSeconds = durationMin * 60 * 0.3;
  const timeFare = Math.floor(idleSeconds / 30) * FARE_CONFIG.PER_30SEC_IDLE;
  fare += timeFare;

  // 심야 할증
  if (isNightTime()) {
    fare = Math.floor(fare * (1 + FARE_CONFIG.NIGHT_SURCHARGE_RATE));
  }

  // 서지 프라이싱
  fare = Math.floor(fare * surgeMult);

  // 10원 단위 반올림
  fare = Math.round(fare / 10) * 10;

  return {
    total: fare,
    base_fare: FARE_CONFIG.BASE_FARE,
    distance_fare: distanceFare,
    time_fare: timeFare,
    is_night: isNightTime(),
    surge_multiplier: surgeMult,
  };
}

/**
 * 최종 요금 계산 (운행 완료 후)
 */
function calculateFinalFare(distanceKm, durationMin, locationLogs = [], surgeMult = 1.0) {
  let fare = FARE_CONFIG.BASE_FARE;

  // 거리 요금
  const extraDistanceM = Math.max(0, (distanceKm - FARE_CONFIG.BASE_DISTANCE_KM) * 1000);
  const distanceFare = Math.floor(extraDistanceM / FARE_CONFIG.DISTANCE_UNIT_M) * FARE_CONFIG.PER_131M;
  fare += distanceFare;

  // 시간 요금: 실제 위치 로그에서 저속 구간 계산
  let idleSeconds = 0;
  if (locationLogs.length > 1) {
    for (let i = 1; i < locationLogs.length; i++) {
      const speed = locationLogs[i].speed || 0;
      if (speed < FARE_CONFIG.LOW_SPEED_THRESHOLD_KMH) {
        const timeDiff = (new Date(locationLogs[i].recorded_at) - new Date(locationLogs[i - 1].recorded_at)) / 1000;
        idleSeconds += timeDiff;
      }
    }
  } else {
    idleSeconds = durationMin * 60 * 0.3;
  }

  const timeFare = Math.floor(idleSeconds / 30) * FARE_CONFIG.PER_30SEC_IDLE;
  fare += timeFare;

  // 심야 할증
  const nightSurcharge = isNightTime() ? Math.floor(fare * FARE_CONFIG.NIGHT_SURCHARGE_RATE) : 0;
  fare += nightSurcharge;

  // 서지 프라이싱
  fare = Math.floor(fare * surgeMult);
  fare = Math.round(fare / 10) * 10;

  return {
    total: fare,
    base_fare: FARE_CONFIG.BASE_FARE,
    distance_fare: distanceFare,
    time_fare: timeFare,
    night_surcharge: nightSurcharge,
    surge_multiplier: surgeMult,
  };
}

/**
 * 서지 배율 계산 (수요/공급 기반)
 */
function calculateSurgeMultiplier(activeRiders, availableDrivers, areaId) {
  if (availableDrivers === 0) return 2.0;

  const ratio = activeRiders / availableDrivers;

  if (ratio <= 1.0) return 1.0;
  if (ratio <= 1.5) return 1.2;
  if (ratio <= 2.0) return 1.5;
  if (ratio <= 3.0) return 1.8;
  return 2.0;
}

/**
 * 쿠폰 할인 적용
 */
function applyCouponDiscount(fare, coupon) {
  if (!coupon) return { discount: 0, finalFare: fare };

  let discount = 0;
  if (coupon.discount_type === 'FIXED') {
    discount = coupon.discount_value;
  } else if (coupon.discount_type === 'PERCENTAGE') {
    discount = Math.floor(fare * coupon.discount_value / 100);
    if (coupon.max_discount) {
      discount = Math.min(discount, coupon.max_discount);
    }
  }

  if (fare < coupon.min_fare) {
    return { discount: 0, finalFare: fare, error: '최소 요금 미달' };
  }

  const finalFare = Math.max(0, fare - discount);
  return { discount, finalFare };
}

module.exports = {
  estimateFare,
  calculateFinalFare,
  calculateSurgeMultiplier,
  applyCouponDiscount,
  isNightTime,
  FARE_CONFIG,
};
