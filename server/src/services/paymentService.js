const axios = require('axios');
const { Payment, PaymentMethod, Ride } = require('../models');

const TOSS_API_URL = process.env.TOSS_API_URL || 'https://api.tosspayments.com/v1';

/**
 * 토스페이먼츠 API 호출용 헤더
 */
function getTossHeaders() {
  const secretKey = process.env.TOSS_SECRET_KEY;
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 빌링키 발급 (카드 등록)
 * 클라이언트에서 authKey를 받아 빌링키를 발급받음
 */
async function issueBillingKey(authKey, customerKey) {
  try {
    const response = await axios.post(
      `${TOSS_API_URL}/billing/authorizations/issue`,
      { authKey, customerKey },
      { headers: getTossHeaders() }
    );
    return {
      success: true,
      billingKey: response.data.billingKey,
      card: {
        company: response.data.card?.issuerCode,
        number: response.data.card?.number, // 마스킹된 번호
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || '빌링키 발급 실패',
    };
  }
}

/**
 * 빌링키로 자동결제 (운행 완료 후)
 */
async function chargeByBillingKey(billingKey, orderId, amount, orderName) {
  try {
    const response = await axios.post(
      `${TOSS_API_URL}/billing/${billingKey}`,
      {
        customerKey: orderId.split('_')[0],
        amount,
        orderId,
        orderName,
      },
      { headers: getTossHeaders() }
    );

    return {
      success: true,
      paymentKey: response.data.paymentKey,
      transactionId: response.data.transactionKey,
      approvedAt: response.data.approvedAt,
      receipt: response.data.receipt?.url,
      rawResponse: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || '결제 실패',
      code: error.response?.data?.code,
    };
  }
}

/**
 * 결제 취소/환불
 */
async function cancelPayment(paymentKey, cancelReason, cancelAmount = null) {
  try {
    const body = { cancelReason };
    if (cancelAmount) body.cancelAmount = cancelAmount;

    const response = await axios.post(
      `${TOSS_API_URL}/payments/${paymentKey}/cancel`,
      body,
      { headers: getTossHeaders() }
    );

    return {
      success: true,
      cancels: response.data.cancels,
      rawResponse: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || '환불 실패',
    };
  }
}

/**
 * 운행 완료 후 결제 처리
 */
async function processRidePayment(rideId) {
  const ride = await Ride.findByPk(rideId);
  if (!ride || ride.status !== 'COMPLETED') {
    throw new Error('유효하지 않은 운행입니다.');
  }

  // 결제 수단 조회
  const paymentMethod = await PaymentMethod.findOne({
    where: { user_id: ride.rider_id, is_default: true, is_active: true },
  });

  if (!paymentMethod) {
    // 현금 결제로 처리
    const payment = await Payment.create({
      ride_id: rideId,
      user_id: ride.rider_id,
      amount: ride.final_fare,
      discount_amount: ride.discount_amount || 0,
      final_amount: ride.final_fare - (ride.discount_amount || 0),
      method_type: 'CASH',
      status: 'PENDING',
    });
    return { success: true, payment, method: 'CASH' };
  }

  const orderId = `${ride.rider_id}_${rideId}_${Date.now()}`;
  const finalAmount = ride.final_fare - (ride.discount_amount || 0);

  // PG사 결제 요청
  const pgResult = await chargeByBillingKey(
    paymentMethod.billing_key,
    orderId,
    finalAmount,
    `택시 운행료 (${ride.distance_km?.toFixed(1)}km)`
  );

  // 결제 내역 저장
  const payment = await Payment.create({
    ride_id: rideId,
    user_id: ride.rider_id,
    payment_method_id: paymentMethod.id,
    amount: ride.final_fare,
    discount_amount: ride.discount_amount || 0,
    final_amount: finalAmount,
    method_type: paymentMethod.type,
    pg_transaction_id: pgResult.transactionId,
    pg_payment_key: pgResult.paymentKey,
    pg_order_id: orderId,
    pg_response: pgResult.rawResponse,
    status: pgResult.success ? 'COMPLETED' : 'FAILED',
    paid_at: pgResult.success ? new Date() : null,
  });

  return { success: pgResult.success, payment, pgResult };
}

module.exports = {
  issueBillingKey,
  chargeByBillingKey,
  cancelPayment,
  processRidePayment,
};
