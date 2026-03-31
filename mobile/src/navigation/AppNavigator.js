import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import OtpScreen from '../screens/OtpScreen';

// Rider Screens
import HomeScreen from '../screens/rider/HomeScreen';
import RideScreen from '../screens/rider/RideScreen';
import RideHistoryScreen from '../screens/rider/RideHistoryScreen';
import PaymentScreen from '../screens/rider/PaymentScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Driver Screens
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import DriverRideScreen from '../screens/driver/DriverRideScreen';
import SettlementScreen from '../screens/driver/SettlementScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function RiderTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
      <Tab.Screen name="History" component={RideHistoryScreen} options={{ tabBarLabel: '이용내역' }} />
      <Tab.Screen name="Payment" component={PaymentScreen} options={{ tabBarLabel: '결제' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '내 정보' }} />
    </Tab.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="DriverHome" component={DriverHomeScreen} options={{ tabBarLabel: '홈' }} />
      <Tab.Screen name="Settlement" component={SettlementScreen} options={{ tabBarLabel: '정산' }} />
      <Tab.Screen name="History" component={RideHistoryScreen} options={{ tabBarLabel: '운행내역' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '내 정보' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
        </>
      ) : user.type === 'DRIVER' ? (
        <>
          <Stack.Screen name="DriverMain" component={DriverTabs} />
          <Stack.Screen name="DriverRide" component={DriverRideScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="RiderMain" component={RiderTabs} />
          <Stack.Screen name="Ride" component={RideScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
