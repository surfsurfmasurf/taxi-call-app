const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserCoupon = sequelize.define('UserCoupon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  coupon_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'user_coupons',
  indexes: [
    { unique: true, fields: ['user_id', 'coupon_id'] },
  ],
});

module.exports = UserCoupon;
