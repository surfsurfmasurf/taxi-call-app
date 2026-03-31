import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function OtpScreen({ route }) {
  const { phone } = route.params;
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert('오류', '6자리 인증번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await login(phone, code, needsName ? name : undefined);
    } catch (error) {
      const data = error.response?.data;
      if (data?.isNewUser) {
        setNeedsName(true);
      } else {
        Alert.alert('오류', data?.error || '인증에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>인증번호 입력</Text>
      <Text style={styles.subtitle}>{phone}로 발송된 6자리 인증번호를 입력해주세요.</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        maxLength={6}
        autoFocus
      />

      {needsName && (
        <>
          <Text style={styles.nameLabel}>이름을 입력해주세요 (신규 가입)</Text>
          <TextInput
            style={styles.input}
            placeholder="홍길동"
            value={name}
            onChangeText={setName}
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? '확인 중...' : '확인'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 16, fontSize: 24, textAlign: 'center', marginBottom: 16,
    letterSpacing: 8,
  },
  nameLabel: { fontSize: 14, color: '#333', marginBottom: 8, marginTop: 8 },
  button: {
    backgroundColor: '#FFD700', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
});
