import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const LocationContext = createContext();

// Default location (Delhi) as fallback — only used if GPS fails
const DEFAULT_LOCATION = {
    latitude: 28.6139,
    longitude: 77.2090
};

export const LocationProvider = ({ children, userStoredLocation = null }) => {
    const [location, setLocation] = useState(userStoredLocation || DEFAULT_LOCATION);
    const [loading, setLoading] = useState(true);
    const [permissionGranted, setPermissionGranted] = useState(false);
    // locationReady = true only when REAL GPS is obtained (not Delhi fallback)
    const [locationReady, setLocationReady] = useState(false);

    useEffect(() => {
        requestLocationPermission();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const requestLocationPermission = async () => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'Smart Salon needs your location to show nearby salons and directions.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );

                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    setPermissionGranted(true);
                    getCurrentLocation();
                } else {
                    setLoading(false);
                    // Permission denied — will use Delhi fallback, locationReady stays false
                }
            } else {
                // iOS - permission handled automatically
                setPermissionGranted(true);
                getCurrentLocation();
            }
        } catch (err) {
            setLoading(false);
        }
    };

    const getCurrentLocation = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ latitude, longitude });
                setLocationReady(true); // Real GPS obtained ✅
                setLoading(false);
            },
            (error) => {
                // GPS failed — keep Delhi fallback, locationReady stays false
                setLocationReady(false);
                setLoading(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 60000 // Cache location for 1 minute
            }
        );
    };

    // Refresh location (call when needed)
    const refreshLocation = () => {
        if (permissionGranted) {
            getCurrentLocation();
        }
    };

    return (
        <LocationContext.Provider value={{
            location,
            loading,
            permissionGranted,
            locationReady, // ← new: true only when real GPS available
            refreshLocation
        }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        // Return default if used outside provider (fallback for safety)
        return {
            location: DEFAULT_LOCATION,
            loading: false,
            permissionGranted: false,
            locationReady: false,
            refreshLocation: () => { }
        };
    }
    return context;
};

export default LocationContext;
