const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Driver, Ride, Payment, Promotion } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { processDailySettlement } = require('../services/settlementService');

// 모든 관리자 라우트에 인증 + ADMIN 권한 적용
router.use(authenticate, authorize('ADMIN'));

/**
 * GET /api/admin/dashboard - 관리자 대시보드
 */
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalDrivers, todayRides, todayRevenue] = await Promise.all([
      User.count({ where: { type: 'RIDER' } }),
      Driver.count(),
      Ride.count({ where: { created_at: { [Op.gte]: today } } }),
      Ride.sum('final_fare', {
        where: { status: 'COMPLETED', completed_at: { [Op.gte]: today } },
      }),
    ]);

    const activeDrivers = await Driver.count({ where: { status: 'AVAILABLE' } });
    const pendingDrivers = await Driver.count({ where: { is_approved: false } });

    // 최근 7일 운행 추이
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyRides = await Ride.findAll({
      where: { created_at: { [Op.gte]: weekAgo }, status: 'COMPLETED' },
      attributes: [
        [require('sequelize').fn('DATE', require('sequelize').col('completed_at')), 'date'],
        [require('sequelize').fn('COUNT', '*'), 'count'],
        [require('sequelize').fn('SUM', require('sequelize').col('final_fare')), 'revenue'],
      ],
      group: [require('sequelize').fn('DATE', require('sequelize').col('completed_at'))],
      order: [[require('sequelize').fn('DATE', require('sequelize').col('completed_at')), 'ASC']],
    });

    res.json({
      summary: {
        total_users: totalUsers,
        total_drivers: totalDrivers,
        active_drivers: activeDrivers,
        pending_drivers: pendingDrivers,
        today_rides: todayRides,
        today_revenue: todayRevenue || 0,
      },
      weekly_trend: weeklyRides,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: '대시보드 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/admin/drivers - 기사 관리
 */
router.get('/drivers', async (req, res) => {
  try {
    const { status, approved, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (approved !== undefined) where.is_approved = approved === 'true';

    const drivers = await Driver.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'rating'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']],
    });

    res.json({ drivers: drivers.rows, total: drivers.count });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * PATCH /api/admin/drivers/:id/approve - 기사 승인
 */
router.patch('/drivers/:id/approve', async (req, res) => {
  try {
    const { approve } = req.body;
    await Driver.update({ is_approved: approve }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '처리에 실패했습니다.' });
  }
});

/**
 * GET /api/admin/rides - 전체 운행 조회
 */
router.get('/rides', async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      where.created_at = {
        [Op.gte]: new Date(d.setHours(0, 0, 0, 0)),
        [Op.lte]: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const rides = await Ride.findAndCountAll({
      where,
      include: [
        { model: User, as: 'rider', attributes: ['id', 'name', 'phone'] },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['name'] }] },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']],
    });

    res.json({ rides: rides.rows, total: rides.count });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * POST /api/admin/settlement - 일일 정산 실행
 */
router.post('/settlement', async (req, res) => {
  try {
    const { date } = req.body;
    const results = await processDailySettlement(date || new Date());
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: '정산 처리에 실패했습니다.' });
  }
});

/**
 * CRUD /api/admin/promotions - 프로모션 관리
 */
router.get('/promotions', async (req, res) => {
  const promotions = await Promotion.findAll({ order: [['display_order', 'ASC']] });
  res.json({ promotions });
});

router.post('/promotions', async (req, res) => {
  const promotion = await Promotion.create(req.body);
  res.status(201).json({ success: true, promotion });
});

router.patch('/promotions/:id', async (req, res) => {
  await Promotion.update(req.body, { where: { id: req.params.id } });
  res.json({ success: true });
});

router.delete('/promotions/:id', async (req, res) => {
  await Promotion.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
