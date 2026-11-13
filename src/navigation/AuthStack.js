import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import UserHomeScreen from '../screens/UserHomeScreen';
import SalonDashboardScreen from '../screens/SalonDashboardScreen';
import BookingScreen from '../screens/BookingScreen';
import UserBookingsScreen from '../screens/UserBookingsScreen';

// import SalonRegisterScreen from '../screens/SalonRegisterScreen'; // DELETED
import SalonSetupScreen from '../screens/SalonSetupScreen';

import SalonDetailsScreen from '../screens/SalonDetailsScreen';
import UserTabNavigator from './UserTabNavigator';
import SalonTabNavigator from './SalonTabNavigator';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ManagePlansScreen from '../screens/admin/ManagePlansScreen';

import ReportsScreen from '../screens/ReportsScreen'; // Updated path
import ManageSalonsScreen from '../screens/admin/ManageSalonsScreen';

// New Salon Screens
import AppointmentCalendarScreen from '../screens/AppointmentCalendarScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import BookingHistoryScreen from '../screens/BookingHistoryScreen';

import ServiceManagementScreen from '../screens/ServiceManagementScreen';
import CustomerListScreen from '../screens/CustomerListScreen';
import MembershipScreen from '../screens/MembershipScreen';
import SalonProfileScreen from '../screens/SalonProfileScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';

const Stack = createStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="UserHome" component={UserTabNavigator} />
            <Stack.Screen name="SalonTabs" component={SalonTabNavigator} />

            <Stack.Screen name="SalonSetup" component={SalonSetupScreen} />
            <Stack.Screen name="SalonDashboard" component={SalonDashboardScreen} />
            <Stack.Screen name="SalonDetails" component={SalonDetailsScreen} />
            <Stack.Screen name="ServiceSelection" component={require('../screens/ServiceSelectionScreen').default} />
            <Stack.Screen name="StaffSelection" component={require('../screens/StaffSelectionScreen').default} />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="LiveQueue" component={require('../screens/LiveQueueScreen').default} />
            <Stack.Screen name="Favorites" component={require('../screens/FavoritesScreen').default} />

            <Stack.Screen name="ReviewList" component={require('../screens/ReviewListScreen').default} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="ManagePlans" component={ManagePlansScreen} />

            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="ManageSalons" component={ManageSalonsScreen} />

            {/* New Salon Screens */}
            <Stack.Screen name="AppointmentCalendar" component={AppointmentCalendarScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />

            <Stack.Screen name="ServiceManagement" component={ServiceManagementScreen} />
            <Stack.Screen name="StaffManagement" component={ServiceManagementScreen} />
            <Stack.Screen name="SalonManageMenu" component={require('../screens/SalonManageMenuScreen').default} />
            <Stack.Screen name="Facilities" component={require('../screens/FacilitiesScreen').default} />
            <Stack.Screen name="CustomerList" component={CustomerListScreen} />
            <Stack.Screen name="Membership" component={MembershipScreen} />
            <Stack.Screen name="SalonProfile" component={SalonProfileScreen} />
            <Stack.Screen name="OwnerProfile" component={require('../screens/OwnerProfileScreen').default} />
            <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
            <Stack.Screen name="Subscription" component={require('../screens/SubscriptionScreen').default} />
            <Stack.Screen name="NotificationCenter" component={require('../screens/NotificationCenterScreen').default} />
            <Stack.Screen name="UserProfileSetup" component={require('../screens/UserProfileSetupScreen').default} />
            <Stack.Screen name="SalonLiveMode" component={require('../screens/SalonLiveMode').default} />
            <Stack.Screen name="AllReviews" component={require('../screens/AllReviewsScreen').default} />
            <Stack.Screen name="Terms" component={require('../screens/TermsScreen').default} />
            <Stack.Screen name="PrivacyPolicy" component={require('../screens/PrivacyPolicyScreen').default} />
            <Stack.Screen name="HelpSupport" component={require('../screens/HelpSupportScreen').default} />
            <Stack.Screen name="SlotSelection" component={require('../screens/SlotSelectionScreen').default} />
            <Stack.Screen name="QRScanner" component={require('../screens/QRScannerScreen').default} />
            <Stack.Screen name="SalonAnalyze" component={require('../screens/SalonAnalyzeScreen').default} />
            <Stack.Screen name="Referral" component={require('../screens/ReferralScreen').default} />
        </Stack.Navigator>
    );
};

export default AuthStack;
