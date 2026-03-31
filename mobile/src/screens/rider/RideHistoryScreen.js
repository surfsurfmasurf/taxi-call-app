import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { rideAPI } from '../../services/api';

const STATUS_LABEL = {
  COMPLETED: '완료', CANCELLED: '취소', IN_PROGRESS: '운행 중',
  MATCHED: '배차 완료', REQUESTED: '요청 중',
};

export default function RideHistoryScreen({ navigation }) {
  const [rides, setRides] = useState([]);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { loadRides(); }, []);

  async function loadRides(pageNum = 1) {
    try {
      const { data } = await rideAPI.getMyRides(pageNum);
      if (pageNum === 1) {
        setRides(data.rides);
      } else {
        setRides((prev) => [...prev, ...data.rides]);
      }
      setHasMore(pageNum < data.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Load rides error:', error);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadRides(1).finally(() => setRefreshing(false));
  }

  function handleLoadMore() {
    if (hasMore) loadRides(page + 1);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Ride', { rideId: item.id })}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
          <View style={[styles.badge, item.status === 'COMPLETED' ? styles.badgeGreen : styles.badgeGray]}>
            <Text style={styles.badgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>
          {item.pickup_address}
        </Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.address} numberOfLines={1}>
          {item.dest_address}
        </Text>

        <View style={styles.itemFooter}>
          <Text style={styles.fare}>
            {(item.final_fare || item.estimated_fare || 0).toLocaleString()}원
          </Text>
          {item.distance_km && (
            <Text style={styles.distance}>{item.distance_km.toFixed(1)}km</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이용 내역</Text>
      <FlatList
        data={rides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Text style={styles.empty}>이용 내역이 없습니다.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  item: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    padding: 16, borderRadius: 12,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  itemDate: { fontSize: 13, color: '#999' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeGray: { backgroundColor: '#f0f0f0' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  address: { fontSize: 15, color: '#333' },
  arrow: { fontSize: 14, color: '#ccc', marginVertical: 2, marginLeft: 4 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  fare: { fontSize: 18, fontWeight: 'bold' },
  distance: { fontSize: 14, color: '#999', alignSelf: 'flex-end' },
  empty: { textAlign: 'center', marginTop: 48, color: '#999', fontSize: 16 },
});
