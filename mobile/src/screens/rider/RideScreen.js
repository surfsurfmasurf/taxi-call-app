import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRide } from '../../context/RideContext';
import { useSocket } from '../../context/SocketContext';
import { rideAPI } from '../../services/api';
import { joinRideRoom, emitSOS } from '../../services/socket';

const { width, height } = Dimensions.get('window');

const STATUS_TEXT = {
  REQUESTED: '기사를 찾고 있습니다...',
  MATCHED: '기사가 배정되었습니다',
  ARRIVING: '기사가 이동 중입니다',
  PICKUP: '기사가 도착했습니다',
  IN_PROGRESS: '목적지로 이동 중',
  COMPLETED: '운행이 완료되었습니다',
};

export default function RideScreen({ route, navigation }) {
  const { rideId } = route.params;
  const { currentRide, driverLocation, rideStatus, updateDriverLocation, updateRideStatus, cancelRide, completeRide } = useRide();
  const { socket } = useSocket();
  const mapRef = useRef(null);

  const [ride, setRide] = useState(null);
  const [rating, setRating] = useState(5);

  useEffect(() => {
    loadRide();
    joinRideRoom(rideId);
    setupSocketListeners();
  }, []);

  async function loadRide() {
    try {
      const { data } = await rideAPI.getById(rideId);
      setRide(data.ride);
      updateRideStatus(data.ride.status);
    } catch (error) {
      Alert.alert('오류', '운행 정보를 불러올 수 없습니다.');
    }
  }

  function setupSocketListeners() {
    if (!socket) return;

    socket.on('ride:matched', (data) => {
      updateRideStatus('MATCHED', data);
      setRide((prev) => ({ ...prev, ...data, status: 'MATCHED' }));
    });

    socket.on('driver:location', (data) => {
      updateDriverLocation(data);
    });

    socket.on('ride:status_changed', (data) => {
      updateRideStatus(data.status);
      setRide((prev) => prev ? { ...prev, status: data.status } : prev);
    });

    socket.on('ride:completed', (data) => {
      updateRideStatus('COMPLETED', data);
      setRide((prev) => prev ? { ...prev, status: 'COMPLETED', fare: data.fare } : prev);
    });

    socket.on('ride:no_driver', () => {
      Alert.alert('배차 실패', '주변에 가용한 기사가 없습니다. 잠시 후 다시 시도해주세요.');
      navigation.goBack();
    });

    return () => {
      socket.off('ride:matched');
      socket.off('driver:location');
      socket.off('ride:status_changed');
      socket.off('ride:completed');
      socket.off('ride:no_driver');
    };
  }

  async function handleCancel() {
    Alert.alert('호출 취소', '정말 취소하시겠습니까?', [
      { text: '아니오' },
      {
        text: '예', style: 'destructive',
        onPress: async () => {
          try {
            await cancelRide('승객 요청');
            navigation.goBack();
          } catch (error) {
            Alert.alert('오류', '취소에 실패했습니다.');
          }
        },
      },
    ]);
  }

  async function handleSubmitReview() {
    try {
      await rideAPI.submitReview(rideId, { rating, comment: '' });
      completeRide();
      navigation.goBack();
    } catch (error) {
      Alert.alert('오류', '리뷰 저장에 실패했습니다.');
    }
  }

  function handleSOS() {
    Alert.alert('긴급 신고', '긴급 신고를 하시겠습니까?', [
      { text: '취소' },
      {
        text: '신고', style: 'destructive',
        onPress: () => {
          emitSOS(rideId, ride?.pickup_lat, ride?.pickup_lng);
          Alert.alert('신고 완료', '관제센터에 신고되었습니다.');
        },
      },
    ]);
  }

  const status = rideStatus || ride?.status || 'REQUESTED';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={ride ? {
          latitude: ride.pickup_lat, longitude: ride.pickup_lng,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        } : undefined}
        showsUserLocation
      >
        {ride && (
          <>
            <Marker
              coordinate={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }}
              title="출발지" pinColor="green"
            />
            <Marker
              coordinate={{ latitude: ride.dest_lat, longitude: ride.dest_lng }}
              title="목적지" pinColor="red"
            />
          </>
        )}
        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title="기사 위치" pinColor="blue"
          />
        )}
      </MapView>

      <View style={styles.panel}>
        {/* 상태 표시 */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, status === 'IN_PROGRESS' && styles.activeDot]} />
          <Text style={styles.statusText}>{STATUS_TEXT[status] || status}</Text>
        </View>

        {/* 기사 정보 */}
        {ride?.driver && status !== 'REQUESTED' && status !== 'COMPLETED' && (
          <View style={styles.driverInfo}>
            <View>
              <Text style={styles.driverName}>{ride.driver.user?.name || '기사님'}</Text>
              <Text style={styles.vehicleInfo}>
                {ride.driver.vehicle_model} / {ride.driver.vehicle_number}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{ride.driver.user?.rating || '5.0'}</Text>
            </View>
          </View>
        )}

        {/* 요금 (완료 시) */}
        {status === 'COMPLETED' && (
          <View style={styles.fareSection}>
            <Text style={styles.fareLabel}>운행 요금</Text>
            <Text style={styles.fareAmount}>
              {(ride?.final_fare || ride?.estimated_fare || 0).toLocaleString()}원
            </Text>

            <Text style={styles.ratingLabel}>평가해주세요</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text style={[styles.star, star <= rating && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReview}>
              <Text style={styles.submitText}>완료</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 하단 버튼 */}
        {status !== 'COMPLETED' && (
          <View style={styles.actions}>
            {['REQUESTED', 'MATCHED', 'ARRIVING'].includes(status) && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelText}>호출 취소</Text>
              </TouchableOpacity>
            )}
            {status === 'IN_PROGRESS' && (
              <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
                <Text style={styles.sosText}>SOS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height * 0.55 },
  panel: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, marginTop: -24,
  },
  statusBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFD700', marginRight: 8 },
  activeDot: { backgroundColor: '#4CAF50' },
  statusText: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  driverInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, backgroundColor: '#f8f8f8',
    borderRadius: 12, marginBottom: 12,
  },
  driverName: { fontSize: 18, fontWeight: 'bold' },
  vehicleInfo: { fontSize: 14, color: '#666', marginTop: 4 },
  ratingBadge: {
    backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  ratingText: { fontSize: 16, fontWeight: 'bold' },
  fareSection: { alignItems: 'center', paddingVertical: 16 },
  fareLabel: { fontSize: 14, color: '#666' },
  fareAmount: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', marginVertical: 8 },
  ratingLabel: { fontSize: 14, color: '#666', marginTop: 16, marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 36, color: '#ddd' },
  starActive: { color: '#FFD700' },
  submitButton: {
    backgroundColor: '#FFD700', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48, marginTop: 16,
  },
  submitText: { fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  cancelButton: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: '#F44336' },
  sosButton: {
    backgroundColor: '#F44336', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center',
  },
  sosText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});
