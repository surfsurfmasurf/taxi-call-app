const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentMethod = sequelize.define('PaymentMethod', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('CARD', 'KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY'),
    allowNull: false,
  },
  // PG사 빌링키 (카드 정보 대신 저장)
  billing_key: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  // 표시용 정보 (마스킹)
  display_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '예: 신한카드 **** 1234',
  },
  card_company: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  last_four: {
    type: DataTypes.STRING(4),
    allowNull: true,
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'payment_methods',
  indexes: [
    { fields: ['user_id'] },
  ],
});

module.exports = PaymentMethod;
