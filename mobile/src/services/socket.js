import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

let socket = null;

export async function connectSocket() {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// 기사 위치 업데이트 전송
export function emitDriverLocation(lat, lng, speed, heading) {
  if (socket) {
    socket.emit('driver:update_location', { lat, lng, speed, heading });
  }
}

// 기사 온라인
export function emitGoOnline(lat, lng) {
  if (socket) {
    socket.emit('driver:go_online', { lat, lng });
  }
}

// 기사 오프라인
export function emitGoOffline() {
  if (socket) {
    socket.emit('driver:go_offline');
  }
}

// 매칭 응답
export function emitRespondRide(rideId, accept) {
  if (socket) {
    socket.emit('driver:respond_ride', { ride_id: rideId, accept });
  }
}

// 운행 룸 입장
export function joinRideRoom(rideId) {
  if (socket) {
    socket.emit('ride:join', { ride_id: rideId });
  }
}

// SOS
export function emitSOS(rideId, lat, lng) {
  if (socket) {
    socket.emit('ride:sos', { ride_id: rideId, lat, lng });
  }
}
