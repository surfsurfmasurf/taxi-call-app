import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import { paymentAPI, couponAPI } from '../../services/api';

export default function PaymentScreen() {
  const [methods, setMethods] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [activeTab, setActiveTab] = useState('methods'); // methods | coupons | history

  useEffect(() => {
    loadMethods();
    loadCoupons();
  }, []);

  async function loadMethods() {
    try {
      const { data } = await paymentAPI.getMethods();
      setMethods(data.methods);
    } catch (error) {
      console.error('Load methods error:', error);
    }
  }

  async function loadCoupons() {
    try {
      const { data } = await couponAPI.getMyCoupons();
      setCoupons(data.coupons);
    } catch (error) {
      console.error('Load coupons error:', error);
    }
  }

  async function handleSetDefault(id) {
    try {
      await paymentAPI.setDefault(id);
      loadMethods();
    } catch (error) {
      Alert.alert('오류', '변경에 실패했습니다.');
    }
  }

  async function handleDeleteMethod(id) {
    Alert.alert('삭제', '결제 수단을 삭제하시겠습니까?', [
      { text: '취소' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await paymentAPI.deleteMethod(id);
          loadMethods();
        },
      },
    ]);
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    try {
      await couponAPI.apply(couponCode.trim());
      Alert.alert('등록 완료', '쿠폰이 등록되었습니다.');
      setCouponCode('');
      setShowCouponModal(false);
      loadCoupons();
    } catch (error) {
      Alert.alert('오류', error.response?.data?.error || '쿠폰 등록에 실패했습니다.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>결제</Text>

      {/* 탭 */}
      <View style={styles.tabs}>
        {[
          { key: 'methods', label: '결제 수단' },
          { key: 'coupons', label: '쿠폰' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 결제 수단 탭 */}
      {activeTab === 'methods' && (
        <FlatList
          data={methods}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.methodItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodName}>{item.display_name || item.type}</Text>
                {item.is_default && <Text style={styles.defaultBadge}>기본 결제</Text>}
              </View>
              <View style={styles.methodActions}>
                {!item.is_default && (
                  <TouchableOpacity onPress={() => handleSetDefault(item.id)}>
                    <Text style={styles.actionText}>기본 설정</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteMethod(item.id)}>
                  <Text style={[styles.actionText, { color: '#F44336' }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>등록된 결제 수단이 없습니다.</Text>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ 결제 수단 추가</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* 쿠폰 탭 */}
      {activeTab === 'coupons' && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.couponRegister}
            onPress={() => setShowCouponModal(true)}
          >
            <Text style={styles.couponRegisterText}>쿠폰 코드 등록</Text>
          </TouchableOpacity>

          <FlatList
            data={coupons}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.couponItem}>
                <Text style={styles.couponName}>{item.Coupon?.name || '쿠폰'}</Text>
                <Text style={styles.couponDesc}>
                  {item.Coupon?.discount_type === 'FIXED'
                    ? `${item.Coupon.discount_value.toLocaleString()}원 할인`
                    : `${item.Coupon.discount_value}% 할인`}
                </Text>
                <Text style={styles.couponExpiry}>
                  ~{new Date(item.Coupon?.valid_until).toLocaleDateString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>보유한 쿠폰이 없습니다.</Text>
            }
          />
        </View>
      )}

      {/* 쿠폰 등록 모달 */}
      <Modal visible={showCouponModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>쿠폰 코드 입력</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="쿠폰 코드를 입력하세요"
              value={couponCode}
              onChangeText={setCouponCode}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCouponModal(false)}
              >
                <Text>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleApplyCoupon}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>등록</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText: { fontSize: 15, color: '#999' },
  activeTabText: { color: '#1a1a1a', fontWeight: 'bold' },
  methodItem: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 16,
    marginHorizontal: 16, marginTop: 12, borderRadius: 12,
  },
  methodName: { fontSize: 16, fontWeight: '600' },
  defaultBadge: { fontSize: 12, color: '#4CAF50', marginTop: 4 },
  methodActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  actionText: { fontSize: 14, color: '#2196F3' },
  addButton: {
    margin: 16, padding: 16, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 12, borderStyle: 'dashed', alignItems: 'center',
  },
  addButtonText: { fontSize: 16, color: '#999' },
  couponRegister: {
    backgroundColor: '#fff', margin: 16, padding: 14,
    borderRadius: 12, alignItems: 'center',
  },
  couponRegisterText: { fontSize: 16, color: '#2196F3', fontWeight: '600' },
  couponItem: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
    padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#FFD700',
  },
  couponName: { fontSize: 16, fontWeight: 'bold' },
  couponDesc: { fontSize: 14, color: '#333', marginTop: 4 },
  couponExpiry: { fontSize: 12, color: '#999', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 48, color: '#999' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 24,
  },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center',
  },
  modalConfirm: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: '#FFD700', alignItems: 'center',
  },
});
