import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소' },
      { text: '확인', onPress: logout },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingStar}>★</Text>
          <Text style={styles.ratingValue}>{user?.rating || '5.0'}</Text>
          <Text style={styles.rideCount}>총 {user?.total_rides || 0}회 이용</Text>
        </View>
      </View>

      <View style={styles.menu}>
        {[
          { label: '프로필 수정', icon: '>' },
          { label: '알림 설정', icon: '>' },
          { label: '고객센터', icon: '>' },
          { label: '이용약관', icon: '>' },
          { label: '개인정보처리방침', icon: '>' },
          { label: '앱 버전', icon: 'v1.0.0' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuIcon}>{item.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#fff', alignItems: 'center',
    paddingTop: 60, paddingBottom: 24,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  name: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  phone: { fontSize: 14, color: '#999', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  ratingStar: { fontSize: 18, color: '#FFD700' },
  ratingValue: { fontSize: 16, fontWeight: 'bold', marginLeft: 4 },
  rideCount: { fontSize: 14, color: '#999', marginLeft: 12 },
  menu: { backgroundColor: '#fff', marginTop: 16 },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  menuLabel: { fontSize: 16, color: '#333' },
  menuIcon: { fontSize: 14, color: '#ccc' },
  logoutButton: {
    margin: 16, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  logoutText: { fontSize: 16, color: '#F44336' },
});
