const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Coupon, UserCoupon } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

/**
 * POST /api/coupons/apply - 쿠폰 코드 등록
 */
router.post('/apply', authenticate, validate(schemas.applyCoupon), async (req, res) => {
  try {
    const { code } = req.body;
    const now = new Date();

    const coupon = await Coupon.findOne({
      where: {
        code,
        is_active: true,
        valid_from: { [Op.lte]: now },
        valid_until: { [Op.gte]: now },
      },
    });

    if (!coupon) {
      return res.status(400).json({ error: '유효하지 않은 쿠폰입니다.' });
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: '쿠폰 사용 한도를 초과했습니다.' });
    }

    const existing = await UserCoupon.findOne({
      where: { user_id: req.user.id, coupon_id: coupon.id },
    });

    if (existing) {
      return res.status(400).json({ error: '이미 등록한 쿠폰입니다.' });
    }

    // 트랜잭션으로 race condition 방지
    const sequelize = require('../config/database');
    await sequelize.transaction(async (t) => {
      await UserCoupon.create({ user_id: req.user.id, coupon_id: coupon.id }, { transaction: t });
      await coupon.increment('current_uses', { transaction: t });
    });

    res.json({ success: true, coupon });
  } catch (error) {
    res.status(500).json({ error: '쿠폰 등록에 실패했습니다.' });
  }
});

/**
 * GET /api/coupons/my - 내 쿠폰 목록
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const now = new Date();

    const userCoupons = await UserCoupon.findAll({
      where: { user_id: req.user.id, is_used: false },
      include: [{
        model: Coupon,
        where: {
          is_active: true,
          valid_until: { [Op.gte]: now },
        },
      }],
    });

    res.json({ coupons: userCoupons });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

module.exports = router;
