import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { rideAPI } from '../../services/api';
import { useRide } from '../../context/RideContext';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const mapRef = useRef(null);
  const { requestRide, currentRide } = useRide();

  const [myLocation, setMyLocation] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [destAddress, setDestAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('현재 위치');
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '위치 권한을 허용해주세요.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setMyLocation(coords);
      setPickup(coords);

      // 역지오코딩
      const [address] = await Location.reverseGeocodeAsync({
        latitude: coords.lat, longitude: coords.lng,
      });
      if (address) {
        setPickupAddress(`${address.city || ''} ${address.street || ''} ${address.name || ''}`);
      }
    })();
  }, []);

  // 현재 운행이 있으면 운행 화면으로 이동
  useEffect(() => {
    if (currentRide) {
      navigation.navigate('Ride', { rideId: currentRide.id });
    }
  }, [currentRide]);

  async function handleEstimate() {
    if (!pickup || !destination) {
      Alert.alert('오류', '출발지와 목적지를 설정해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await rideAPI.estimate(pickup, destination);
      setEstimate(data);
      setShowEstimate(true);
    } catch (error) {
      Alert.alert('오류', '요금 예상에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestRide() {
    setLoading(true);
    try {
      const ride = await requestRide({
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_address: pickupAddress,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        dest_address: destAddress,
      });
      navigation.navigate('Ride', { rideId: ride.id });
    } catch (error) {
      Alert.alert('오류', error.response?.data?.error || '호출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleMapPress(e) {
    const coords = {
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude,
    };
    setDestination(coords);
    setDestAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    setShowEstimate(false);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={myLocation ? {
          latitude: myLocation.lat,
          longitude: myLocation.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : {
          latitude: 37.5665, longitude: 126.978, latitudeDelta: 0.05, longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {pickup && (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            title="출발지"
            pinColor="green"
          />
        )}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title="목적지"
            pinColor="red"
          />
        )}
      </MapView>

      {/* 목적지 입력 패널 */}
      <View style={styles.panel}>
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
          <TextInput
            style={styles.addressInput}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            placeholder="출발지"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
          <TextInput
            style={styles.addressInput}
            value={destAddress}
            onChangeText={setDestAddress}
            placeholder="어디로 갈까요?"
          />
        </View>

        {destination && !showEstimate && (
          <TouchableOpacity style={styles.estimateButton} onPress={handleEstimate} disabled={loading}>
            <Text style={styles.estimateButtonText}>
              {loading ? '계산 중...' : '요금 확인'}
            </Text>
          </TouchableOpacity>
        )}

        {showEstimate && estimate && (
          <View style={styles.estimatePanel}>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>예상 요금</Text>
              <Text style={styles.estimateValue}>
                {estimate.fare.total.toLocaleString()}원
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateDetail}>
                거리 {estimate.estimated_distance_km}km / 약 {estimate.estimated_duration_min}분
              </Text>
            </View>
            {estimate.fare.surge_multiplier > 1 && (
              <Text style={styles.surgeText}>
                현재 수요 폭증 (x{estimate.fare.surge_multiplier})
              </Text>
            )}
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleRequestRide}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" />
              ) : (
                <Text style={styles.callButtonText}>택시 호출하기</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height * 0.6 },
  panel: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, marginTop: -24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  addressInput: { flex: 1, fontSize: 16, color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginLeft: 22 },
  estimateButton: {
    backgroundColor: '#FFD700', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 16,
  },
  estimateButtonText: { fontSize: 16, fontWeight: 'bold' },
  estimatePanel: { marginTop: 16 },
  estimateRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  estimateLabel: { fontSize: 14, color: '#666' },
  estimateValue: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  estimateDetail: { fontSize: 13, color: '#999' },
  surgeText: { fontSize: 13, color: '#F44336', marginTop: 4 },
  callButton: {
    backgroundColor: '#FFD700', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 12,
  },
  callButtonText: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
});
