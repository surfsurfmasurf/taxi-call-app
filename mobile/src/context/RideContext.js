import React, { createContext, useState, useContext, useCallback } from 'react';
import { rideAPI } from '../services/api';

const RideContext = createContext(null);

export function RideProvider({ children }) {
  const [currentRide, setCurrentRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);

  const requestRide = useCallback(async (rideData) => {
    const { data } = await rideAPI.request(rideData);
    setCurrentRide(data.ride);
    setRideStatus('REQUESTED');
    return data.ride;
  }, []);

  const cancelRide = useCallback(async (reason) => {
    if (!currentRide) return;
    await rideAPI.updateStatus(currentRide.id, 'CANCELLED', reason);
    setCurrentRide(null);
    setRideStatus(null);
    setDriverLocation(null);
  }, [currentRide]);

  const completeRide = useCallback(() => {
    setCurrentRide(null);
    setRideStatus(null);
    setDriverLocation(null);
  }, []);

  const updateDriverLocation = useCallback((location) => {
    setDriverLocation(location);
  }, []);

  const updateRideStatus = useCallback((status, data) => {
    setRideStatus(status);
    if (data) {
      setCurrentRide((prev) => prev ? { ...prev, ...data } : data);
    }
  }, []);

  return (
    <RideContext.Provider
      value={{
        currentRide,
        driverLocation,
        rideStatus,
        requestRide,
        cancelRide,
        completeRide,
        updateDriverLocation,
        updateRideStatus,
        setCurrentRide,
      }}
    >
      {children}
    </RideContext.Provider>
  );
}

export function useRide() {
  const context = useContext(RideContext);
  if (!context) throw new Error('useRide must be used within RideProvider');
  return context;
}
