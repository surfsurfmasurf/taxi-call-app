// API Client for Taxi App POC
const API = {
  baseUrl: window.location.origin + '/api',
  token: localStorage.getItem('taxi_token'),
  refreshToken: localStorage.getItem('taxi_refresh_token'),
  user: JSON.parse(localStorage.getItem('taxi_user') || 'null'),

  // Set auth tokens
  setAuth(accessToken, refreshToken, user) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;
    localStorage.setItem('taxi_token', accessToken);
    localStorage.setItem('taxi_refresh_token', refreshToken);
    localStorage.setItem('taxi_user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    localStorage.removeItem('taxi_token');
    localStorage.removeItem('taxi_refresh_token');
    localStorage.removeItem('taxi_user');
  },

  isLoggedIn() {
    return !!this.token;
  },

  // Generic fetch wrapper with auth
  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    let res = await fetch(this.baseUrl + path, options);

    // If 401, try refreshing token
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.doRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token}`;
        options.headers = headers;
        res = await fetch(this.baseUrl + path, options);
      } else {
        this.clearAuth();
        window.location.reload();
        throw new Error('Session expired');
      }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'API Error');
    return data;
  },

  async doRefreshToken() {
    try {
      const res = await fetch(this.baseUrl + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setAuth(data.accessToken, data.refreshToken, this.user);
      return true;
    } catch { return false; }
  },

  // Shorthand methods
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // === Auth ===
  sendOtp(phone) { return this.post('/auth/otp/send', { phone }); },
  verifyOtp(phone, code, name) { return this.post('/auth/otp/verify', { phone, code, name }); },
  getMe() { return this.get('/auth/me'); },
  updateMe(data) { return this.put('/auth/me', data); },

  // === Rides ===
  estimateFare(pickup_lat, pickup_lng, dest_lat, dest_lng) {
    return this.post('/rides/estimate', { pickup_lat, pickup_lng, dest_lat, dest_lng });
  },
  requestRide(data) { return this.post('/rides', data); },
  getRide(id) { return this.get(`/rides/${id}`); },
  getRides(page = 1) { return this.get(`/rides?page=${page}`); },
  updateRideStatus(id, status, reason) { return this.patch(`/rides/${id}/status`, { status, reason }); },
  submitReview(id, rating, comment) { return this.post(`/rides/${id}/review`, { rating, comment }); },

  // === Driver ===
  registerDriver(data) { return this.post('/drivers/register', data); },
  updateDriverStatus(status, lat, lng) { return this.patch('/drivers/status', { status, lat, lng }); },
  updateLocation(lat, lng, speed, heading) { return this.post('/drivers/location', { lat, lng, speed, heading }); },
  respondToRide(ride_id, accept) { return this.post('/drivers/respond', { ride_id, accept }); },
  getSettlement(start_date, end_date) { return this.get(`/drivers/settlement?start_date=${start_date}&end_date=${end_date}`); },
  getDashboard() { return this.get('/drivers/dashboard'); },

  // === Payment ===
  getPaymentMethods() { return this.get('/payments/methods'); },
  addPaymentMethod(data) { return this.post('/payments/methods', data); },
  setDefaultPayment(id) { return this.patch(`/payments/methods/${id}/default`); },
  deletePaymentMethod(id) { return this.delete(`/payments/methods/${id}`); },
  getPaymentHistory(page = 1) { return this.get(`/payments/history?page=${page}`); },

  // === Coupons ===
  applyCoupon(code) { return this.post('/coupons/apply', { code }); },
  getMyCoupons() { return this.get('/coupons/my'); },
};

// === UI Utilities ===
const UI = {
  show(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); el.classList.remove('hidden'); }
  },
  hide(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); el.classList.add('hidden'); }
  },
  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.classList.add('hidden');
    });
    this.show(viewId);
  },
  showLoading() { this.show('loading'); },
  hideLoading() { this.hide('loading'); },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  },

  formatPhone(phone) {
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  },

  toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
  }
};

// Toast CSS injection
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateY(20px);
      padding:12px 24px; border-radius:8px; color:#fff; font-size:14px; z-index:10000;
      opacity:0; transition: all 0.3s; pointer-events:none; max-width:80%; text-align:center; }
    .toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
    .toast-info { background:#4A90D9; }
    .toast-success { background:#27AE60; }
    .toast-error { background:#E74C3C; }
    .toast-warning { background:#F39C12; }
  `;
  document.head.appendChild(style);
})();
