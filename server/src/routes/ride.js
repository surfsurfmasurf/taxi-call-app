const express = require('express');
const router = express.Router();
const { Ride, Driver, User, LocationLog, Review } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { estimateFare, calculateFinalFare, applyCouponDiscount, calculateSurgeMultiplier } = require('../services/fareService');
const { executeMatching } = require('../services/matchingService');
const { processRidePayment } = require('../services/paymentService');
const { sendPushNotification, notifications } = require('../services/notificationService');

/**
 * POST /api/rides/estimate - 요금 예상
 */
router.post('/estimate', authenticate, async (req, res) => {
  try {
    const { pickup_lat, pickup_lng, dest_lat, dest_lng } = req.body;

    // TODO: 실제 지도 API로 거리/시간 계산
    // 여기선 직선거리 기반 추정
    const distanceKm = calculateDistance(pickup_lat, pickup_lng, dest_lat, dest_lng);
    const durationMin = distanceKm * 3; // 약 20km/h 평균 속도 추정

    const surgeMult = calculateSurgeMultiplier(10, 5, null); // TODO: 실제 수요/공급 데이터
    const fare = estimateFare(distanceKm, durationMin, surgeMult);

    res.json({
      estimated_distance_km: Math.round(distanceKm * 10) / 10,
      estimated_duration_min: Math.round(durationMin),
      fare,
    });
  } catch (error) {
    console.error('Estimate error:', error);
    res.status(500).json({ error: '요금 예상에 실패했습니다.' });
  }
});

/**
 * POST /api/rides - 택시 호출
 */
router.post('/', authenticate, authorize('RIDER'), validate(schemas.requestRide), async (req, res) => {
  try {
    const {
      pickup_lat, pickup_lng, pickup_address,
      dest_lat, dest_lng, dest_address,
      waypoints, payment_method_id, coupon_id,
      is_scheduled, scheduled_at,
    } = req.body;

    // 요금 예상
    const distanceKm = calculateDistance(pickup_lat, pickup_lng, dest_lat, dest_lng);
    const durationMin = distanceKm * 3;
    const surgeMult = calculateSurgeMultiplier(10, 5, null);
    const fareEstimate = estimateFare(distanceKm, durationMin, surgeMult);

    // 쿠폰 할인 처리
    let discountAmount = 0;
    if (coupon_id) {
      const { Coupon } = require('../models');
      const coupon = await Coupon.findByPk(coupon_id);
      if (coupon) {
        const result = applyCouponDiscount(fareEstimate.total, coupon);
        discountAmount = result.discount;
      }
    }

    // 운행 생성
    const ride = await Ride.create({
      rider_id: req.user.id,
      pickup_lat, pickup_lng, pickup_address,
      dest_lat, dest_lng, dest_address,
      waypoints: waypoints || [],
      estimated_fare: fareEstimate.total,
      base_fare: fareEstimate.base_fare,
      surge_multiplier: surgeMult,
      coupon_id,
      discount_amount: discountAmount,
      is_scheduled: is_scheduled || false,
      scheduled_at: scheduled_at || null,
      status: is_scheduled ? 'REQUESTED' : 'REQUESTED',
    });

    // 예약 호출이 아닌 경우 즉시 매칭 시작
    if (!is_scheduled) {
      const io = req.app.get('io');
      // 비동기로 매칭 실행
      executeMatching(ride.id, pickup_lat, pickup_lng, io).then(async (result) => {  // eslint-disable-line no-floating-promise
        if (result.success) {
          await ride.update({
            driver_id: result.driver_id,
            status: 'MATCHED',
            matched_at: new Date(),
          });

          const driver = await Driver.findByPk(result.driver_id, {
            include: [{ model: User, as: 'user' }],
          });

          // 승객에게 알림
          const notif = notifications.rideMatched(driver.user.name, driver.vehicle_number);
          sendPushNotification(req.user.id, notif.title, notif.body, { ride_id: ride.id });

          // 소켓으로 실시간 알림
          io.to(`rider:${req.user.id}`).emit('ride:matched', {
            ride_id: ride.id,
            driver: {
              name: driver.user.name,
              phone: driver.user.phone,
              vehicle_number: driver.vehicle_number,
              vehicle_model: driver.vehicle_model,
              rating: driver.user.rating,
              lat: driver.current_lat,
              lng: driver.current_lng,
            },
          });
        } else {
          await ride.update({ status: 'CANCELLED', cancelled_by: 'SYSTEM', cancel_reason: '배차 실패' });
          io.to(`rider:${req.user.id}`).emit('ride:no_driver', { ride_id: ride.id });
        }
      }).catch((err) => {
        console.error('Matching error:', err);
        ride.update({ status: 'CANCELLED', cancelled_by: 'SYSTEM', cancel_reason: '매칭 오류' });
      });
    }

    res.status(201).json({
      success: true,
      ride: {
        id: ride.id,
        status: ride.status,
        estimated_fare: ride.estimated_fare,
        discount_amount: discountAmount,
        surge_multiplier: surgeMult,
      },
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ error: '호출에 실패했습니다.' });
  }
});

