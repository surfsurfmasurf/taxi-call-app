const sequelize = require('../config/database');
const User = require('./User');
const Driver = require('./Driver');
const PaymentMethod = require('./PaymentMethod');
const Ride = require('./Ride');
const Payment = require('./Payment');
const LocationLog = require('./LocationLog');
const Review = require('./Review');
const Coupon = require('./Coupon');
const UserCoupon = require('./UserCoupon');
const Promotion = require('./Promotion');

// === Associations ===

// User <-> Driver (1:1)
User.hasOne(Driver, { foreignKey: 'user_id', as: 'driverProfile' });
Driver.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> PaymentMethod (1:N)
User.hasMany(PaymentMethod, { foreignKey: 'user_id', as: 'paymentMethods' });
PaymentMethod.belongsTo(User, { foreignKey: 'user_id' });

// Ride associations
User.hasMany(Ride, { foreignKey: 'rider_id', as: 'ridesAsRider' });
Ride.belongsTo(User, { foreignKey: 'rider_id', as: 'rider' });
Driver.hasMany(Ride, { foreignKey: 'driver_id', as: 'rides' });
Ride.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

// Ride <-> Payment (1:1)
Ride.hasOne(Payment, { foreignKey: 'ride_id', as: 'payment' });
Payment.belongsTo(Ride, { foreignKey: 'ride_id' });
Payment.belongsTo(PaymentMethod, { foreignKey: 'payment_method_id', as: 'method' });

// Ride <-> LocationLog (1:N)
Ride.hasMany(LocationLog, { foreignKey: 'ride_id', as: 'locationLogs' });
LocationLog.belongsTo(Ride, { foreignKey: 'ride_id' });
Driver.hasMany(LocationLog, { foreignKey: 'driver_id' });
LocationLog.belongsTo(Driver, { foreignKey: 'driver_id' });

// Ride <-> Review (1:1)
Ride.hasOne(Review, { foreignKey: 'ride_id', as: 'review' });
Review.belongsTo(Ride, { foreignKey: 'ride_id' });
Review.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });
Review.belongsTo(User, { foreignKey: 'reviewee_id', as: 'reviewee' });

// Coupon associations
User.belongsToMany(Coupon, { through: UserCoupon, foreignKey: 'user_id', as: 'coupons' });
Coupon.belongsToMany(User, { through: UserCoupon, foreignKey: 'coupon_id', as: 'users' });

module.exports = {
  sequelize,
  User,
  Driver,
  PaymentMethod,
  Ride,
  Payment,
  LocationLog,
  Review,
  Coupon,
  UserCoupon,
  Promotion,
};
