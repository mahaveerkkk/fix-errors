/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthStack from './src/navigation/AuthStack';
import { requestUserPermission, notificationListener } from './src/services/notificationService';
import { ThemeProvider } from './src/context/ThemeContext';
import { LocationProvider } from './src/context/LocationContext';

const App = () => {
  useEffect(() => {
    requestUserPermission();
    const unsubscribe = notificationListener();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <LocationProvider>
        <ThemeProvider>
          <NavigationContainer>
            <AuthStack />
          </NavigationContainer>
        </ThemeProvider>
      </LocationProvider>
    </SafeAreaProvider>
  );
};

export default App;
