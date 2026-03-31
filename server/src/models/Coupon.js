const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Coupon = sequelize.define('Coupon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  discount_type: {
    type: DataTypes.ENUM('FIXED', 'PERCENTAGE'),
    allowNull: false,
  },
  discount_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FIXED: 원 단위, PERCENTAGE: % 단위',
  },
  max_discount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'PERCENTAGE일 때 최대 할인 금액',
  },
  min_fare: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '최소 주문 금액',
  },
  max_uses: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  current_uses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  valid_from: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'coupons',
});

module.exports = Coupon;
