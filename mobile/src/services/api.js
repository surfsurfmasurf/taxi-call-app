import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터 - 토큰 자동 첨부
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 토큰 만료 시 갱신
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// === Auth API ===
export const authAPI = {
  sendOtp: (phone) => api.post('/auth/otp/send', { phone }),
  verifyOtp: (phone, code, name) => api.post('/auth/otp/verify', { phone, code, name }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
};

// === Ride API ===
export const rideAPI = {
  estimate: (pickup, dest) => api.post('/rides/estimate', {
    pickup_lat: pickup.lat, pickup_lng: pickup.lng,
    dest_lat: dest.lat, dest_lng: dest.lng,
  }),
  request: (data) => api.post('/rides', data),
  getById: (id) => api.get(`/rides/${id}`),
  getMyRides: (page = 1) => api.get(`/rides?page=${page}`),
  updateStatus: (id, status, reason) => api.patch(`/rides/${id}/status`, { status, reason }),
  submitReview: (rideId, data) => api.post(`/rides/${rideId}/review`, { ride_id: rideId, ...data }),
};

// === Driver API ===
export const driverAPI = {
  register: (data) => api.post('/drivers/register', data),
  updateStatus: (status, lat, lng) => api.patch('/drivers/status', { status, lat, lng }),
  updateLocation: (lat, lng, speed, heading) =>
    api.post('/drivers/location', { lat, lng, speed, heading }),
  respondToRide: (rideId, accept) => api.post('/drivers/respond', { ride_id: rideId, accept }),
  getSettlement: (startDate, endDate) =>
    api.get(`/drivers/settlement?start_date=${startDate}&end_date=${endDate}`),
  getDashboard: () => api.get('/drivers/dashboard'),
};

// === Payment API ===
export const paymentAPI = {
  getMethods: () => api.get('/payments/methods'),
  addMethod: (data) => api.post('/payments/methods', data),
  issueBillingKey: (authKey) => api.post('/payments/methods/billing-key', { authKey }),
  setDefault: (id) => api.patch(`/payments/methods/${id}/default`),
  deleteMethod: (id) => api.delete(`/payments/methods/${id}`),
  getHistory: (page = 1) => api.get(`/payments/history?page=${page}`),
  requestRefund: (id, reason, amount) => api.post(`/payments/${id}/refund`, { reason, amount }),
};

// === Coupon API ===
export const couponAPI = {
  apply: (code) => api.post('/coupons/apply', { code }),
  getMyCoupons: () => api.get('/coupons/my'),
};

export default api;
