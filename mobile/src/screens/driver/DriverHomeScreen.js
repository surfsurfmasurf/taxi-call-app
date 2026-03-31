import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, Switch,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { driverAPI } from '../../services/api';
import { emitGoOnline, emitGoOffline, emitDriverLocation, emitRespondRide } from '../../services/socket';

const { width, height } = Dimensions.get('window');

export default function DriverHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const mapRef = useRef(null);
  const locationSub = useRef(null);

  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [incomingRide, setIncomingRide] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const countdownTimerRef = useRef(null);

  useEffect(() => {
    loadDashboard();
    setupSocketListeners();
    return () => {
      stopLocationTracking();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (socket) {
        socket.off('ride:request');
        socket.off('driver:status_changed');
      }
    };
  }, [socket]);

  async function loadDashboard() {
    try {
      const { data } = await driverAPI.getDashboard();
      setDashboard(data);
      setIsOnline(data.driver.status === 'AVAILABLE');
    } catch (error) {
      console.error('Dashboard error:', error);
    }
  }

  function setupSocketListeners() {
    if (!socket) return;

    socket.on('ride:request', (data) => {
      setIncomingRide(data);
      setCountdown(15);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            setIncomingRide(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('driver:status_changed', (data) => {
      setIsOnline(data.status === 'AVAILABLE');
    });
  }

  async function toggleOnline() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '위치 권한을 허용해주세요.');
      return;
    }

    if (!isOnline) {
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      emitGoOnline(coords.lat, coords.lng);
      startLocationTracking();
      setIsOnline(true);
    } else {
      emitGoOffline();
      stopLocationTracking();
      setIsOnline(false);
    }
  }

  async function startLocationTracking() {
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
      (loc) => {
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLocation(coords);
        emitDriverLocation(coords.lat, coords.lng, loc.coords.speed, loc.coords.heading);
      }
    );
  }

  function stopLocationTracking() {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  }

  function handleAcceptRide() {
    if (!incomingRide) return;
    emitRespondRide(incomingRide.ride_id, true);
    navigation.navigate('DriverRide', { rideId: incomingRide.ride_id });
    setIncomingRide(null);
  }

  function handleRejectRide() {
    if (!incomingRide) return;
    emitRespondRide(incomingRide.ride_id, false);
    setIncomingRide(null);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        initialRegion={{
          latitude: location?.lat || 37.5665,
          longitude: location?.lng || 126.978,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        }}
      />

      {/* 상단 상태 바 */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{user?.name}님</Text>
          <Text style={[styles.statusLabel, isOnline && styles.onlineLabel]}>
            {isOnline ? '운행 중' : '오프라인'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: '#ddd', true: '#4CAF50' }}
          thumbColor="#fff"
        />
      </View>

      {/* 오늘 실적 */}
      {dashboard && (
        <View style={styles.statsPanel}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dashboard.today.rides}</Text>
            <Text style={styles.statLabel}>오늘 운행</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dashboard.today.net_earnings.toLocaleString()}원</Text>
            <Text style={styles.statLabel}>오늘 수익</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{dashboard.driver.rating}</Text>
            <Text style={styles.statLabel}>평점</Text>
          </View>
        </View>
      )}

      {/* 배차 요청 팝업 */}
      {incomingRide && (
        <View style={styles.ridePopup}>
          <Text style={styles.popupTitle}>새로운 호출!</Text>
          <Text style={styles.popupTimer}>{countdown}초</Text>
          <View style={styles.popupActions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectRide}>
              <Text style={styles.rejectText}>거절</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptRide}>
              <Text style={styles.acceptText}>수락</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  topBar: {
    position: 'absolute', top: 50, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  greeting: { fontSize: 18, fontWeight: 'bold' },
  statusLabel: { fontSize: 14, color: '#999', marginTop: 2 },
  onlineLabel: { color: '#4CAF50' },
  statsPanel: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#eee' },
  ridePopup: {
    position: 'absolute', bottom: 200, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    borderWidth: 2, borderColor: '#FFD700',
  },
  popupTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  popupTimer: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#F44336', marginVertical: 8 },
  popupActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  rejectBtn: {
    flex: 1, padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center',
  },
  rejectText: { fontSize: 16, color: '#666' },
  acceptBtn: {
    flex: 2, padding: 14, borderRadius: 12,
    backgroundColor: '#FFD700', alignItems: 'center',
  },
  acceptText: { fontSize: 16, fontWeight: 'bold' },
});
