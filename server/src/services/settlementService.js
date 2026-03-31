const { Op } = require('sequelize');
const { Ride, Payment, Driver } = require('../models');

const COMMISSION_RATE = 0.20; // 플랫폼 수수료 20%

/**
 * 기사 정산 요약 조회
 */
async function getDriverSettlement(driverId, startDate, endDate) {
  const rides = await Ride.findAll({
    where: {
      driver_id: driverId,
      status: 'COMPLETED',
      completed_at: { [Op.between]: [startDate, endDate] },
    },
    include: [{
      model: Payment,
      as: 'payment',
      where: { status: 'COMPLETED' },
      required: false,
    }],
    order: [['completed_at', 'DESC']],
  });

  let totalFare = 0;
  let totalCommission = 0;
  let cashAmount = 0;
  let cardAmount = 0;

  const details = rides.map((ride) => {
    const fare = ride.final_fare || 0;
    const commission = Math.floor(fare * COMMISSION_RATE);
    const driverEarning = fare - commission;

    totalFare += fare;
    totalCommission += commission;

    if (ride.payment?.method_type === 'CASH') {
      cashAmount += fare;
    } else {
      cardAmount += fare;
    }

    return {
      ride_id: ride.id,
      date: ride.completed_at,
      fare,
      commission,
      driver_earning: driverEarning,
      payment_method: ride.payment?.method_type || 'UNKNOWN',
      distance_km: ride.distance_km,
    };
  });

  return {
    period: { start: startDate, end: endDate },
    summary: {
      total_rides: rides.length,
      total_fare: totalFare,
      total_commission: totalCommission,
      net_earning: totalFare - totalCommission,
      cash_amount: cashAmount,
      card_amount: cardAmount,
      // 카드 결제분은 정산 후 지급, 현금은 기사가 보유
      payout_amount: cardAmount - Math.floor(cardAmount * COMMISSION_RATE),
    },
    details,
  };
}

/**
 * 일일 정산 처리 (배치)
 */
async function processDailySettlement(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const drivers = await Driver.findAll({ where: { is_approved: true } });
  const results = [];

  for (const driver of drivers) {
    const settlement = await getDriverSettlement(driver.id, startOfDay, endOfDay);
    if (settlement.summary.total_rides > 0) {
      // 총 수익 누적 업데이트
      await Driver.update(
        {
          total_earnings: driver.total_earnings + settlement.summary.net_earning,
        },
        { where: { id: driver.id } }
      );
      results.push({ driver_id: driver.id, ...settlement.summary });
    }
  }

  return results;
}

module.exports = { getDriverSettlement, processDailySettlement, COMMISSION_RATE };
