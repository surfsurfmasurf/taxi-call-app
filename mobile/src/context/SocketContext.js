import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (user) {
      initSocket();
    } else {
      disconnectSocket();
      setConnected(false);
    }

    return () => disconnectSocket();
  }, [user]);

  async function initSocket() {
    const socket = await connectSocket();
    if (socket) {
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
    }
  }

  return (
    <SocketContext.Provider value={{ socket: getSocket(), connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
