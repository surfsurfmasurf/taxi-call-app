import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { driverAPI } from '../../services/api';

export default function SettlementScreen() {
  const [settlement, setSettlement] = useState(null);
  const [period, setPeriod] = useState('month'); // week | month

  useEffect(() => { loadSettlement(); }, [period]);

  async function loadSettlement() {
    const now = new Date();
    let startDate;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    try {
      const { data } = await driverAPI.getSettlement(
        startDate.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      );
      setSettlement(data);
    } catch (error) {
      console.error('Settlement error:', error);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>정산</Text>

      {/* 기간 선택 */}
      <View style={styles.periodTabs}>
        <TouchableOpacity
          style={[styles.periodTab, period === 'week' && styles.activePeriod]}
          onPress={() => setPeriod('week')}
        >
          <Text style={period === 'week' ? styles.activePeriodText : styles.periodText}>최근 7일</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodTab, period === 'month' && styles.activePeriod]}
          onPress={() => setPeriod('month')}
        >
          <Text style={period === 'month' ? styles.activePeriodText : styles.periodText}>이번 달</Text>
        </TouchableOpacity>
      </View>

      {/* 요약 */}
      {settlement?.summary && (
        <View style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>순수익</Text>
            <Text style={styles.summaryValue}>
              {settlement.summary.net_earning.toLocaleString()}원
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.gridLabel}>총 운행</Text>
              <Text style={styles.gridValue}>{settlement.summary.total_rides}회</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.gridLabel}>총 매출</Text>
              <Text style={styles.gridValue}>{settlement.summary.total_fare.toLocaleString()}원</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.gridLabel}>수수료</Text>
              <Text style={styles.gridValue}>-{settlement.summary.total_commission.toLocaleString()}원</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.gridLabel}>카드 정산</Text>
              <Text style={styles.gridValue}>{settlement.summary.payout_amount.toLocaleString()}원</Text>
            </View>
          </View>
        </View>
      )}

      {/* 상세 내역 */}
      <Text style={styles.sectionTitle}>상세 내역</Text>
      <FlatList
        data={settlement?.details || []}
        keyExtractor={(item) => item.ride_id}
        renderItem={({ item }) => (
          <View style={styles.detailItem}>
            <View>
              <Text style={styles.detailDate}>
                {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.detailDistance}>{item.distance_km?.toFixed(1)}km</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.detailFare}>{item.driver_earning.toLocaleString()}원</Text>
              <Text style={styles.detailCommission}>수수료 -{item.commission.toLocaleString()}원</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>정산 내역이 없습니다.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  periodTabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingBottom: 12, gap: 8,
  },
  periodTab: {
    paddingVertical: 8, paddingHorizontal: 20,
    borderRadius: 20, backgroundColor: '#f0f0f0',
  },
  activePeriod: { backgroundColor: '#FFD700' },
  periodText: { color: '#666' },
  activePeriodText: { fontWeight: 'bold', color: '#1a1a1a' },
  summary: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 20 },
  summaryMain: { alignItems: 'center', marginBottom: 20 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: {
    width: '50%', paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  gridLabel: { fontSize: 13, color: '#999' },
  gridValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  detailItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 4,
    padding: 14, borderRadius: 8,
  },
  detailDate: { fontSize: 14, color: '#333' },
  detailDistance: { fontSize: 13, color: '#999', marginTop: 2 },
  detailFare: { fontSize: 16, fontWeight: 'bold' },
  detailCommission: { fontSize: 12, color: '#F44336', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 48, color: '#999' },
});
