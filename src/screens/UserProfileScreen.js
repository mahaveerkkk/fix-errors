import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { signOut } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadImage, updateUserProfile, getFavorites, getUserProfile, deleteAccount } from '../services/api';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const UserProfileScreen = ({ navigation, route }) => {
    const { user } = route.params || {};
    const { isDarkMode, toggleTheme } = useTheme();
    const theme = getTheme(isDarkMode);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [bookingsCount, setBookingsCount] = useState(0);
    const [reviewsCount, setReviewsCount] = useState(0);

    useFocusEffect(
        React.useCallback(() => {
            fetchStats();
        }, [])
    );

    const fetchStats = async () => {
        const uid = user?._id || user?.id;
        if (uid) {
            try {
                const favs = await getFavorites(uid);
                setFavoritesCount(favs.length);

                const profile = await getUserProfile(uid);
                setBookingsCount(profile.bookingsCount || 0);
                setReviewsCount(profile.reviewsCount || 0);
            } catch (error) {
            }
        }
    };

    // Edit Profile State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editedName, setEditedName] = useState(user?.name || '');
    const [editedPhone, setEditedPhone] = useState(user?.phone || '');
    const [editedEmail, setEditedEmail] = useState(user?.email || '');

    // Settings State
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);

    const handleImageUpload = async () => {
        const { launchImageLibrary } = require('react-native-image-picker');
        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

        if (result.assets && result.assets.length > 0) {
            try {
                const asset = result.assets[0];
                const newPhotoUrl = await uploadImage(asset, 'profiles');
                await updateUserProfile(user._id || user.id, { profilePhoto: newPhotoUrl });
                setProfilePhoto(newPhotoUrl);
                Alert.alert('Success', 'Profile photo updated!');
            } catch (error) {
                Alert.alert('Error', 'Failed to update profile photo');
            }
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await AsyncStorage.clear();
                            await signOut();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    }
                }
            ]
        );
    };

    const handleSaveProfile = async () => {
        try {
            const updates = {
                name: editedName,
                phone: editedPhone,
                email: editedEmail
            };

            await updateUserProfile(user._id || user.id, updates);

            setEditModalVisible(false);
            Alert.alert("Success", "Profile updated successfully!");
        } catch (error) {
            Alert.alert("Error", "Failed to update profile");
        }
    };

    const handleNavigate = (routeName, params) => {
        // Try current navigation first, fallback to parent if not available
        try {
            if (navigation.canGoBack || navigation.navigate) {
                navigation.navigate(routeName, params);
            } else if (navigation.getParent()) {
                navigation.getParent().navigate(routeName, params);
            }
        } catch (e) {
            navigation.navigate(routeName, params);
        }
    };

    const renderMenuItem = (icon, label, onPress, rightElement, iconColor = '#7C4DFF', iconBg = '#F3E8FF') => (
        <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: isDarkMode ? '#2D2D3A' : '#F0F0F5' }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.menuLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#231F38' : iconBg }]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                </View>
                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{label}</Text>
            </View>
            {rightElement || <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#666' : '#BBB'} />}
        </TouchableOpacity>
    );

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone and all your data, bookings, wallet balance, and photos will be deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const uid = user?._id || user?.id;
                            if (uid) {
                                setSettingsModalVisible(false);
                                await deleteAccount(uid);
                                await AsyncStorage.clear();
                                await signOut();
                                Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'Login' }],
                                });
                            }
                        } catch (error) {
                            Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="Profile" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}>

                {/* Profile Header - Luxury Avatar & VIP Badge */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarGlowWrapper}>
                        <View style={[styles.avatarGlowRing, { borderColor: isDarkMode ? '#7C4DFF' : '#9061F9' }]}>
                            <Image
                                source={{ uri: profilePhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(editedName || 'User') + '&background=7C4DFF&color=fff&bold=true' }}
                                style={styles.profileImage}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.cameraButton}
                            onPress={handleImageUpload}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="camera" size={14} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.nameRow}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>{editedName || 'Guest User'}</Text>
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                            <Text style={styles.verifiedBadgeText}>Verified</Text>
                        </View>
                    </View>

                    <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{editedEmail || 'guest@example.com'}</Text>

                    <TouchableOpacity
                        style={[styles.editPillBtn, { backgroundColor: isDarkMode ? '#231F38' : '#F5F3FF', borderColor: isDarkMode ? '#7C4DFF' : '#DDD6FE' }]}
                        onPress={() => setEditModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="pencil-outline" size={13} color="#7C4DFF" style={{ marginRight: 4 }} />
                        <Text style={styles.editPillBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Clickable Luxury Stats Cards */}
                <View style={[styles.statsRow, { backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF', borderColor: isDarkMode ? '#2D2D3A' : '#EDE8F5' }]}>
                    <TouchableOpacity
                        style={styles.statChip}
                        onPress={() => handleNavigate('Bookings', { user })}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(124,77,255,0.15)' : '#F3E8FF' }]}>
                            <Ionicons name="calendar" size={18} color="#7C4DFF" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{bookingsCount}</Text>
                        <Text style={styles.statLabel}>Bookings</Text>
                    </TouchableOpacity>

                    <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#2D2D3A' : '#F0F0F5' }]} />

                    <TouchableOpacity
                        style={styles.statChip}
                        onPress={() => handleNavigate('ReviewList', { user })}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.15)' : '#FEF3C7' }]}>
                            <Ionicons name="star" size={18} color="#F59E0B" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{reviewsCount}</Text>
                        <Text style={styles.statLabel}>Reviews</Text>
                    </TouchableOpacity>

                    <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#2D2D3A' : '#F0F0F5' }]} />

                    <TouchableOpacity
                        style={styles.statChip}
                        onPress={() => handleNavigate('Favorites', { user })}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }]}>
                            <Ionicons name="heart" size={18} color="#EF4444" />
                        </View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{favoritesCount}</Text>
                        <Text style={styles.statLabel}>Favorites</Text>
                    </TouchableOpacity>
                </View>

                {/* Refer & Earn Glowing Luxury Banner */}
                <TouchableOpacity
                    style={styles.referralBanner}
                    onPress={() => handleNavigate('Referral', { user })}
                    activeOpacity={0.85}
                >
                    <View style={styles.referralGiftCircle}>
                        <Ionicons name="gift" size={24} color="#FFF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.referralBannerTitle}>Refer & Earn ₹200</Text>
                        <Text style={styles.referralBannerSubtitle}>Invite friends & get instant wallet cash</Text>
                    </View>
                    <View style={styles.invitePill}>
                        <Text style={styles.invitePillText}>Invite</Text>
                        <Ionicons name="arrow-forward" size={12} color="#7C4DFF" />
                    </View>
                </TouchableOpacity>

                {/* Section 1: My Activity */}
                <View style={[styles.menuCardNew, { backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF', borderColor: isDarkMode ? '#2D2D3A' : '#EDE8F5' }]}>
                    {renderMenuItem('calendar-outline', 'My Bookings', () => handleNavigate('Bookings', { user }), null, '#7C4DFF', '#F3E8FF')}
                    {renderMenuItem('heart-outline', 'Favorites', () => handleNavigate('Favorites', { user }), null, '#EF4444', '#FEE2E2')}
                    {renderMenuItem('wallet-outline', 'My Wallet & Cashback', () => handleNavigate('Wallet', { user }), null, '#10B981', '#ECFDF5')}
                </View>

                {/* Section 2: Preferences & Settings */}
                <View style={[styles.menuCardNew, { backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF', borderColor: isDarkMode ? '#2D2D3A' : '#EDE8F5' }]}>
                    {renderMenuItem('notifications-outline', 'Push Notifications', () => setNotificationsEnabled(!notificationsEnabled),
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: '#D1D5DB', true: '#7C4DFF' }}
                            thumbColor="#FFF"
                            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                        />,
                        '#F59E0B', '#FEF3C7'
                    )}
                    {renderMenuItem('moon-outline', 'Dark Mode', toggleTheme,
                        <Switch
                            value={isDarkMode}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#D1D5DB', true: '#7C4DFF' }}
                            thumbColor="#FFF"
                            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                        />,
                        '#6366F1', '#EEF2FF'
                    )}
                    {renderMenuItem('settings-outline', 'Settings & Privacy', () => setSettingsModalVisible(true), null, '#6B7280', '#F3F4F6')}
                </View>

                {/* Modern Luxury Logout Button */}
                <TouchableOpacity style={[styles.logoutBtnNew, { backgroundColor: isDarkMode ? '#2B171B' : '#FEF2F2' }]} onPress={handleLogout} activeOpacity={0.8}>
                    <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={styles.logoutBtnText}>Logout</Text>
                </TouchableOpacity>

                {/* Clean Developer Branding */}
                <View style={styles.brandingFooter}>
                    <Text style={styles.versionLabel}>StylQ App • Version 1.0.4</Text>
                    <View style={styles.madeWithRow}>
                        <Text style={styles.madeWithText}>Made with</Text>
                        <Ionicons name="heart" size={11} color="#EF4444" style={{ marginHorizontal: 3 }} />
                        <Text style={styles.madeWithText}>by Mahaveer</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={editModalVisible}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                            value={editedName}
                            onChangeText={setEditedName}
                            placeholder="Enter your name"
                            placeholderTextColor={theme.colors.textLight}
                        />

                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                            value={editedPhone}
                            onChangeText={setEditedPhone}
                            placeholder="Enter your phone"
                            keyboardType="phone-pad"
                            placeholderTextColor={theme.colors.textLight}
                        />

                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Email</Text>
                        <TextInput
                            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
                            value={editedEmail}
                            onChangeText={setEditedEmail}
                            placeholder="Enter your email"
                            keyboardType="email-address"
                            placeholderTextColor={theme.colors.textLight}
                        />

                        <Button title="Save Changes" onPress={handleSaveProfile} style={{ marginTop: 20 }} />
                    </View>
                </View>
            </Modal>

            {/* Settings Modal - Fully Fixed Navigation */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={settingsModalVisible}
                onRequestClose={() => setSettingsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Settings & Support</Text>
                            <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        {renderMenuItem('document-text-outline', 'Terms of Service', () => {
                            setSettingsModalVisible(false);
                            handleNavigate('Terms');
                        })}
                        {renderMenuItem('shield-checkmark-outline', 'Privacy Policy', () => {
                            setSettingsModalVisible(false);
                            handleNavigate('PrivacyPolicy');
                        })}
                        {renderMenuItem('help-circle-outline', 'Help & Support', () => {
                            setSettingsModalVisible(false);
                            handleNavigate('HelpSupport', { user });
                        })}
                        {renderMenuItem('trash-outline', 'Delete Account', handleDeleteAccount, <Ionicons name="chevron-forward" size={18} color="#EF4444" />, '#EF4444', '#FEE2E2')}

                        <Text style={[styles.versionText, { color: theme.colors.textLight }]}>StylQ v1.0.4 • Build 5</Text>
                    </View>
                </View>
            </Modal>

        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarGlowWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarGlowRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2.5,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImage: {
        width: 86,
        height: 86,
        borderRadius: 43,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#7C4DFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 3,
    },
    userName: {
        fontSize: 20,
        fontWeight: '800',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 2,
    },
    verifiedBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#10B981',
    },
    userEmail: {
        fontSize: 13,
        marginBottom: 12,
    },
    editPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    editPillBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7C4DFF',
    },

    // STATS
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    statChip: {
        flex: 1,
        alignItems: 'center',
    },
    statIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    statValue: {
        fontSize: 17,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '600',
        marginTop: 1,
    },
    statDivider: {
        width: 1,
        height: 36,
    },

    // REFERRAL BANNER
    referralBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#7C4DFF',
        borderRadius: 20,
        padding: 14,
        paddingHorizontal: 16,
        marginBottom: 18,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    referralGiftCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    referralBannerTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
    },
    referralBannerSubtitle: {
        color: '#E0E7FF',
        fontSize: 11,
        marginTop: 2,
    },
    invitePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        gap: 3,
    },
    invitePillText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '800',
    },

    // MENU CARDS
    menuCardNew: {
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuLabel: {
        fontSize: 14.5,
        fontWeight: '600',
    },

    // LOGOUT
    logoutBtnNew: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 16,
        marginTop: 6,
        marginBottom: 20,
    },
    logoutBtnText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '700',
    },

    // FOOTER
    brandingFooter: {
        alignItems: 'center',
        marginBottom: 20,
    },
    versionLabel: {
        fontSize: 11.5,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    madeWithRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    madeWithText: {
        fontSize: 11,
        color: '#9CA3AF',
    },

    // MODAL
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    inputLabel: {
        fontSize: 13,
        marginBottom: 6,
        marginTop: 12,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
    },
    versionText: {
        textAlign: 'center',
        marginTop: 30,
        fontSize: 12,
        fontWeight: '500',
    }
});

export default UserProfileScreen;
