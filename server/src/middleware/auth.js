const jwt = require('jsonwebtoken');
const { User, Driver } = require('../models');

// JWT 인증 미들웨어
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: '유효하지 않은 사용자입니다.' });
    }

    req.user = user;

    // 기사인 경우 기사 프로필도 로드
    if (user.type === 'DRIVER') {
      req.driver = await Driver.findOne({ where: { user_id: user.id } });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다.' });
    }
    return res.status(401).json({ error: '인증에 실패했습니다.' });
  }
};

// 역할 기반 권한 확인
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.type)) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    next();
  };
};

// JWT 토큰 생성
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

module.exports = { authenticate, authorize, generateTokens };
