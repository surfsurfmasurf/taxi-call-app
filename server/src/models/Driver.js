const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  license_expiry: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  vehicle_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  vehicle_model: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  vehicle_color: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  vehicle_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'BUSY', 'OFFLINE'),
    defaultValue: 'OFFLINE',
  },
  acceptance_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 100.0,
  },
  current_lat: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  current_lng: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  total_earnings: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  is_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'drivers',
});

module.exports = Driver;
