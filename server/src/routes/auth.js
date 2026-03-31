const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticate, generateTokens } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { getRedisClient } = require('../config/redis');

/**
 * POST /api/auth/otp/send - OTP 발송
 */
router.post('/otp/send', validate(schemas.sendOtp), async (req, res) => {
  try {
    const { phone } = req.body;

    // 6자리 OTP 생성
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Redis에 OTP 저장 (3분 만료)
    const redis = await getRedisClient();
    await redis.setEx(`otp:${phone}`, 180, otp);

    // TODO: 실제 SMS 발송 연동
    // await smsService.send(phone, `[택시앱] 인증번호: ${otp}`);

    console.log(`[DEV] OTP for ${phone}: ${otp}`);

    res.json({ success: true, message: '인증번호가 발송되었습니다.' });
  } catch (error) {
    console.error('OTP send error:', error);
    res.status(500).json({ error: '인증번호 발송에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/otp/verify - OTP 인증 + 로그인/회원가입
 */
router.post('/otp/verify', validate(schemas.verifyOtp), async (req, res) => {
  try {
    const { phone, code, name } = req.body;

    // OTP 검증
    const redis = await getRedisClient();
    const savedOtp = await redis.get(`otp:${phone}`);

    if (!savedOtp || savedOtp !== code) {
      return res.status(400).json({ error: '인증번호가 올바르지 않습니다.' });
    }

    await redis.del(`otp:${phone}`);

    // 기존 사용자 조회 또는 신규 생성
    let user = await User.findOne({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      if (!name) {
        return res.status(400).json({ error: '신규 사용자는 이름이 필요합니다.', isNewUser: true });
      }
      user = await User.create({
        phone,
        name,
        is_verified: true,
      });
      isNewUser = true;
    } else {
      await user.update({ is_verified: true });
    }

    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      isNewUser,
      user: user.toSafeJSON(),
      ...tokens,
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ error: '인증 처리에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/refresh - 토큰 갱신
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token이 필요합니다.' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens(decoded.userId);

    res.json({ success: true, ...tokens });
  } catch (error) {
    res.status(401).json({ error: '토큰 갱신에 실패했습니다.' });
  }
});

/**
 * GET /api/auth/me - 내 정보 조회
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user.toSafeJSON(), driver: req.driver || null });
});

/**
 * PUT /api/auth/me - 내 정보 수정
 */
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, email, profile_image, fcm_token } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (profile_image) updates.profile_image = profile_image;
    if (fcm_token) updates.fcm_token = fcm_token;

    await req.user.update(updates);
    res.json({ success: true, user: req.user.toSafeJSON() });
  } catch (error) {
    res.status(500).json({ error: '정보 수정에 실패했습니다.' });
  }
});

module.exports = router;
