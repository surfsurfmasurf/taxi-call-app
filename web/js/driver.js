// ============================================
// Driver App - Main JavaScript
// ============================================

(function() {
  'use strict';

  // State
  let map = null;
  let activeRideMap = null;
  let myMarker = null;
  let passengerMarker = null;
  let destMarker = null;
  let routeLine = null;
  let currentRide = null;
  let isOnline = false;
  let locationWatchId = null;
  let locationUpdateTimer = null;
  let rideCheckTimer = null;
  let countdownTimer = null;
  let countdownValue = 15;
  let currentPosition = { lat: 37.5665, lng: 126.978 };
  let driverInfo = null;

  // ===== INITIALIZATION =====
  document.addEventListener('DOMContentLoaded', () => {
    hideSpinner();
    if (API.isLoggedIn()) {
      checkDriverRegistration();
    } else {
      showView('login-view');
    }
    setupEventListeners();
  });

  function setupEventListeners() {
    // Login
    document.getElementById('btn-send-otp').addEventListener('click', handleSendOtp);
    document.getElementById('btn-verify-otp').addEventListener('click', handleVerifyOtp);
    document.getElementById('login-phone').addEventListener('input', formatPhoneInput);

    // Registration
    document.getElementById('btn-register').addEventListener('click', handleRegister);
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // Main view
    document.getElementById('status-toggle').addEventListener('click', handleToggleStatus);
    document.getElementById('btn-menu').addEventListener('click', toggleSideMenu);

    // Ride request
    document.getElementById('btn-accept').addEventListener('click', () => handleRideResponse(true));
    document.getElementById('btn-reject').addEventListener('click', () => handleRideResponse(false));

    // Active ride actions
    document.getElementById('btn-arrived').addEventListener('click', () => updateRideAction('PICKUP'));
    document.getElementById('btn-picked-up').addEventListener('click', () => updateRideAction('PICKUP'));
    document.getElementById('btn-start-ride').addEventListener('click', () => updateRideAction('IN_PROGRESS'));
    document.getElementById('btn-complete-ride').addEventListener('click', () => updateRideAction('COMPLETED'));

    // Side menu
    document.getElementById('side-menu-overlay').addEventListener('click', toggleSideMenu);
    document.getElementById('menu-dashboard').addEventListener('click', () => { toggleSideMenu(); showView('main-view'); });
    document.getElementById('menu-logout').addEventListener('click', handleLogout);
    document.getElementById('menu-settlements').addEventListener('click', () => { toggleSideMenu(); showDriverToast('정산 내역 기능 준비 중'); });
    document.getElementById('menu-history').addEventListener('click', () => { toggleSideMenu(); showDriverToast('운행 기록 기능 준비 중'); });
  }

  // ===== LOGIN =====
  function formatPhoneInput(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 3 && v.length <= 7) v = v.slice(0,3) + '-' + v.slice(3);
    else if (v.length > 7) v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7,11);
    e.target.value = v;
  }

  async function handleSendOtp() {
    const phone = document.getElementById('login-phone').value.replace(/\D/g, '');
    if (phone.length < 10) {
      showDriverToast('올바른 전화번호를 입력하세요');
      return;
    }
    try {
      showSpinner();
      await API.sendOtp(phone);
      document.getElementById('otp-section').classList.add('visible');
      document.getElementById('login-otp').focus();
      showDriverToast('인증번호가 발송되었습니다');
    } catch (err) {
      showDriverToast('OTP 발송 실패: ' + err.message);
    } finally {
      hideSpinner();
    }
  }

  async function handleVerifyOtp() {
    const phone = document.getElementById('login-phone').value.replace(/\D/g, '');
    const code = document.getElementById('login-otp').value;
    if (!code || code.length < 4) {
      showDriverToast('인증번호를 입력하세요');
      return;
    }
    try {
      showSpinner();
      const name = '기사_' + phone.slice(-4);
      const result = await API.verifyOtp(phone, code, name);
      API.setAuth(result.accessToken, result.refreshToken, result.user);
      showDriverToast('로그인 성공!');
      checkDriverRegistration();
    } catch (err) {
      showDriverToast('인증 실패: ' + err.message);
    } finally {
      hideSpinner();
    }
  }

  // ===== DRIVER REGISTRATION =====
  async function checkDriverRegistration() {
    try {
      showSpinner();
      const result = await API.getMe();
      const user = result.user;

      if (user.type === 'DRIVER' && result.driver) {
        driverInfo = result.driver;
        showMainView(user);
      } else {
        showView('register-view');
      }
    } catch (err) {
      showDriverToast('정보 로딩 실패: ' + err.message);
      showView('login-view');
    } finally {
      hideSpinner();
    }
  }

  async function handleRegister() {
    const license = document.getElementById('reg-license').value.trim();
    const vehicleNumber = document.getElementById('reg-vehicle-number').value.trim();
    const vehicleModel = document.getElementById('reg-vehicle-model').value.trim();
    const colorEl = document.querySelector('.color-option.selected');
    const vehicleColor = colorEl ? colorEl.dataset.color : 'white';

    const colorNames = { white: '흰색', black: '검정', silver: '은색', red: '빨강', blue: '파랑', yellow: '노랑' };

    if (!license || !vehicleNumber || !vehicleModel) {
      showDriverToast('모든 필드를 입력해주세요');
      return;
    }

    try {
      showSpinner();
      const result = await API.registerDriver({
        license_number: license,
        vehicle_number: vehicleNumber,
        vehicle_model: vehicleModel,
        vehicle_color: colorNames[vehicleColor] || vehicleColor
      });
      driverInfo = result.driver;
      showDriverToast('기사 등록 완료!');

      // Re-fetch user info
      const me = await API.getMe();
      API.setAuth(API.token, API.refreshToken, me.user);
      showMainView(me.user);
    } catch (err) {
      showDriverToast('등록 실패: ' + err.message);
    } finally {
      hideSpinner();
    }
  }

  // ===== MAIN VIEW =====
  function showMainView(user) {
    showView('main-view');

    const name = user?.name || API.user?.name || '기사님';
    document.getElementById('driver-name').textContent = name;
    document.getElementById('menu-driver-name').textContent = name;
    document.getElementById('menu-driver-phone').textContent = user?.phone || API.user?.phone || '';

    setTimeout(initDriverMap, 100);
    loadDashboard();
  }

  function initDriverMap() {
    if (map) { map.invalidateSize(); return; }

    map = L.map('driver-map', { zoomControl: false }).setView([37.5665, 126.978], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.setView([currentPosition.lat, currentPosition.lng], 15);
          updateMyMarker();
        },
        () => updateMyMarker()
      );
    } else {
      updateMyMarker();
    }
  }

  function updateMyMarker() {
    if (myMarker) map.removeLayer(myMarker);
    const color = isOnline ? '#00b894' : '#b2bec3';
    myMarker = L.marker([currentPosition.lat, currentPosition.lng], {
      icon: L.divIcon({
        className: 'driver-marker',
        html: `<div style="background:${color};color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.3);border:3px solid #fff;"><i class="fas fa-taxi"></i></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(map);
  }

  async function loadDashboard() {
    try {
      const data = await API.getDashboard();
      const today = data.today || {};
      document.getElementById('stat-rides').textContent = (today.rides || 0) + '건';
      document.getElementById('stat-earnings').textContent = '₩' + (today.earnings || 0).toLocaleString();

      const driver = data.driver || {};
      document.getElementById('stat-rating').textContent =
        driver.rating ? parseFloat(driver.rating).toFixed(1) + '★' : '-';
    } catch (err) {
      console.log('Dashboard load error:', err);
    }
  }

  // ===== STATUS TOGGLE =====
  async function handleToggleStatus() {
    const newStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';
    try {
      await API.updateDriverStatus(newStatus, currentPosition.lat, currentPosition.lng);
      isOnline = !isOnline;
      updateStatusUI();

      if (isOnline) {
        startLocationTracking();
        startRideChecking();
        showDriverToast('운행을 시작합니다. 호출을 기다리는 중...');
      } else {
        stopLocationTracking();
        stopRideChecking();
        showDriverToast('운행을 종료합니다');
      }
    } catch (err) {
      showDriverToast('상태 변경 실패: ' + err.message);
    }
  }

  function updateStatusUI() {
    const toggle = document.getElementById('status-toggle');
    const badge = document.getElementById('status-badge');

    toggle.classList.toggle('on', isOnline);
    toggle.setAttribute('aria-checked', isOnline);

    badge.className = 'status-badge ' + (isOnline ? 'available' : 'offline');
    badge.textContent = isOnline ? 'AVAILABLE' : 'OFFLINE';

    updateMyMarker();
  }

  // ===== LOCATION TRACKING =====
  function startLocationTracking() {
    // Watch position
    if (navigator.geolocation) {
      locationWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          updateMyMarker();
        },
        null,
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    // Send to server every 5 seconds
    locationUpdateTimer = setInterval(async () => {
      try {
        await API.updateLocation(currentPosition.lat, currentPosition.lng);
      } catch (err) {
        console.log('Location update error:', err);
      }
    }, 5000);
  }

  function stopLocationTracking() {
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }
    if (locationUpdateTimer) {
      clearInterval(locationUpdateTimer);
      locationUpdateTimer = null;
    }
  }

  // ===== RIDE CHECKING (POLLING) =====
  function startRideChecking() {
    stopRideChecking();
    rideCheckTimer = setInterval(async () => {
      try {
        const result = await API.getRides(1);
        const rides = result.rides || [];
        const requested = rides.find(r => r.status === 'REQUESTED');
        if (requested && !currentRide) {
          showRideRequest(requested);
        }
      } catch (err) {
        console.log('Ride check error:', err);
      }
    }, 5000);
  }

  function stopRideChecking() {
    if (rideCheckTimer) {
      clearInterval(rideCheckTimer);
      rideCheckTimer = null;
    }
  }

  // ===== RIDE REQUEST POPUP =====
  function showRideRequest(ride) {
    currentRide = ride;

    document.getElementById('request-pickup').textContent = ride.pickup_address || '출발지';
    document.getElementById('request-destination').textContent = ride.dest_address || '도착지';
    document.getElementById('request-fare').textContent = '₩' + (ride.estimated_fare || 0).toLocaleString();

    // Calculate distance from current position to pickup
    const dist = calculateDistance(
      currentPosition.lat, currentPosition.lng,
      ride.pickup_lat, ride.pickup_lng
    );
    document.getElementById('request-distance').textContent = dist.toFixed(1) + 'km';

    // Show popup
    document.getElementById('ride-request').classList.add('active');
    startCountdown();
  }

  function startCountdown() {
    countdownValue = 15;
    updateCountdownDisplay();

    const progressCircle = document.getElementById('countdown-progress');
    const circumference = 2 * Math.PI * 20; // r=20
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = 0;

    countdownTimer = setInterval(() => {
      countdownValue--;
      updateCountdownDisplay();

      const offset = circumference * (1 - countdownValue / 15);
      progressCircle.style.strokeDashoffset = offset;

      if (countdownValue <= 0) {
        clearInterval(countdownTimer);
        handleRideResponse(false); // Auto-reject
      }
    }, 1000);
  }

  function updateCountdownDisplay() {
    document.getElementById('countdown-text').textContent = countdownValue;
  }

  async function handleRideResponse(accept) {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    document.getElementById('ride-request').classList.remove('active');

    if (!currentRide) return;

    try {
      showSpinner();
      await API.respondToRide(currentRide.id, accept);

      if (accept) {
        showDriverToast('호출을 수락했습니다!');
        stopRideChecking();
        showActiveRide();
      } else {
        showDriverToast('호출을 거절했습니다');
        currentRide = null;
      }
    } catch (err) {
      showDriverToast('응답 실패: ' + err.message);
      currentRide = null;
    } finally {
      hideSpinner();
    }
  }

  // ===== ACTIVE RIDE =====
  function showActiveRide() {
    showView('active-ride');

    const ride = currentRide;
    document.getElementById('ride-passenger-name').textContent = ride.rider?.name || '승객';
    document.getElementById('passenger-name').textContent = ride.rider?.name || '승객';
    document.getElementById('passenger-pickup-address').textContent = ride.pickup_address || '';
    document.getElementById('nav-fare').textContent = '₩' + (ride.estimated_fare || 0).toLocaleString();

    const dist = calculateDistance(
      currentPosition.lat, currentPosition.lng,
      ride.pickup_lat, ride.pickup_lng
    );
    document.getElementById('nav-distance').textContent = dist.toFixed(1) + 'km';
    document.getElementById('nav-time').textContent = Math.round(dist * 3) + '분';

    updateRideActionButtons('MATCHED');
    updateRideStatusLabel('MATCHED');

    setTimeout(initActiveRideMap, 200);
  }

  function initActiveRideMap() {
    if (activeRideMap) {
      activeRideMap.invalidateSize();
      return;
    }

    activeRideMap = L.map('active-ride-map', { zoomControl: false }).setView([currentPosition.lat, currentPosition.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(activeRideMap);

    if (currentRide) {
      // My position
      L.marker([currentPosition.lat, currentPosition.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#00b894;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid #fff;"><i class="fas fa-taxi"></i></div>',
          iconSize: [36, 36], iconAnchor: [18, 18]
        })
      }).addTo(activeRideMap);

      // Pickup
      passengerMarker = L.marker([currentRide.pickup_lat, currentRide.pickup_lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#0984e3;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-user"></i></div>',
          iconSize: [32, 32], iconAnchor: [16, 16]
        })
      }).addTo(activeRideMap).bindPopup('승객 위치');

      // Destination
      if (currentRide.dest_lat) {
        destMarker = L.marker([currentRide.dest_lat, currentRide.dest_lng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="background:#d63031;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-flag"></i></div>',
            iconSize: [32, 32], iconAnchor: [16, 16]
          })
        }).addTo(activeRideMap).bindPopup('목적지');
      }

      // Route line
      const points = [[currentPosition.lat, currentPosition.lng], [currentRide.pickup_lat, currentRide.pickup_lng]];
      if (currentRide.dest_lat) points.push([currentRide.dest_lat, currentRide.dest_lng]);
      routeLine = L.polyline(points, { color: '#0984e3', weight: 4, dashArray: '8, 12' }).addTo(activeRideMap);
      activeRideMap.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    }
  }

  async function updateRideAction(status) {
    if (!currentRide) return;
    try {
      showSpinner();
      await API.updateRideStatus(currentRide.id, status);

      updateRideActionButtons(status);
      updateRideStatusLabel(status);

      if (status === 'COMPLETED') {
        showDriverToast('운행이 완료되었습니다!');
        setTimeout(() => {
          currentRide = null;
          if (activeRideMap) { activeRideMap.remove(); activeRideMap = null; }
          showMainView(API.user);
          if (isOnline) startRideChecking();
          loadDashboard();
        }, 2000);
      } else {
        const messages = {
          'PICKUP': '승객 위치에 도착했습니다',
          'IN_PROGRESS': '운행을 시작합니다'
        };
        showDriverToast(messages[status] || '상태가 업데이트되었습니다');
      }
    } catch (err) {
      showDriverToast('상태 변경 실패: ' + err.message);
    } finally {
      hideSpinner();
    }
  }

  function updateRideActionButtons(status) {
    const buttons = {
      'MATCHED': 'btn-arrived',
      'ARRIVING': 'btn-arrived',
      'PICKUP': 'btn-start-ride',
      'IN_PROGRESS': 'btn-complete-ride'
    };

    document.querySelectorAll('.ride-action-btn').forEach(btn => btn.classList.remove('current'));
    const activeBtn = buttons[status];
    if (activeBtn) {
      document.getElementById(activeBtn).classList.add('current');
    }
  }

  function updateRideStatusLabel(status) {
    const labels = {
      'MATCHED': '승객에게 이동 중',
      'ARRIVING': '승객에게 이동 중',
      'PICKUP': '승객 탑승 대기',
      'IN_PROGRESS': '운행 중',
      'COMPLETED': '운행 완료'
    };
    const label = document.getElementById('ride-status-label');
    if (label) label.textContent = labels[status] || status;
  }

  // ===== SIDE MENU =====
  function toggleSideMenu() {
    document.getElementById('side-menu').classList.toggle('open');
    document.getElementById('side-menu-overlay').classList.toggle('active');
  }

  function handleLogout() {
    stopLocationTracking();
    stopRideChecking();
    API.clearAuth();
    window.location.reload();
  }

  // ===== UTILITY =====
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
  }

  function showSpinner() {
    const el = document.getElementById('loading-spinner');
    if (el) el.classList.remove('hidden');
  }

  function hideSpinner() {
    const el = document.getElementById('loading-spinner');
    if (el) el.classList.add('hidden');
  }

  function showDriverToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

})();
