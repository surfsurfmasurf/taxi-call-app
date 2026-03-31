// ============================================
// Rider App - Main JavaScript
// ============================================

(function() {
  'use strict';

  // State
  let map = null;
  let pickupMarker = null;
  let destMarker = null;
  let driverMarker = null;
  let routeLine = null;
  let currentRide = null;
  let ridePollingTimer = null;
  let selectedRating = 0;
  let pickupCoords = { lat: 37.5665, lng: 126.978 }; // default Seoul
  let destCoords = null;

  // Predefined locations for POC (clicking on map or typing)
  const PRESET_LOCATIONS = [
    { name: '서울시청', lat: 37.5665, lng: 126.978 },
    { name: '강남역', lat: 37.4979, lng: 127.0276 },
    { name: '홍대입구', lat: 37.5563, lng: 126.9236 },
    { name: '여의도역', lat: 37.5216, lng: 126.9243 },
    { name: '잠실역', lat: 37.5133, lng: 127.1001 },
    { name: '서울역', lat: 37.5547, lng: 126.9707 },
    { name: '이태원역', lat: 37.5345, lng: 126.9946 },
    { name: '명동', lat: 37.5636, lng: 126.9869 },
  ];

  // ===== INITIALIZATION =====
  document.addEventListener('DOMContentLoaded', () => {
    if (API.isLoggedIn()) {
      showMainView();
    } else {
      showLoginView();
    }
    setupEventListeners();
  });

  function setupEventListeners() {
    // Login
    const phoneInput = document.getElementById('phone-input');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    const otpInput = document.getElementById('otp-input');
    const verifyBtn = document.getElementById('verify-btn');

    phoneInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 3 && v.length <= 7) v = v.slice(0,3) + '-' + v.slice(3);
      else if (v.length > 7) v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7,11);
      e.target.value = v;
    });

    sendOtpBtn.addEventListener('click', handleSendOtp);
    otpInput.addEventListener('input', (e) => {
      verifyBtn.disabled = e.target.value.length < 6;
    });
    verifyBtn.addEventListener('click', handleVerifyOtp);

    // Map controls
    const menuBtn = document.getElementById('menu-btn');
    const myLocationBtn = document.getElementById('my-location-btn');
    menuBtn && menuBtn.addEventListener('click', toggleMenu);
    myLocationBtn && myLocationBtn.addEventListener('click', goToMyLocation);

    // Destination
    const destInput = document.getElementById('destination-input');
    const estimateBtn = document.getElementById('estimate-btn');
    const clearBtn = document.getElementById('destination-clear-btn');

    destInput && destInput.addEventListener('focus', showLocationSuggestions);
    destInput && destInput.addEventListener('input', handleDestinationInput);
    clearBtn && clearBtn.addEventListener('click', () => {
      destInput.value = '';
      clearBtn.style.display = 'none';
      destCoords = null;
      estimateBtn.disabled = true;
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      removeSuggestions();
    });

    estimateBtn && estimateBtn.addEventListener('click', handleEstimate);

    // Call taxi
    const callTaxiBtn = document.getElementById('call-taxi-btn');
    callTaxiBtn && callTaxiBtn.addEventListener('click', handleCallTaxi);

    // Payment selector
    const paymentSelector = document.getElementById('payment-selector');
    paymentSelector && paymentSelector.addEventListener('click', () => {
      const options = document.getElementById('payment-options');
      options.style.display = options.style.display === 'none' ? 'block' : 'none';
    });

    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const labels = { card: '신용/체크카드', cash: '현금', kakao: '카카오페이' };
        document.getElementById('payment-label').textContent = labels[e.target.value];
        document.getElementById('payment-options').style.display = 'none';
      });
    });

    // Cancel ride
    const cancelBtn = document.getElementById('cancel-ride-btn');
    cancelBtn && cancelBtn.addEventListener('click', handleCancelRide);

    // Star rating
    document.querySelectorAll('#star-rating .star').forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.value);
        document.querySelectorAll('#star-rating .star').forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
        });
      });
    });

    // Submit review
    const submitReviewBtn = document.getElementById('submit-review-btn');
    submitReviewBtn && submitReviewBtn.addEventListener('click', handleSubmitReview);

    // Menu
    const menuOverlay = document.getElementById('menu-overlay');
    menuOverlay && menuOverlay.addEventListener('click', toggleMenu);

    const menuLogout = document.getElementById('menu-logout');
    menuLogout && menuLogout.addEventListener('click', (e) => {
      e.preventDefault();
      API.clearAuth();
      window.location.reload();
    });

    const menuHistory = document.getElementById('menu-history');
    menuHistory && menuHistory.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
      showToast('운행 내역 기능은 준비 중입니다');
    });

    const menuPayment = document.getElementById('menu-payment');
    menuPayment && menuPayment.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
      showToast('결제 수단 관리 기능은 준비 중입니다');
    });

    const menuCoupon = document.getElementById('menu-coupon');
    menuCoupon && menuCoupon.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
      showToast('쿠폰 기능은 준비 중입니다');
    });
  }

  // ===== LOGIN =====
  function showLoginView() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('login-view').classList.add('active');
  }

  async function handleSendOtp() {
    const phone = document.getElementById('phone-input').value.replace(/\D/g, '');
    if (phone.length < 10) {
      showToast('올바른 전화번호를 입력하세요', 'error');
      return;
    }
    try {
      showLoading();
      await API.sendOtp(phone);
      document.getElementById('otp-group').classList.add('show');
      document.getElementById('otp-input').focus();
      showToast('인증번호가 발송되었습니다. 서버 로그를 확인하세요.', 'success');
    } catch (err) {
      showToast('OTP 발송 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  async function handleVerifyOtp() {
    const phone = document.getElementById('phone-input').value.replace(/\D/g, '');
    const code = document.getElementById('otp-input').value;
    const name = '승객_' + phone.slice(-4);
    try {
      showLoading();
      const result = await API.verifyOtp(phone, code, name);
      API.setAuth(result.accessToken, result.refreshToken, result.user);
      showToast('로그인 성공!', 'success');
      showMainView();
    } catch (err) {
      showToast('인증 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ===== MAIN VIEW =====
  function showMainView() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('main-view').classList.add('active');

    if (API.user) {
      document.getElementById('user-name').textContent = API.user.name || '승객';
      document.getElementById('menu-user-name').textContent = API.user.name || '승객';
      document.getElementById('menu-user-phone').textContent = API.user.phone || '';
    }

    setTimeout(initMap, 100);
    showPanel('destination');
  }

  // ===== MAP =====
  function initMap() {
    if (map) return;

    map = L.map('map', { zoomControl: false }).setView([37.5665, 126.978], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Try geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pickupCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.setView([pickupCoords.lat, pickupCoords.lng], 15);
          setPickupMarker(pickupCoords.lat, pickupCoords.lng);
        },
        () => {
          // Default to Seoul
          setPickupMarker(pickupCoords.lat, pickupCoords.lng);
        }
      );
    } else {
      setPickupMarker(pickupCoords.lat, pickupCoords.lng);
    }

    // Click on map to set destination
    map.on('click', (e) => {
      if (!currentRide) {
        setDestination(e.latlng.lat, e.latlng.lng, `위치 (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
      }
    });
  }

  function setPickupMarker(lat, lng) {
    if (pickupMarker) map.removeLayer(pickupMarker);
    pickupMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#3B82F6;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-circle" style="font-size:10px;"></i></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('출발지');
  }

  function setDestination(lat, lng, name) {
    destCoords = { lat, lng };
    document.getElementById('destination-input').value = name;
    document.getElementById('destination-clear-btn').style.display = 'block';
    document.getElementById('estimate-btn').disabled = false;

    if (destMarker) map.removeLayer(destMarker);
    destMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#EF4444;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-flag"></i></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('도착지: ' + name);

    // Draw route line
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([
      [pickupCoords.lat, pickupCoords.lng],
      [lat, lng]
    ], { color: '#3B82F6', weight: 4, dashArray: '8, 12' }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
    removeSuggestions();
  }

  function goToMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        pickupCoords = { lat: latitude, lng: longitude };
        map.setView([latitude, longitude], 15);
        setPickupMarker(latitude, longitude);
      });
    }
  }

  // ===== LOCATION SUGGESTIONS =====
  function showLocationSuggestions() {
    removeSuggestions();
    const container = document.createElement('div');
    container.id = 'location-suggestions';
    container.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;background:#fff;border-radius:12px;margin-bottom:8px;box-shadow:0 -4px 20px rgba(0,0,0,0.1);max-height:240px;overflow-y:auto;z-index:100;';

    PRESET_LOCATIONS.forEach(loc => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;align-items:center;gap:12px;';
      item.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#EF4444;"></i><div><div style="font-size:14px;font-weight:600;">${loc.name}</div><div style="font-size:12px;color:#888;">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div></div>`;
      item.addEventListener('click', () => {
        setDestination(loc.lat, loc.lng, loc.name);
      });
      container.appendChild(item);
    });

    const panel = document.getElementById('destination-panel');
    panel.style.position = 'relative';
    panel.appendChild(container);
  }

  function removeSuggestions() {
    const el = document.getElementById('location-suggestions');
    if (el) el.remove();
  }

  function handleDestinationInput(e) {
    const val = e.target.value.trim().toLowerCase();
    document.getElementById('destination-clear-btn').style.display = val ? 'block' : 'none';

    // Filter suggestions
    const container = document.getElementById('location-suggestions');
    if (!container) return;
    container.innerHTML = '';

    const filtered = PRESET_LOCATIONS.filter(l => l.name.toLowerCase().includes(val));
    filtered.forEach(loc => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;align-items:center;gap:12px;';
      item.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#EF4444;"></i><div><div style="font-size:14px;font-weight:600;">${loc.name}</div></div>`;
      item.addEventListener('click', () => setDestination(loc.lat, loc.lng, loc.name));
      container.appendChild(item);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding:14px 16px;color:#888;text-align:center;">지도를 클릭하여 도착지를 선택하세요</div>';
    }
  }

  // ===== FARE ESTIMATE =====
  async function handleEstimate() {
    if (!destCoords) return;
    try {
      showLoading();
      const result = await API.estimateFare(
        pickupCoords.lat, pickupCoords.lng,
        destCoords.lat, destCoords.lng
      );

      const fare = result.fare || result;
      document.getElementById('est-fare').textContent =
        (fare.total || fare.estimated_fare || 0).toLocaleString();
      document.getElementById('est-distance').textContent =
        (result.estimated_distance_km || fare.distance_km || 0).toFixed(1);
      document.getElementById('est-duration').textContent =
        Math.round(result.estimated_duration_min || fare.duration_min || 0);

      showPanel('estimate');
    } catch (err) {
      showToast('요금 조회 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ===== CALL TAXI =====
  async function handleCallTaxi() {
    if (!destCoords) return;
    try {
      showLoading();
      const destName = document.getElementById('destination-input').value;
      const result = await API.requestRide({
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        pickup_address: '현재 위치',
        dest_lat: destCoords.lat,
        dest_lng: destCoords.lng,
        dest_address: destName
      });

      currentRide = result.ride;
      showPanel('ride-status');
      updateRideStatus('REQUESTED');
      startRidePolling();
      showToast('택시를 호출중입니다...', 'info');
    } catch (err) {
      showToast('호출 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ===== RIDE STATUS =====
  function startRidePolling() {
    stopRidePolling();
    ridePollingTimer = setInterval(async () => {
      if (!currentRide) return;
      try {
        const result = await API.getRide(currentRide.id);
        const ride = result.ride || result;
        currentRide = ride;
        updateRideStatus(ride.status);

        // Update driver info if matched
        if (ride.driver && ride.status !== 'REQUESTED') {
          showDriverInfo(ride.driver);
        }

        // Update driver position on map
        if (ride.driver) {
          updateDriverOnMap(ride.driver);
        }

        if (ride.status === 'COMPLETED') {
          stopRidePolling();
          showPanel('ride-complete');
          document.getElementById('final-fare-amount').textContent =
            (ride.final_fare || ride.estimated_fare || 0).toLocaleString();
        }

        if (ride.status === 'CANCELLED') {
          stopRidePolling();
          showPanel('destination');
          currentRide = null;
          showToast('운행이 취소되었습니다', 'warning');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }

  function stopRidePolling() {
    if (ridePollingTimer) {
      clearInterval(ridePollingTimer);
      ridePollingTimer = null;
    }
  }

  function updateRideStatus(status) {
    const statusMap = {
      'REQUESTED': { step: 'searching', icon: 'fa-search', title: '호출중', subtitle: '주변 택시를 찾고 있습니다...' },
      'MATCHED': { step: 'matched', icon: 'fa-check', title: '배차 완료', subtitle: '기사님이 출발지로 이동 중입니다' },
      'ARRIVING': { step: 'arriving', icon: 'fa-car', title: '기사님 이동 중', subtitle: '곧 도착합니다' },
      'PICKUP': { step: 'pickup', icon: 'fa-hand-paper', title: '승객 탑승', subtitle: '기사님이 도착했습니다' },
      'IN_PROGRESS': { step: 'in-progress', icon: 'fa-road', title: '운행 중', subtitle: '목적지로 이동 중입니다' },
      'COMPLETED': { step: 'arrived', icon: 'fa-flag-checkered', title: '도착!', subtitle: '목적지에 도착했습니다' }
    };

    const info = statusMap[status];
    if (!info) return;

    document.getElementById('status-icon').innerHTML = `<i class="fas ${info.icon}"></i>`;
    document.getElementById('status-title').textContent = info.title;
    document.getElementById('status-subtitle').textContent = info.subtitle;

    // Hide cancel button after pickup
    const cancelBtn = document.getElementById('cancel-ride-btn');
    if (['IN_PROGRESS', 'COMPLETED'].includes(status)) {
      cancelBtn.style.display = 'none';
    } else {
      cancelBtn.style.display = 'block';
    }

    // Update progress steps
    const steps = ['searching', 'matched', 'arriving', 'pickup', 'in-progress', 'arrived'];
    const currentIdx = steps.indexOf(info.step);

    document.querySelectorAll('.status-step').forEach((stepEl, idx) => {
      const dot = stepEl.querySelector('.step-dot');
      const label = stepEl.querySelector('.step-label');
      dot.classList.remove('active', 'completed');
      label.classList.remove('active', 'completed');

      if (idx < currentIdx) {
        dot.classList.add('completed');
        label.classList.add('completed');
      } else if (idx === currentIdx) {
        dot.classList.add('active');
        label.classList.add('active');
      }
    });
  }

  function showDriverInfo(driver) {
    const container = document.getElementById('driver-info');
    container.style.display = 'block';
    document.getElementById('driver-name').textContent = driver.user?.name || driver.name || '기사님';
    document.getElementById('car-info').textContent =
      `${driver.vehicle_model || '차량'} · ${driver.vehicle_color || ''}`;
    document.getElementById('plate-number').textContent = driver.vehicle_number || '';
  }

  function updateDriverOnMap(driver) {
    if (!driver.lat && !driver.current_lat) return;
    const lat = driver.lat || driver.current_lat;
    const lng = driver.lng || driver.current_lng;
    if (!lat || !lng) return;

    if (driverMarker) map.removeLayer(driverMarker);
    driverMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'driver-marker',
        html: '<div style="background:#22C55E;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid #fff;"><i class="fas fa-taxi"></i></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
    }).addTo(map);
  }

  // ===== CANCEL RIDE =====
  async function handleCancelRide() {
    if (!currentRide) return;
    if (!confirm('정말 호출을 취소하시겠습니까?')) return;
    try {
      showLoading();
      await API.updateRideStatus(currentRide.id, 'CANCELLED', '승객 취소');
      stopRidePolling();
      currentRide = null;
      if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
      showPanel('destination');
      showToast('호출이 취소되었습니다', 'info');
    } catch (err) {
      showToast('취소 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ===== REVIEW =====
  async function handleSubmitReview() {
    if (!currentRide) return;
    if (selectedRating === 0) {
      showToast('별점을 선택해주세요', 'warning');
      return;
    }
    try {
      showLoading();
      const comment = document.getElementById('review-comment').value;
      await API.submitReview(currentRide.id, selectedRating, comment);
      showToast('평가가 완료되었습니다. 감사합니다!', 'success');

      // Reset
      currentRide = null;
      selectedRating = 0;
      document.querySelectorAll('#star-rating .star').forEach(s => s.classList.remove('active'));
      document.getElementById('review-comment').value = '';
      if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      destCoords = null;
      document.getElementById('destination-input').value = '';

      showPanel('destination');
    } catch (err) {
      showToast('평가 실패: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  }

  // ===== PANEL MANAGEMENT =====
  function showPanel(name) {
    const panels = ['destination-panel', 'estimate-panel', 'ride-status', 'ride-complete'];
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.classList.remove('show');
      }
    });

    const map = {
      'destination': 'destination-panel',
      'estimate': 'estimate-panel',
      'ride-status': 'ride-status',
      'ride-complete': 'ride-complete'
    };

    const targetId = map[name];
    if (targetId) {
      const el = document.getElementById(targetId);
      el.style.display = 'block';
      el.classList.add('show');
    }
  }

  // ===== MENU =====
  function toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('open');
  }

  // ===== UTILITIES =====
  function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
  }

  function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }

  function showToast(message, type) {
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }

})();
