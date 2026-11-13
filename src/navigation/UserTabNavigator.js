import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import UserHomeScreen from '../screens/UserHomeScreen';
import UserBookingsScreen from '../screens/UserBookingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserWalletScreen from '../screens/UserWalletScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

const Tab = createBottomTabNavigator();

const UserTabNavigator = ({ route }) => {
    const { user } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const handleTabPress = (e, navigation) => {
        // Check if user is logged in (has proper ID)
        // Adjust check based on how you pass guest user (null or object with 'Guest' name)
        // SplashScreen sends null if guest.
        const isGuest = !user || (!user._id && !user.id);

        if (isGuest) {
            e.preventDefault(); // Prevent navigation
            // Navigate to Login directly or show Alert
            navigation.navigate('Login');
        }
    };

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Bookings') {
                        iconName = focused ? 'calendar' : 'calendar-outline';
                    } else if (route.name === 'Wallet') {
                        iconName = focused ? 'wallet' : 'wallet-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.textLight,
                tabBarStyle: {
                    paddingBottom: 5,
                    height: 60,
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.divider,
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: isDarkMode ? 0.3 : 0.1,
                    shadowRadius: 4,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 5,
                }
            })}
        >
            <Tab.Screen name="Home" component={UserHomeScreen} initialParams={{ user }} />
            <Tab.Screen
                name="Bookings"
                component={UserBookingsScreen}
                initialParams={{ user }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => handleTabPress(e, navigation),
                })}
            />
            <Tab.Screen
                name="Wallet"
                component={UserWalletScreen}
                initialParams={{ user }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => handleTabPress(e, navigation),
                })}
            />
            <Tab.Screen
                name="Profile"
                component={UserProfileScreen}
                initialParams={{ user }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => handleTabPress(e, navigation),
                })}
            />
        </Tab.Navigator>
    );
};

export default UserTabNavigator;
