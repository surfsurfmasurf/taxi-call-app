const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('RIDER', 'DRIVER', 'ADMIN'),
    allowNull: false,
    defaultValue: 'RIDER',
  },
  profile_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 5.0,
  },
  total_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fcm_token: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    },
  },
});

User.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

User.prototype.toSafeJSON = function () {
  const { password_hash, ...safe } = this.toJSON();
  return safe;
};

module.exports = User;
