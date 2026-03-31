const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({ error: '입력값이 올바르지 않습니다.', details: errors });
    }
    next();
  };
};

// 유효성 검사 스키마
const schemas = {
  sendOtp: Joi.object({
    phone: Joi.string().pattern(/^01[0-9]{8,9}$/).required()
      .messages({ 'string.pattern.base': '올바른 휴대폰 번호를 입력해주세요.' }),
  }),

  verifyOtp: Joi.object({
    phone: Joi.string().pattern(/^01[0-9]{8,9}$/).required(),
    code: Joi.string().length(6).required(),
    name: Joi.string().min(2).max(50).optional(),
  }),

  requestRide: Joi.object({
    pickup_lat: Joi.number().min(-90).max(90).required(),
    pickup_lng: Joi.number().min(-180).max(180).required(),
    pickup_address: Joi.string().max(500).required(),
    dest_lat: Joi.number().min(-90).max(90).required(),
    dest_lng: Joi.number().min(-180).max(180).required(),
    dest_address: Joi.string().max(500).required(),
    waypoints: Joi.array().items(
      Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required(),
        address: Joi.string().required(),
        order: Joi.number().integer().required(),
      })
    ).optional(),
    payment_method_id: Joi.string().uuid().optional(),
    coupon_id: Joi.string().uuid().optional(),
    is_scheduled: Joi.boolean().optional(),
    scheduled_at: Joi.date().iso().optional(),
  }),

  registerDriver: Joi.object({
    license_number: Joi.string().required(),
    license_expiry: Joi.date().iso().optional(),
    vehicle_number: Joi.string().required(),
    vehicle_model: Joi.string().required(),
    vehicle_color: Joi.string().optional(),
    vehicle_year: Joi.number().integer().optional(),
  }),

  addPaymentMethod: Joi.object({
    type: Joi.string().valid('CARD', 'KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY').required(),
    billing_key: Joi.string().required(),
    display_name: Joi.string().optional(),
    card_company: Joi.string().optional(),
    last_four: Joi.string().length(4).optional(),
  }),

  submitReview: Joi.object({
    ride_id: Joi.string().uuid().required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(500).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
  }),

  applyCoupon: Joi.object({
    code: Joi.string().required(),
  }),
};

module.exports = { validate, schemas };
