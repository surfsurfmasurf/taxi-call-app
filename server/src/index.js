require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const { initializeSocket } = require('./socket');

// Routes
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/ride');
const driverRoutes = require('./routes/driver');
const paymentRoutes = require('./routes/payment');
const couponRoutes = require('./routes/coupon');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.set('io', io);

// 미들웨어
app.use(helmet({
  contentSecurityPolicy: false, // POC: CDN 리소스 허용
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// 정적 파일 서빙 (웹 프론트엔드)
const path = require('path');
const webDir = process.env.WEB_DIR || path.join(__dirname, '../../web');
app.use(express.static(webDir));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use('/api/', limiter);

// OTP 전용 rate limit (더 엄격)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: '인증 요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
});
app.use('/api/auth/otp', otpLimiter);

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 - API는 JSON, 그 외는 index.html로 fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(webDir, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// Socket.IO 초기화
initializeSocket(io);

// 서버 시작
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // DB 연결 및 테이블 동기화
    await sequelize.authenticate();
    console.log('Database connected');

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synced');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
