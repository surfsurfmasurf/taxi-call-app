import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const { data } = await authAPI.getMe();
        setUser(data.user);
      }
    } catch (error) {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone, code, name) {
    const { data } = await authAPI.verifyOtp(phone, code, name);
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    setUser(null);
  }

  async function updateProfile(updates) {
    const { data } = await authAPI.updateMe(updates);
    setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
