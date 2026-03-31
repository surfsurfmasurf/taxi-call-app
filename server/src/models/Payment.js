const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  payment_method_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  discount_amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  final_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  method_type: {
    type: DataTypes.ENUM('CARD', 'KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY', 'CASH', 'WALLET'),
    allowNull: false,
  },
  // PG사 응답 정보
  pg_transaction_id: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  pg_payment_key: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  pg_order_id: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  pg_response: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND'),
    defaultValue: 'PENDING',
  },
  refund_amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  refund_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refunded_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'payments',
  indexes: [
    { fields: ['ride_id'] },
    { fields: ['user_id'] },
    { fields: ['pg_transaction_id'] },
  ],
});

module.exports = Payment;
