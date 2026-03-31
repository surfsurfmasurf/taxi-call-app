const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  rider_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // 출발지
  pickup_lat: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  pickup_lng: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  pickup_address: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  // 목적지
  dest_lat: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  dest_lng: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  dest_address: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  // 경유지 (Phase 3)
  waypoints: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: '[{lat, lng, address, order}]',
  },
  // 상태
  status: {
    type: DataTypes.ENUM(
      'REQUESTED',   // 호출 요청
      'MATCHED',     // 기사 매칭 완료
      'ARRIVING',    // 기사 이동 중
      'PICKUP',      // 승객 탑승
      'IN_PROGRESS', // 운행 중
      'COMPLETED',   // 운행 완료
      'CANCELLED'    // 취소
    ),
    defaultValue: 'REQUESTED',
  },
  // 요금
  estimated_fare: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  final_fare: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  base_fare: {
    type: DataTypes.INTEGER,
    defaultValue: 4800,
  },
  distance_fare: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  time_fare: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  surge_multiplier: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
  },
  // 운행 정보
  distance_km: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  duration_min: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  // 예약 (Phase 3)
  is_scheduled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // 쿠폰 (Phase 3)
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  discount_amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // 취소 정보
  cancelled_by: {
    type: DataTypes.ENUM('RIDER', 'DRIVER', 'SYSTEM'),
    allowNull: true,
  },
  cancel_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // 타임스탬프
  requested_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  matched_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pickup_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'rides',
  indexes: [
    { fields: ['rider_id'] },
    { fields: ['driver_id'] },
    { fields: ['status'] },
    { fields: ['scheduled_at'] },
  ],
});

module.exports = Ride;
