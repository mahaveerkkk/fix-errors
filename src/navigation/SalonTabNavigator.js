import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

// Screens
import SalonDashboardScreen from '../screens/SalonDashboardScreen';
import SalonManageScreen from '../screens/SalonManageMenuScreen';
import SalonSettingsScreen from '../screens/SalonSettingsScreen';
import SalonWalletScreen from '../screens/SalonWalletScreen';

const Tab = createBottomTabNavigator();

const SalonTabNavigator = ({ route }) => {
    const { user, salon } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Manage') {
                        iconName = focused ? 'grid' : 'grid-outline';
                    } else if (route.name === 'Wallet') {
                        iconName = focused ? 'wallet' : 'wallet-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={24} color={color} />;
                },
                tabBarActiveTintColor: '#4CAF50',
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 8,
                    backgroundColor: theme.colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginTop: 2,
                }
            })}
        >
            <Tab.Screen
                name="Home"
                component={SalonDashboardScreen}
                initialParams={{ user, salon }}
            />
            <Tab.Screen
                name="Manage"
                component={SalonManageScreen}
                initialParams={{ user, salon }}
            />
            <Tab.Screen
                name="Wallet"
                component={SalonWalletScreen}
                initialParams={{ user, salon }}
            />
            <Tab.Screen
                name="Settings"
                component={SalonSettingsScreen}
                initialParams={{ user, salon }}
            />
        </Tab.Navigator>
    );
};

export default SalonTabNavigator;
