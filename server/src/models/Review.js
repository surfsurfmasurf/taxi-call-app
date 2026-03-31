const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  reviewer_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reviewee_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: '["친절해요", "깨끗해요", "안전운전"]',
  },
}, {
  tableName: 'reviews',
});

module.exports = Review;
