const admin = require('firebase-admin');
const { User } = require('../models');

// Firebase 초기화
let firebaseInitialized = false;
function initFirebase() {
  if (firebaseInitialized) return;
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    firebaseInitialized = true;
  }
}

/**
 * 단일 사용자에게 푸시 알림 전송
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    initFirebase();
    const user = await User.findByPk(userId);
    if (!user?.fcm_token) return { success: false, reason: 'NO_FCM_TOKEN' };

    const message = {
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      token: user.fcm_token,
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'taxi_ride' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    const result = await admin.messaging().send(message);
    return { success: true, messageId: result };
  } catch (error) {
    console.error('Push notification error:', error.message);
    return { success: false, error: error.message };
  }
}

// 알림 템플릿
const notifications = {
  rideMatched: (driverName, vehicleNumber) => ({
    title: '기사가 배정되었습니다',
    body: `${driverName} 기사님 (${vehicleNumber})이 이동 중입니다.`,
  }),

  driverArrived: () => ({
    title: '기사가 도착했습니다',
    body: '탑승 위치에서 기사님을 만나주세요.',
  }),

  rideStarted: () => ({
    title: '운행이 시작되었습니다',
    body: '목적지로 이동합니다. 안전한 탑승 되세요.',
  }),

  rideCompleted: (fare) => ({
    title: '운행이 완료되었습니다',
    body: `요금: ${fare.toLocaleString()}원. 평가를 남겨주세요!`,
  }),

  rideCancelled: (reason) => ({
    title: '운행이 취소되었습니다',
    body: reason || '운행이 취소되었습니다.',
  }),

  newRideRequest: (pickupAddress) => ({
    title: '새로운 호출이 있습니다',
    body: `출발지: ${pickupAddress}`,
  }),

  paymentCompleted: (amount) => ({
    title: '결제가 완료되었습니다',
    body: `${amount.toLocaleString()}원이 결제되었습니다.`,
  }),

  couponReceived: (couponName) => ({
    title: '쿠폰이 발급되었습니다',
    body: `${couponName} 쿠폰이 지급되었습니다.`,
  }),
};

module.exports = { sendPushNotification, notifications };
