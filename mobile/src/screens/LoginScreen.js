import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authAPI } from '../../services/api';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{8,9}$/.test(cleaned)) {
      Alert.alert('오류', '올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.sendOtp(cleaned);
      navigation.navigate('Otp', { phone: cleaned });
    } catch (error) {
      Alert.alert('오류', error.response?.data?.error || '인증번호 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>택시 호출</Text>
        <Text style={styles.subtitle}>어디든 빠르고 안전하게</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>휴대폰 번호</Text>
        <TextInput
          style={styles.input}
          placeholder="01012345678"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={11}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '발송 중...' : '인증번호 받기'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.terms}>
        계속하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  header: { marginTop: 80, marginBottom: 48 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  form: { flex: 1 },
  label: { fontSize: 14, color: '#333', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 16, fontSize: 18, marginBottom: 16,
  },
  button: {
    backgroundColor: '#FFD700', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  terms: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 32 },
});
