import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { rideAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

const DRIVER_STATUS_FLOW = [
  { from: 'MATCHED', to: 'ARRIVING', label: '픽업지로 이동' },
  { from: 'ARRIVING', to: 'PICKUP', label: '도착 알림' },
  { from: 'PICKUP', to: 'IN_PROGRESS', label: '운행 시작' },
  { from: 'IN_PROGRESS', to: 'COMPLETED', label: '운행 완료' },
];

export default function DriverRideScreen({ route, navigation }) {
  const { rideId } = route.params;
  const [ride, setRide] = useState(null);

  useEffect(() => { loadRide(); }, []);

  async function loadRide() {
    try {
      const { data } = await rideAPI.getById(rideId);
      setRide(data.ride);
    } catch (error) {
      Alert.alert('오류', '운행 정보를 불러올 수 없습니다.');
    }
  }

  async function handleNextStatus() {
    const flow = DRIVER_STATUS_FLOW.find((f) => f.from === ride.status);
    if (!flow) return;

    try {
      await rideAPI.updateStatus(rideId, flow.to);
      if (flow.to === 'COMPLETED') {
        Alert.alert('운행 완료', '수고하셨습니다!');
        navigation.goBack();
      } else {
        setRide((prev) => ({ ...prev, status: flow.to }));
      }
    } catch (error) {
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    }
  }

  async function handleCancel() {
    Alert.alert('운행 취소', '정말 취소하시겠습니까?', [
      { text: '아니오' },
      {
        text: '예', style: 'destructive',
        onPress: async () => {
          await rideAPI.updateStatus(rideId, 'CANCELLED', '기사 취소');
          navigation.goBack();
        },
      },
    ]);
  }

  const nextAction = DRIVER_STATUS_FLOW.find((f) => f.from === ride?.status);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={ride ? {
          latitude: ride.pickup_lat, longitude: ride.pickup_lng,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        } : undefined}
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
      </MapView>

      <View style={styles.panel}>
        {ride && (
          <>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{ride.rider?.name || '승객'}님</Text>
              <Text style={styles.riderRating}>{ride.rider?.rating || '5.0'}</Text>
            </View>

            <View style={styles.addresses}>
              <Text style={styles.addressLabel}>출발</Text>
              <Text style={styles.addressText} numberOfLines={1}>{ride.pickup_address}</Text>
              <Text style={styles.addressLabel}>도착</Text>
              <Text style={styles.addressText} numberOfLines={1}>{ride.dest_address}</Text>
            </View>

            <Text style={styles.fareEstimate}>
              예상 요금: {(ride.estimated_fare || 0).toLocaleString()}원
            </Text>

            <View style={styles.actions}>
              {ride.status !== 'COMPLETED' && (
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                  <Text style={styles.cancelText}>취소</Text>
                </TouchableOpacity>
              )}
              {nextAction && (
                <TouchableOpacity style={styles.nextBtn} onPress={handleNextStatus}>
                  <Text style={styles.nextText}>{nextAction.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height * 0.5 },
  panel: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, marginTop: -24,
  },
  riderInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  riderName: { fontSize: 20, fontWeight: 'bold' },
  riderRating: { fontSize: 16, color: '#FFD700', fontWeight: 'bold' },
  addresses: { marginBottom: 16 },
  addressLabel: { fontSize: 12, color: '#999', marginTop: 8 },
  addressText: { fontSize: 15, color: '#333' },
  fareEstimate: {
    fontSize: 16, fontWeight: '600', textAlign: 'center',
    marginVertical: 12, color: '#1a1a1a',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: '#F44336' },
  nextBtn: {
    flex: 2, padding: 14, borderRadius: 12,
    backgroundColor: '#FFD700', alignItems: 'center',
  },
  nextText: { fontSize: 16, fontWeight: 'bold' },
});
