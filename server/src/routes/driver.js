const express = require('express');
const router = express.Router();
const { Driver, User, Ride } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { updateDriverLocation, removeDriverLocation } = require('../services/matchingService');
const { getDriverSettlement } = require('../services/settlementService');

/**
 * POST /api/drivers/register - 기사 등록
 */
router.post('/register', authenticate, validate(schemas.registerDriver), async (req, res) => {
  try {
    const existing = await Driver.findOne({ where: { user_id: req.user.id } });
    if (existing) {
      return res.status(400).json({ error: '이미 기사로 등록되어 있습니다.' });
    }

    const driver = await Driver.create({
      user_id: req.user.id,
      ...req.body,
    });

    await req.user.update({ type: 'DRIVER' });

    res.status(201).json({ success: true, driver });
  } catch (error) {
    console.error('Driver register error:', error);
    res.status(500).json({ error: '기사 등록에 실패했습니다.' });
  }
});

/**
 * PATCH /api/drivers/status - 기사 상태 변경 (AVAILABLE/OFFLINE)
 */
router.patch('/status', authenticate, authorize('DRIVER'), async (req, res) => {
  try {
    const { status, lat, lng } = req.body;

    if (!['AVAILABLE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }

    await req.driver.update({ status, current_lat: lat, current_lng: lng });

    if (status === 'AVAILABLE' && lat && lng) {
      await updateDriverLocation(req.driver.id, lat, lng);
    } else if (status === 'OFFLINE') {
      await removeDriverLocation(req.driver.id);
    }

    res.json({ success: true, status: req.driver.status });
  } catch (error) {
    res.status(500).json({ error: '상태 변경에 실패했습니다.' });
  }
});

/**
 * POST /api/drivers/location - 위치 업데이트
 */
router.post('/location', authenticate, authorize('DRIVER'), async (req, res) => {
  try {
    const { lat, lng, speed, heading } = req.body;

    await req.driver.update({ current_lat: lat, current_lng: lng });
    await updateDriverLocation(req.driver.id, lat, lng);

    // 운행 중이면 위치 로그 저장
    const activeRide = await Ride.findOne({
      where: { driver_id: req.driver.id, status: ['IN_PROGRESS', 'ARRIVING', 'PICKUP'] },
    });

    if (activeRide) {
      const { LocationLog } = require('../models');
      await LocationLog.create({
        driver_id: req.driver.id,
        ride_id: activeRide.id,
        lat, lng, speed, heading,
      });

      // 승객에게 실시간 위치 전달
      const io = req.app.get('io');
      io.to(`ride:${activeRide.id}`).emit('driver:location', {
        lat, lng, speed, heading,
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '위치 업데이트에 실패했습니다.' });
  }
});

/**
 * POST /api/drivers/respond - 매칭 응답 (수락/거절)
 */
router.post('/respond', authenticate, authorize('DRIVER'), async (req, res) => {
  try {
    const { ride_id, accept } = req.body;
    const { getRedisClient } = require('../config/redis');
    const redis = await getRedisClient();

    const responseKey = `match:response:${ride_id}:${req.driver.id}`;
    await redis.setEx(responseKey, 30, accept ? 'ACCEPTED' : 'REJECTED');

    if (accept) {
      await req.driver.update({ status: 'BUSY' });
    }

    // 수락률 업데이트
    const totalRequests = await Ride.count({ where: { driver_id: req.driver.id } });
    const acceptedRequests = await Ride.count({
      where: { driver_id: req.driver.id, status: { $ne: 'CANCELLED' } },
    });
    if (totalRequests > 0) {
      await req.driver.update({
        acceptance_rate: (acceptedRequests / totalRequests) * 100,
      });
    }

    res.json({ success: true, accepted: accept });
  } catch (error) {
    res.status(500).json({ error: '응답 처리에 실패했습니다.' });
  }
});

/**
 * GET /api/drivers/settlement - 정산 조회
 */
router.get('/settlement', authenticate, authorize('DRIVER'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date) : new Date(new Date().setDate(1)); // 이번 달 1일
    const endDate = end_date ? new Date(end_date) : new Date();

    const settlement = await getDriverSettlement(req.driver.id, startDate, endDate);
    res.json(settlement);
  } catch (error) {
    res.status(500).json({ error: '정산 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/drivers/dashboard - 기사 대시보드
 */
router.get('/dashboard', authenticate, authorize('DRIVER'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { Op } = require('sequelize');
    const todayRides = await Ride.findAll({
      where: {
        driver_id: req.driver.id,
        status: 'COMPLETED',
        completed_at: { [Op.gte]: today },
      },
    });

    const todayEarnings = todayRides.reduce((sum, r) => sum + (r.final_fare || 0), 0);
    const commission = Math.floor(todayEarnings * 0.2);

    res.json({
      today: {
        rides: todayRides.length,
        earnings: todayEarnings,
        commission,
        net_earnings: todayEarnings - commission,
      },
      driver: {
        status: req.driver.status,
        rating: req.user.rating,
        acceptance_rate: req.driver.acceptance_rate,
        total_earnings: req.driver.total_earnings,
      },
    });
  } catch (error) {
    res.status(500).json({ error: '대시보드 조회에 실패했습니다.' });
  }
});

module.exports = router;