/**
 * GET /api/rides/:id - 운행 상세 조회
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ride = await Ride.findByPk(req.params.id, {
      include: [
        { model: User, as: 'rider', attributes: ['id', 'name', 'phone', 'rating', 'profile_image'] },
        {
          model: Driver, as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'rating', 'profile_image'] }],
        },
        { model: Review, as: 'review' },
      ],
    });

    if (!ride) return res.status(404).json({ error: '운행을 찾을 수 없습니다.' });

    // 본인 운행만 조회 가능 (관리자 제외)
    if (req.user.type !== 'ADMIN') {
      const isRider = ride.rider_id === req.user.id;
      const isDriver = req.driver && ride.driver_id === req.driver.id;
      if (!isRider && !isDriver) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
    }

    res.json({ ride });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * GET /api/rides - 내 운행 목록
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = {};

    if (req.user.type === 'RIDER') {
      where.rider_id = req.user.id;
    } else if (req.driver) {
      where.driver_id = req.driver.id;
    }

    if (status) where.status = status;

    const rides = await Ride.findAndCountAll({
      where,
      limit: Math.min(parseInt(limit), 50),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'rider', attributes: ['id', 'name', 'rating'] },
        {
          model: Driver, as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'rating'] }],
        },
      ],
    });

    res.json({
      rides: rides.rows,
      total: rides.count,
      page: parseInt(page),
      totalPages: Math.ceil(rides.count / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * PATCH /api/rides/:id/status - 운행 상태 변경
 */
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ error: '운행을 찾을 수 없습니다.' });

    // 유효한 상태 전환 검증
    const VALID_TRANSITIONS = {
      REQUESTED: ['MATCHED', 'CANCELLED'],
      MATCHED: ['ARRIVING', 'CANCELLED'],
      ARRIVING: ['PICKUP', 'CANCELLED'],
      PICKUP: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };
    const allowed = VALID_TRANSITIONS[ride.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        error: `${ride.status}에서 ${status}로 변경할 수 없습니다.`,
      });
    }

    const io = req.app.get('io');
    const updates = { status };

    switch (status) {
      case 'ARRIVING':
        break;

      case 'PICKUP':
        updates.pickup_at = new Date();
        sendPushNotification(ride.rider_id, ...Object.values(notifications.driverArrived()));
        break;

      case 'IN_PROGRESS':
        const notif = notifications.rideStarted();
        sendPushNotification(ride.rider_id, notif.title, notif.body);
        break;

      case 'COMPLETED': {
        updates.completed_at = new Date();

        // 위치 로그에서 실제 거리/시간 계산
        const logs = await LocationLog.findAll({
          where: { ride_id: ride.id },
          order: [['recorded_at', 'ASC']],
        });

        const distanceKm = calculateDistanceFromLogs(logs) || ride.distance_km ||
          calculateDistance(ride.pickup_lat, ride.pickup_lng, ride.dest_lat, ride.dest_lng);
        const durationMin = ride.pickup_at
          ? (new Date() - new Date(ride.pickup_at)) / 60000
          : distanceKm * 3;

        const fareResult = calculateFinalFare(distanceKm, durationMin, logs, ride.surge_multiplier);
        updates.final_fare = fareResult.total;
        updates.distance_fare = fareResult.distance_fare;
        updates.time_fare = fareResult.time_fare;
        updates.distance_km = distanceKm;
        updates.duration_min = durationMin;

        await ride.update(updates);

        // 결제 처리
        const paymentResult = await processRidePayment(ride.id);

        const completedNotif = notifications.rideCompleted(fareResult.total);
        sendPushNotification(ride.rider_id, completedNotif.title, completedNotif.body, { ride_id: ride.id });

        io.to(`rider:${ride.rider_id}`).emit('ride:completed', {
          ride_id: ride.id,
          fare: fareResult,
          payment: paymentResult,
        });

        return res.json({ success: true, ride: await ride.reload(), fare: fareResult });
      }

      case 'CANCELLED': {
        updates.cancelled_at = new Date();
        updates.cancelled_by = req.user.type === 'RIDER' ? 'RIDER' : 'DRIVER';
        updates.cancel_reason = req.body.reason || '';

        const target = req.user.type === 'RIDER' ? ride.driver_id : ride.rider_id;
        if (target) {
          const cancelNotif = notifications.rideCancelled(req.body.reason);
          sendPushNotification(target, cancelNotif.title, cancelNotif.body);
        }
        break;
      }
    }

    await ride.update(updates);

    // 소켓 이벤트 브로드캐스트
    io.to(`ride:${ride.id}`).emit('ride:status_changed', {
      ride_id: ride.id,
      status,
    });

    res.json({ success: true, ride: await ride.reload() });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: '상태 변경에 실패했습니다.' });
  }
});

/**
 * POST /api/rides/:id/review - 리뷰 작성
 */
router.post('/:id/review', authenticate, validate(schemas.submitReview), async (req, res) => {
  try {
    const ride = await Ride.findByPk(req.params.id);
    if (!ride || ride.status !== 'COMPLETED') {
      return res.status(400).json({ error: '완료된 운행만 리뷰할 수 있습니다.' });
    }

    const existingReview = await Review.findOne({ where: { ride_id: ride.id, reviewer_id: req.user.id } });
    if (existingReview) {
      return res.status(400).json({ error: '이미 리뷰를 작성했습니다.' });
    }

    const revieweeId = req.user.type === 'RIDER'
      ? (await Driver.findByPk(ride.driver_id))?.user_id
      : ride.rider_id;

    const review = await Review.create({
      ride_id: ride.id,
      reviewer_id: req.user.id,
      reviewee_id: revieweeId,
      rating: req.body.rating,
      comment: req.body.comment,
      tags: req.body.tags || [],
    });

    // 평점 업데이트
    const allReviews = await Review.findAll({ where: { reviewee_id: revieweeId } });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await User.update(
      { rating: Math.round(avgRating * 10) / 10 },
      { where: { id: revieweeId } }
    );

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: '리뷰 작성에 실패했습니다.' });
  }
});

// Haversine 거리 계산 (km)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 위치 로그에서 실제 이동 거리 계산
function calculateDistanceFromLogs(logs) {
  if (logs.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < logs.length; i++) {
    total += calculateDistance(logs[i - 1].lat, logs[i - 1].lng, logs[i].lat, logs[i].lng);
  }
  return total;
}

module.exports = router;
