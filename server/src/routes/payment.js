const express = require('express');
const router = express.Router();
const { PaymentMethod, Payment } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { issueBillingKey, cancelPayment } = require('../services/paymentService');

/**
 * GET /api/payments/methods - 결제 수단 목록
 */
router.get('/methods', authenticate, async (req, res) => {
  try {
    const methods = await PaymentMethod.findAll({
      where: { user_id: req.user.id, is_active: true },
      order: [['is_default', 'DESC'], ['created_at', 'DESC']],
    });
    res.json({ methods });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * POST /api/payments/methods - 결제 수단 등록
 */
router.post('/methods', authenticate, validate(schemas.addPaymentMethod), async (req, res) => {
  try {
    const { type, billing_key, display_name, card_company, last_four } = req.body;

    // 기존 기본 결제 수단이 없으면 기본으로 설정
    const existingDefault = await PaymentMethod.findOne({
      where: { user_id: req.user.id, is_default: true, is_active: true },
    });

    const method = await PaymentMethod.create({
      user_id: req.user.id,
      type,
      billing_key,
      display_name,
      card_company,
      last_four,
      is_default: !existingDefault,
    });

    res.status(201).json({ success: true, method });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: '결제 수단 등록에 실패했습니다.' });
  }
});

/**
 * POST /api/payments/methods/billing-key - 빌링키 발급 (카드 등록 완료)
 */
router.post('/methods/billing-key', authenticate, async (req, res) => {
  try {
    const { authKey, customerKey } = req.body;

    const result = await issueBillingKey(authKey, customerKey || req.user.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const method = await PaymentMethod.create({
      user_id: req.user.id,
      type: 'CARD',
      billing_key: result.billingKey,
      card_company: result.card.company,
      last_four: result.card.number?.slice(-4),
      display_name: `${result.card.company} **** ${result.card.number?.slice(-4)}`,
      is_default: true,
    });

    // 기존 기본 해제
    await PaymentMethod.update(
      { is_default: false },
      { where: { user_id: req.user.id, id: { $ne: method.id } } }
    );

    res.status(201).json({ success: true, method });
  } catch (error) {
    res.status(500).json({ error: '카드 등록에 실패했습니다.' });
  }
});

/**
 * PATCH /api/payments/methods/:id/default - 기본 결제 수단 변경
 */
router.patch('/methods/:id/default', authenticate, async (req, res) => {
  try {
    await PaymentMethod.update(
      { is_default: false },
      { where: { user_id: req.user.id } }
    );

    await PaymentMethod.update(
      { is_default: true },
      { where: { id: req.params.id, user_id: req.user.id } }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '변경에 실패했습니다.' });
  }
});

/**
 * DELETE /api/payments/methods/:id - 결제 수단 삭제
 */
router.delete('/methods/:id', authenticate, async (req, res) => {
  try {
    await PaymentMethod.update(
      { is_active: false },
      { where: { id: req.params.id, user_id: req.user.id } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '삭제에 실패했습니다.' });
  }
});

/**
 * GET /api/payments/history - 결제 내역
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const payments = await Payment.findAndCountAll({
      where: { user_id: req.user.id },
      limit: Math.min(parseInt(limit), 50),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']],
      include: [{ model: PaymentMethod, as: 'method', attributes: ['type', 'display_name'] }],
    });

    res.json({
      payments: payments.rows,
      total: payments.count,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ error: '조회에 실패했습니다.' });
  }
});

/**
 * POST /api/payments/:id/refund - 환불 요청
 */
router.post('/:id/refund', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment || payment.user_id !== req.user.id) {
      return res.status(404).json({ error: '결제 내역을 찾을 수 없습니다.' });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({ error: '완료된 결제만 환불할 수 있습니다.' });
    }

    const { reason, amount } = req.body;

    if (payment.pg_payment_key) {
      const result = await cancelPayment(payment.pg_payment_key, reason, amount);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
    }

    await payment.update({
      status: amount && amount < payment.final_amount ? 'PARTIAL_REFUND' : 'REFUNDED',
      refund_amount: amount || payment.final_amount,
      refund_reason: reason,
      refunded_at: new Date(),
    });

    res.json({ success: true, payment: await payment.reload() });
  } catch (error) {
    res.status(500).json({ error: '환불 처리에 실패했습니다.' });
  }
});

module.exports = router;
