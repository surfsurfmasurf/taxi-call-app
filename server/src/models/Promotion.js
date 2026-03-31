const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Promotion = sequelize.define('Promotion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  link_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  target_type: {
    type: DataTypes.ENUM('ALL', 'RIDER', 'DRIVER', 'NEW_USER'),
    defaultValue: 'ALL',
  },
  display_order: {
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
  tableName: 'promotions',
});

module.exports = Promotion;
