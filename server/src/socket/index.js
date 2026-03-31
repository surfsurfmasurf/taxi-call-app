const jwt = require('jsonwebtoken');
const { User, Driver, Ride, LocationLog } = require('../models');
const { updateDriverLocation, removeDriverLocation } = require('../services/matchingService');
const { getRedisClient } = require('../config/redis');

function initializeSocket(io) {
  // 인증 미들웨어
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('인증 토큰이 필요합니다.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId);
      if (!user) return next(new Error('유효하지 않은 사용자입니다.'));

      socket.user = user;
      if (user.type === 'DRIVER') {
        socket.driver = await Driver.findOne({ where: { user_id: user.id } });
      }
      next();
    } catch (error) {
      next(new Error('인증에 실패했습니다.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.name} (${user.type})`);

    // 사용자별 룸 입장
    if (user.type === 'RIDER') {
      socket.join(`rider:${user.id}`);
    } else if (user.type === 'DRIVER') {
      socket.join(`driver:${socket.driver.id}`);
    }

    // === 기사 이벤트 ===

    // 기사 위치 업데이트 (3~5초 간격)
    socket.on('driver:update_location', async (data) => {
      if (!socket.driver) return;

      const { lat, lng, speed, heading, accuracy } = data;
      await updateDriverLocation(socket.driver.id, lat, lng);

      // 활성 운행이 있으면 위치 로그 저장 + 승객에게 전달
      const activeRide = await Ride.findOne({
        where: {
          driver_id: socket.driver.id,
          status: ['MATCHED', 'ARRIVING', 'PICKUP', 'IN_PROGRESS'],
        },
      });

      if (activeRide) {
        await LocationLog.create({
          driver_id: socket.driver.id,
          ride_id: activeRide.id,
          lat, lng, speed, heading, accuracy,
        });

        io.to(`ride:${activeRide.id}`).emit('driver:location', {
          lat, lng, speed, heading,
          driver_id: socket.driver.id,
        });
      }
    });

    // 기사 온라인/오프라인 토글
    socket.on('driver:go_online', async (data) => {
      if (!socket.driver) return;
      const { lat, lng } = data;
      await socket.driver.update({ status: 'AVAILABLE', current_lat: lat, current_lng: lng });
      await updateDriverLocation(socket.driver.id, lat, lng);
      socket.emit('driver:status_changed', { status: 'AVAILABLE' });
    });

    socket.on('driver:go_offline', async () => {
      if (!socket.driver) return;
      await socket.driver.update({ status: 'OFFLINE' });
      await removeDriverLocation(socket.driver.id);
      socket.emit('driver:status_changed', { status: 'OFFLINE' });
    });

    // 매칭 응답 (수락/거절)
    socket.on('driver:respond_ride', async (data) => {
      if (!socket.driver) return;
      const { ride_id, accept } = data;

      const redis = await getRedisClient();
      const responseKey = `match:response:${ride_id}:${socket.driver.id}`;
      await redis.setEx(responseKey, 30, accept ? 'ACCEPTED' : 'REJECTED');

      if (accept) {
        await socket.driver.update({ status: 'BUSY' });
        socket.join(`ride:${ride_id}`);

        const ride = await Ride.findByPk(ride_id);
        if (ride) {
          io.to(`rider:${ride.rider_id}`).emit('ride:matched', {
            ride_id,
            driver: {
              id: socket.driver.id,
              name: socket.user.name,
              phone: socket.user.phone,
              vehicle_number: socket.driver.vehicle_number,
              vehicle_model: socket.driver.vehicle_model,
              vehicle_color: socket.driver.vehicle_color,
              rating: socket.user.rating,
              lat: socket.driver.current_lat,
              lng: socket.driver.current_lng,
            },
          });
        }
      }
    });

    // === 승객 이벤트 ===

    // 운행 룸 입장
    socket.on('ride:join', (data) => {
      socket.join(`ride:${data.ride_id}`);
    });

    // 운행 룸 퇴장
    socket.on('ride:leave', (data) => {
      socket.leave(`ride:${data.ride_id}`);
    });

    // 위치 공유 (운행 경로를 다른 사람에게 공유)
    socket.on('ride:share_location', async (data) => {
      const { ride_id, share_to } = data;
      const ride = await Ride.findByPk(ride_id);
      if (ride && ride.rider_id === user.id) {
        // Redis에 공유 정보 저장
        const redis = await getRedisClient();
        await redis.setEx(`ride:share:${ride_id}`, 3600, JSON.stringify({
          ride_id,
          shared_by: user.id,
          shared_to: share_to,
        }));
      }
    });

    // SOS 긴급 호출
    socket.on('ride:sos', async (data) => {
      const { ride_id, lat, lng } = data;
      console.error(`[SOS] User ${user.id} - Ride ${ride_id} at (${lat}, ${lng})`);

      // TODO: 긴급 서비스 연동
      // 관리자에게 즉시 알림
      io.to('admin').emit('sos:alert', {
        user_id: user.id,
        user_name: user.name,
        ride_id,
        lat, lng,
        timestamp: new Date(),
      });
    });

    // === 연결 해제 ===
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${user.name}`);

      if (socket.driver && socket.driver.status === 'AVAILABLE') {
        // 기사가 연결 해제 시 잠시 대기 후 오프라인 처리
        const driverId = socket.driver.id; // 참조 캡처하여 메모리 릭 방지
        const redis = await getRedisClient();
        await redis.setEx(`driver:reconnect:${driverId}`, 30, 'pending');

        setTimeout(async () => {
          try {
            const reconnectStatus = await redis.get(`driver:reconnect:${driverId}`);
            if (reconnectStatus === 'pending') {
              await Driver.update({ status: 'OFFLINE' }, { where: { id: driverId } });
              await removeDriverLocation(driverId);
            }
          } catch (err) {
            console.error('Disconnect cleanup error:', err);
          }
        }, 30000);
      }
    });
  });

  return io;
}

module.exports = { initializeSocket };
