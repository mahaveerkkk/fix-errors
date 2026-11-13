import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image,
    Alert,
    Switch
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { updateSalon, deleteAccount } from '../services/api';

const SalonSettingsScreen = ({ route }) => {
    const navigation = useNavigation();
    const { salon, user } = route.params || {};
    const { isDarkMode, toggleTheme } = useTheme();
    const theme = getTheme(isDarkMode);

    const ownerName = user?.name || salon?.ownerName || 'Salon Owner';
    const ownerPhoto = user?.profilePhoto || `https://ui-avatars.com/api/?name=${ownerName}&background=4CAF50&color=fff`;

    // Appointment toggle state
    const [appointmentEnabled, setAppointmentEnabled] = useState(
        salon?.appointmentSettings?.enabled !== false // default true
    );

    const handleAppointmentToggle = async (value) => {
        setAppointmentEnabled(value);
        try {
            await updateSalon(salon._id, {
                appointmentSettings: {
                    ...salon?.appointmentSettings,
                    enabled: value,
                }
            });
            Alert.alert(
                value ? '📅 Appointments Enabled' : '📅 Appointments Disabled',
                value
                    ? 'Customers can now book appointments at your salon.'
                    : 'Appointment option is now hidden. Only Live Queue will be available.'
            );
        } catch (e) {
            setAppointmentEnabled(!value); // revert on error
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }]
                        });
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Business Account',
            'Warning: This will permanently delete your salon owner account, salon listing, staff profiles, services, booking history, and wallet. All data will be lost forever and this action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const uid = user?._id || user?.id;
                            if (uid) {
                                await deleteAccount(uid);
                                await AsyncStorage.clear();
                                Alert.alert('Account Deleted', 'Your business account has been successfully deleted.');
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'Login' }]
                                });
                            }
                        } catch (error) {
                            Alert.alert('Error', error.message || 'Failed to delete account.');
                        }
                    }
                }
            ]
        );
    };

    const menuSections = [
        {
            title: 'Profile & Business',
            items: [
                {
                    title: 'Owner Profile',
                    icon: 'person',
                    color: '#4CAF50',
                    onPress: () => navigation.navigate('OwnerProfile', { user, salon })
                },
                {
                    title: 'Salon Profile',
                    icon: 'storefront',
                    color: '#2196F3',
                    onPress: () => navigation.navigate('SalonProfile', { salon })
                },
                {
                    title: 'Subscription',
                    icon: 'diamond',
                    color: '#9C27B0',
                    onPress: () => navigation.navigate('Subscription', { salon })
                }
            ]
        },
        {
            title: 'Preferences',
            items: [
                {
                    title: 'Appointment Booking',
                    subtitle: appointmentEnabled ? 'Customers can book appointments' : 'Only Live Queue available',
                    icon: 'calendar',
                    color: '#3B82F6',
                    isToggle: true,
                    value: appointmentEnabled,
                    onToggle: handleAppointmentToggle
                },
                {
                    title: 'Notifications',
                    icon: 'notifications',
                    color: '#FF9800',
                    onPress: () => navigation.navigate('NotificationCenter')
                },
                {
                    title: 'Dark Mode',
                    icon: 'moon',
                    color: isDarkMode ? '#FFC107' : '#607D8B',
                    isToggle: true,
                    value: isDarkMode,
                    onToggle: toggleTheme
                }
            ]
        },
        {
            title: 'Support & Security',
            items: [
                {
                    title: 'Help & Support',
                    icon: 'help-circle',
                    color: '#00BCD4',
                    onPress: () => navigation.navigate('HelpSupport', { user })
                },
                {
                    title: 'Terms of Service',
                    icon: 'document-text',
                    color: '#795548',
                    onPress: () => navigation.navigate('Terms')
                },
                {
                    title: 'Privacy Policy',
                    icon: 'shield-checkmark',
                    color: '#3F51B5',
                    onPress: () => navigation.navigate('PrivacyPolicy')
                },
                {
                    title: 'Delete Account',
                    icon: 'trash',
                    color: '#EF4444',
                    onPress: handleDeleteAccount
                }
            ]
        }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

            {/* Header with Profile */}
            <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card */}
                <TouchableOpacity
                    style={[styles.profileCard, { backgroundColor: theme.colors.surface }]}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('OwnerProfile', { user, salon })}
                >
                    <Image source={{ uri: ownerPhoto }} style={styles.avatar} />
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.colors.text }]}>{ownerName}</Text>
                        <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]}>Salon Owner</Text>
                    </View>
                    <View style={[styles.editBadge, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}>
                        <Ionicons name="create-outline" size={16} color="#4CAF50" />
                    </View>
                </TouchableOpacity>

                {/* Menu Sections */}
                {menuSections.map((section, sIndex) => (
                    <View key={sIndex} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{section.title}</Text>
                        <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
                            {section.items.map((item, iIndex) => (
                                <TouchableOpacity
                                    key={iIndex}
                                    style={[
                                        styles.menuItem,
                                        iIndex < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: theme.colors.divider }]
                                    ]}
                                    activeOpacity={item.isToggle ? 1 : 0.7}
                                    onPress={item.isToggle ? null : item.onPress}
                                >
                                    <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
                                        <Ionicons name={item.icon} size={20} color={item.color} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.menuItemTitle, { color: theme.colors.text, marginLeft: 0 }]}>{item.title}</Text>
                                        {item.subtitle && (
                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 }}>{item.subtitle}</Text>
                                        )}
                                    </View>
                                    {item.isToggle ? (
                                        <Switch
                                            value={item.value}
                                            onValueChange={item.onToggle}
                                            trackColor={{ false: theme.colors.border, true: '#4ADE80' }}
                                            thumbColor={item.value ? '#4CAF50' : '#FFF'}
                                        />
                                    ) : (
                                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Logout Button */}
                <TouchableOpacity
                    style={[styles.logoutBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}
                    activeOpacity={0.8}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* Version & Branding */}
                <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
                    <Text style={[styles.versionText, { color: theme.colors.textLight }]}>Version 1.0.4</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                        <Text style={{ fontSize: 12, color: theme.colors.textLight, fontWeight: '500' }}>Made with</Text>
                        <Ionicons name="heart" size={12} color="#FF4D6A" />
                        <Text style={{ fontSize: 12, color: theme.colors.textLight, fontWeight: '500' }}>by Mahaveer</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0'
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937'
    },
    content: {
        padding: 20,
        paddingBottom: 100
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 24,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#4CAF50'
    },
    profileInfo: {
        flex: 1,
        marginLeft: 14
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937'
    },
    profileRole: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2
    },
    editBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    section: {
        marginBottom: 20
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 10,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    sectionCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    menuItemTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#1F2937',
        marginLeft: 12
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 14,
        marginTop: 10,
        gap: 8
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444'
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 20
    }
});

export default SalonSettingsScreen;
