const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LocationLog = sequelize.define('LocationLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  lat: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  lng: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  speed: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'km/h',
  },
  heading: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'degrees 0-360',
  },
  accuracy: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'meters',
  },
  recorded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'location_logs',
  timestamps: false,
  indexes: [
    { fields: ['driver_id', 'recorded_at'] },
    { fields: ['ride_id'] },
  ],
});

module.exports = LocationLog;
