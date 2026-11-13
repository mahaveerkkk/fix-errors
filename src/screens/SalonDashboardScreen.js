import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    ScrollView,
    Image,
    Dimensions,
    Linking,
    Alert,
    Modal,
    ToastAndroid,
    Vibration
} from 'react-native';
import { getEarnings, respondToBooking, getSalonQueue, getSalonById, toggleBreak, getUpcomingAppointments, quickAddWalkIn } from '../services/api';
import { getUnreadCount } from '../utils/notificationStorage';
import io from 'socket.io-client';
import { Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WalkInModal from '../components/salon/WalkInModal';
import AppUpdateModal from '../components/home/AppUpdateModal';
import VisitorsStoryBar from '../components/salon/VisitorsStoryBar';

import { ENV } from '../config/env';

const { width } = Dimensions.get('window');
const SOCKET_URL = ENV.SOCKET_URL;

const SalonDashboardScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { user, salon } = route.params || {};

    const [isShopOpen, setIsShopOpen] = useState(false);
    const [stats, setStats] = useState({ served: 0, earnings: 0 });
    const [salonId, setSalonId] = useState(null);
    const [socket, setSocket] = useState(null);
    const [queueList, setQueueList] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    // const [currentBooking, setCurrentBooking] = useState(null); // Used for notification or list
    const [pendingRequests, setPendingRequests] = useState([]); // New state for "New Requests" list
    const [isWalkInVisible, setWalkInVisible] = useState(false); // Walk-in Modal state
    const [salonData, setSalonData] = useState(null); // Full salon data for WalkInModal
    const [hasUnread, setHasUnread] = useState(false); // Unread notification badge
    const [appointmentCount, setAppointmentCount] = useState(0); // Upcoming appointment count

    // Close Blocked Modal State
    const [closeBlockedModal, setCloseBlockedModal] = useState(false);
    const [activeCustomerCount, setActiveCustomerCount] = useState(0);

    // Break Feature State
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [breakEndTime, setBreakEndTime] = useState(null);
    const [breakTimeLeft, setBreakTimeLeft] = useState('');
    const [showBreakModal, setShowBreakModal] = useState(false);
    const BREAK_OPTIONS = [5, 10, 15, 20, 30]; // minutes

    // Banner Slider State
    const [activeBanner, setActiveBanner] = useState(0);
    const BANNERS = [
        { icon: 'camera-outline', color: '#7C4DFF', bg: '#F3E8FF', title: 'Upload Salon Photos', subtitle: 'Attract more customers with stunning images', btn: 'Add Photos' },
        { icon: 'cut-outline', color: '#E91E63', bg: '#FCE4EC', title: 'Add Your Services', subtitle: 'List your services to get more bookings', btn: 'Add Now' },
        { icon: 'star-outline', color: '#FF9800', bg: '#FFF3E0', title: 'Get More Reviews', subtitle: 'Ask happy customers to leave a review', btn: 'Learn More' },
        { icon: 'trending-up-outline', color: '#4CAF50', bg: '#E8F5E9', title: 'Grow Your Business', subtitle: 'Share your profile to reach new customers', btn: 'Share Now' },
    ];

    // Use Focus Effect to refresh data every time screen is focused
    useFocusEffect(
        useCallback(() => {
            if (salonId) {
                fetchStats(salonId);
                fetchQueueDetails(salonId);
                // Fetch appointment count
                getUpcomingAppointments(salonId)
                    .then(data => setAppointmentCount((data.appointments || []).length))
                    .catch(() => { });
            }
            // Check for unread notifications
            getUnreadCount().then(count => setHasUnread(count > 0));
        }, [salonId])
    );

    // Initial setup (run once)
    useEffect(() => {
        if (salon) {
            setSalonId(salon._id);
            setIsShopOpen(salon.status === 'open');
            fetchSalonData(salon._id); // Fetch full salon data for WalkInModal

            // Check if salon is already on break
            if (salon.breakInfo?.isOnBreak && salon.breakInfo?.breakEndTime) {
                const endTime = new Date(salon.breakInfo.breakEndTime);
                if (endTime > new Date()) {
                    setIsOnBreak(true);
                    setBreakEndTime(endTime);
                } else {
                    // Break already expired, clear it
                    setIsOnBreak(false);
                }
            }

            // Connect to Socket
            const newSocket = io(SOCKET_URL);
            setSocket(newSocket);
            return () => newSocket.disconnect();
        }
    }, [salon]);

    // Fetch full salon data for WalkInModal
    const fetchSalonData = async (id) => {
        try {
            const data = await getSalonById(id);
            setSalonData(data);
        } catch (e) { /* removed */; }
    };

    useEffect(() => {
        if (socket && salonId) {
            socket.emit('joinRoom', salonId);

            // Listeners...
            socket.on('newBooking', (booking) => {
                setPendingRequests(prev => [booking, ...prev]);
                fetchQueueDetails(salonId);
            });

            socket.on('queueUpdate', (data) => {
                if (String(data.salonId) === String(salonId)) fetchQueueDetails(salonId);
            });

            socket.on('customerStatusUpdate', () => {
                fetchQueueDetails(salonId);
            });

            // Listen for break status updates
            socket.on('shopStatusUpdate', (data) => {
                if (String(data.salonId) === String(salonId)) {
                    if (data.isOnBreak !== undefined) {
                        setIsOnBreak(data.isOnBreak);
                        if (data.isOnBreak && data.breakEndTime) {
                            setBreakEndTime(new Date(data.breakEndTime));
                        } else {
                            setBreakEndTime(null);
                        }
                    }
                    if (data.status) {
                        setIsShopOpen(data.status === 'open');
                    }
                }
            });
        }
    }, [socket, salonId]);

    // Break Countdown Timer
    useEffect(() => {
        if (!isOnBreak || !breakEndTime) {
            setBreakTimeLeft('');
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const diff = breakEndTime - now;
            if (diff <= 0) {
                // Break expired — auto end
                setIsOnBreak(false);
                setBreakEndTime(null);
                setBreakTimeLeft('');
                // Auto-end break on server
                toggleBreak(salonId, 'end').catch(() => { });
                return;
            }
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setBreakTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [isOnBreak, breakEndTime, salonId]);

    const fetchStats = async (id) => {
        try {
            const data = await getEarnings(id);
            // Assuming the API returns totalEarnings and bookingCount
            setStats({ served: data.bookingCount || 0, earnings: data.totalEarnings || 0 });
        } catch (e) { /* removed */; }
    };

    const fetchQueueDetails = async (id) => {
        try {
            const data = await getSalonQueue(id);
            const queue = data.queue || [];
            // Filter locally for display: 
            // "Pending" -> New Requests
            // "Accepted" -> Active/Queue
            const pending = queue.filter(b => b.status === 'pending');
            const active = queue.filter(b => b.status === 'accepted' || b.status === 'arrived');

            setPendingRequests(pending);
            setQueueList(active); // Used for stats or "Active" count
        } catch (e) { }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (salonId) { fetchStats(salonId); fetchQueueDetails(salonId); }
        setTimeout(() => setRefreshing(false), 1000);
    }, [salonId]);


    const handleAcceptBooking = async (bookingId) => {
        try {
            await respondToBooking(bookingId, 'accept');
            // Optimistic Update
            setPendingRequests(prev => prev.filter(b => b._id !== bookingId));
            fetchQueueDetails(salonId); // Full refresh
            // Alert.alert('Success', 'Booking Accepted'); 
        }
        catch (error) { /* Alert.alert('Error', 'Failed to accept booking'); */ }
    };

    const handleRejectBooking = async (bookingId) => {
        try {
            await respondToBooking(bookingId, 'reject');
            setPendingRequests(prev => prev.filter(b => b._id !== bookingId));
        }
        catch (error) { /* Alert.alert('Error', 'Failed to reject booking'); */ }
    };

    // Handle Break Start
    const handleStartBreak = async (duration) => {
        try {
            setShowBreakModal(false);
            const result = await toggleBreak(salonId, 'start', duration);
            setIsOnBreak(true);
            setBreakEndTime(new Date(result.breakEndTime));
        } catch (error) {
            Alert.alert('Error', 'Failed to start break: ' + error.message);
        }
    };

    const [quickAdding, setQuickAdding] = useState(false);

    // 1-Click Fast Walk-in Customer Handler
    const handleQuickAddWalkIn = async () => {
        if (quickAdding || !salonId) return;
        setQuickAdding(true);
        try {
            const res = await quickAddWalkIn(salonId);
            try {
                Vibration.vibrate(80);
            } catch (vErr) {}

            if (Platform.OS === 'android') {
                ToastAndroid.show(`⚡ Token #${res.tokenNumber} Added to Queue!`, ToastAndroid.SHORT);
            } else {
                Alert.alert('Customer Added', `Token #${res.tokenNumber} added to queue!`);
            }
            fetchQueueDetails(salonId);
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to add quick walk-in');
        } finally {
            setQuickAdding(false);
        }
    };

    // --- Render Components ---

    // Auto-rotate banners
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveBanner(prev => (prev + 1) % BANNERS.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    const renderHeader = () => {
        const salonInitial = (salon?.name || 'S')[0].toUpperCase();
        return (
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => navigation.navigate('SalonProfile', { salon })}>
                        <View style={styles.salonAvatarCircle}>
                            {salon?.images?.[0] ? (
                                <Image source={{ uri: salon.images[0] }} style={styles.salonAvatarImg} />
                            ) : (
                                <Text style={styles.salonAvatarText}>{salonInitial}</Text>
                            )}
                            <View style={styles.onlineDot} />
                        </View>
                    </TouchableOpacity>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[styles.salonName, { color: theme.colors.text }]} numberOfLines={1}>
                            {salon?.name || 'My Salon'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Ionicons name="star" size={14} color="#FFC107" />
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginLeft: 4, fontWeight: '600' }}>
                                {salon?.rating || '4.8'} Rating
                            </Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.notifBtn, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]}
                    onPress={() => navigation.navigate('NotificationCenter')}
                >
                    <Ionicons name="notifications-outline" size={22} color={isDarkMode ? '#FFF' : '#1A1F2B'} />
                    {hasUnread && <View style={styles.notifDot} />}
                </TouchableOpacity>
            </View>
        );
    };

    const renderStatsGrid = () => (
        <View style={styles.statsGrid}>
            {/* Dark Revenue Card - Click to View Reports */}
            <TouchableOpacity
                style={[styles.revenueCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#1C2237' }]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Reports', { salon })}
            >
                <View style={styles.revenueOverlayCircle} />
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueAmount}>₹{stats.earnings}</Text>
                {/* Note: User image shows '$', assuming USD for design or keeping backend currency */}
                <View style={styles.growthRow}>
                    <Ionicons name="arrow-up" size={12} color="#4CAF50" />
                    <Text style={styles.growthText}>12% <Text style={{ color: '#888' }}>vs last week</Text></Text>
                </View>
            </TouchableOpacity>

            {/* Right Side Small Cards */}
            <View style={styles.rightStatsCol}>
                {/* Bookings Card */}
                <TouchableOpacity
                    style={[styles.statCardSmall, { backgroundColor: theme.colors.surface }]}
                    onPress={() => navigation.navigate('BookingHistory', { salon })}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.statLabelSmall, { color: theme.colors.textSecondary }]}>Today's Bookings</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text style={[styles.statValueSmall, { color: theme.colors.text }]}>{stats.served}</Text>
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Rating Card - Clickable to view all reviews */}
                <TouchableOpacity
                    style={[styles.statCardSmall, { backgroundColor: theme.colors.surface }]}
                    onPress={() => navigation.navigate('AllReviews', { salon: salonData || salon })}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.statLabelSmall, { color: theme.colors.textSecondary }]}>Shop Rating</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text style={[styles.statValueSmall, { color: theme.colors.text }]}>{salon?.rating || '4.8'}</Text>
                        <Ionicons name="star" size={16} color="#FFC107" style={{ marginLeft: 4 }} />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Toggle Shop Status API call
    const handleToggleShop = async (targetStatus) => {
        const newStatus = targetStatus || (isShopOpen ? 'closed' : 'open');
        if (newStatus === (isShopOpen ? 'open' : 'closed')) return;

        const performToggle = async () => {
            try {
                await require('../services/api').toggleSalonStatus(salonId, newStatus);
                setIsShopOpen(newStatus === 'open');
            } catch (error) {
                // Show custom modal ONLY when close is genuinely blocked due to active customers
                if (newStatus === 'closed' && error.message?.toLowerCase().includes('active')) {
                    const match = error.message?.match(/(\d+)\s*active/);
                    setActiveCustomerCount(match ? parseInt(match[1]) : 0);
                    setCloseBlockedModal(true);
                } else {
                    Alert.alert('Shop Status', error.message || 'Failed to update shop status');
                }
            }
        };

        if (newStatus === 'closed') {
            Alert.alert(
                'Close Shop?',
                'Are you sure you want to close the shop? Customers will not be able to join the queue while closed.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Close Shop', style: 'destructive', onPress: performToggle }
                ]
            );
        } else {
            performToggle();
        }
    };

    // NEW: Shop Status Controller Component
    const renderShopController = () => (
        <View style={styles.shopControllerContainer}>
            {/* Toggle Card */}
            <View style={[styles.shopToggleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, isShopOpen && styles.shopToggleCardActive]}>
                <View style={[styles.toggleButtonsRow, { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]}>
                    {/* CLOSED Button */}
                    <TouchableOpacity
                        style={[styles.toggleBtn, !isShopOpen && [styles.toggleBtnClosed, { backgroundColor: isDarkMode ? '#424242' : '#E5E5E5' }]]}
                        onPress={() => isShopOpen && handleToggleShop('closed')}
                    >
                        <Ionicons name="lock-closed" size={14} color={!isShopOpen ? (isDarkMode ? '#AAA' : '#555') : '#999'} />
                        <Text style={[styles.toggleBtnText, !isShopOpen && styles.toggleBtnTextActive, { color: !isShopOpen ? (isDarkMode ? '#FFF' : '#555') : '#999' }]}>CLOSED</Text>
                    </TouchableOpacity>

                    {/* OPEN SHOP Button */}
                    <TouchableOpacity
                        style={[styles.toggleBtn, isShopOpen && styles.toggleBtnOpen]}
                        onPress={() => !isShopOpen && handleToggleShop('open')}
                    >
                        <Ionicons name="storefront" size={14} color={isShopOpen ? '#FFF' : '#999'} />
                        <Text style={[styles.toggleBtnText, isShopOpen && styles.toggleBtnTextOpen]}>OPEN SHOP</Text>
                    </TouchableOpacity>
                </View>

                {/* Status Message */}
                <View style={styles.statusMsgRow}>
                    {isShopOpen ? (
                        <>
                            <Ionicons name="wifi" size={14} color="#22C55E" />
                            <Text style={styles.statusMsgOnline}> You are Online!</Text>
                            <Text style={styles.statusMsgSub}> Shop is visible to users.</Text>
                        </>
                    ) : (
                        <Text style={styles.statusMsgOffline}>Shop is currently closed. No new bookings.</Text>
                    )}
                </View>
            </View>

            {/* Action Cards - Only visible when shop is OPEN */}
            {isShopOpen && (
                <View style={styles.actionCardsGrid}>
                    {/* 1-Tap Quick Token (Zero typing) */}
                    <TouchableOpacity
                        style={styles.actionCardPurple}
                        onPress={handleQuickAddWalkIn}
                        disabled={quickAdding}
                        activeOpacity={0.85}
                    >
                        <View style={styles.actionIconCircleWhite}>
                            <Ionicons name="flash" size={20} color="#7C3AED" />
                        </View>
                        <Text style={styles.actionCardTextWhite}>
                            {quickAdding ? 'Adding...' : `⚡ 1-Tap (#${queueList.length + 1})`}
                        </Text>
                    </TouchableOpacity>

                    {/* Custom Walk-in Modal */}
                    <TouchableOpacity
                        style={[styles.actionCardWhite, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setWalkInVisible(true)}
                    >
                        <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
                            <Ionicons name="walk" size={20} color={isDarkMode ? '#FFF' : '#1A1F2B'} />
                        </View>
                        <Text style={[styles.actionCardTextDark, { color: theme.colors.text }]}>+ Custom</Text>
                    </TouchableOpacity>

                    {/* Scan QR */}
                    <TouchableOpacity style={[styles.actionCardWhite, { backgroundColor: theme.colors.surface }]}>
                        <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
                            <Ionicons name="qr-code" size={20} color={isDarkMode ? '#FFF' : '#1A1F2B'} />
                        </View>
                        <Text style={[styles.actionCardTextDark, { color: theme.colors.text }]}>Scan QR</Text>
                    </TouchableOpacity>

                    {/* Queue */}
                    <TouchableOpacity
                        style={[styles.actionCardWhite, { backgroundColor: theme.colors.surface }]}
                        onPress={() => navigation.navigate('SalonLiveMode', { salonId })}
                    >
                        {queueList.length > 0 && (
                            <View style={styles.queueBadge}>
                                <Text style={styles.queueBadgeText}>{queueList.length}</Text>
                            </View>
                        )}
                        <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
                            <Ionicons name="people" size={20} color={isDarkMode ? '#FFF' : '#1A1F2B'} />
                        </View>
                        <Text style={[styles.actionCardTextDark, { color: theme.colors.text }]}>Queue</Text>
                    </TouchableOpacity>

                    {/* Take Break / On Break */}
                    {isOnBreak ? (
                        <TouchableOpacity
                            style={[styles.actionCardWhite, { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74' }]}
                            onPress={handleEndBreak}
                        >
                            <View style={[styles.actionIconCircleGray, { backgroundColor: '#FED7AA' }]}>
                                <Ionicons name="cafe" size={20} color="#EA580C" />
                            </View>
                            <Text style={[styles.actionCardTextDark, { color: '#EA580C', fontWeight: 'bold', fontSize: 11 }]}>☕ {breakTimeLeft || 'On Break'}</Text>
                            <Text style={{ fontSize: 9, color: '#F97316', marginTop: 2 }}>Tap to End</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.actionCardWhite, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowBreakModal(true)}
                        >
                            <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#331' : '#FFF7ED' }]}>
                                <Ionicons name="cafe" size={20} color="#F97316" />
                            </View>
                            <Text style={[styles.actionCardTextDark, { color: theme.colors.text }]}>Take Break</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Appointments & Analyze — Always visible (even when shop is closed) */}
            <View style={[styles.actionCardsGrid, { marginTop: isShopOpen ? 0 : 16 }]}>
                {/* Appointments - Premium Card */}
                <TouchableOpacity
                    style={[styles.actionCardWhite, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F8F5FF', borderColor: isDarkMode ? '#2D1B69' : '#E8DFFF', borderWidth: 1.5 }]}
                    onPress={() => navigation.navigate('AppointmentCalendar', { salon })}
                >
                    {appointmentCount > 0 && (
                        <View style={[styles.queueBadge, { backgroundColor: '#7C4DFF' }]}>
                            <Text style={styles.queueBadgeText}>{appointmentCount}</Text>
                        </View>
                    )}
                    <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#2D1B69' : '#EDE7FF' }]}>
                        <Ionicons name="calendar" size={22} color="#7C4DFF" />
                    </View>
                    <Text style={[styles.actionCardTextDark, { color: '#7C4DFF', fontWeight: '800' }]}>Appointments</Text>
                </TouchableOpacity>

                {/* Analyze - Premium Card */}
                <TouchableOpacity
                    style={[styles.actionCardWhite, { backgroundColor: isDarkMode ? '#1A2E1A' : '#F0FFF4', borderColor: isDarkMode ? '#1B4332' : '#C6F6D5', borderWidth: 1.5 }]}
                    onPress={() => navigation.navigate('Analytics', { salon })}
                >
                    <View style={[styles.actionIconCircleGray, { backgroundColor: isDarkMode ? '#1B4332' : '#C6F6D5' }]}>
                        <Ionicons name="analytics" size={22} color="#22C55E" />
                    </View>
                    <Text style={[styles.actionCardTextDark, { color: '#22C55E', fontWeight: '800' }]}>Analyze</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderNewRequests = () => (
        <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Bookings</Text>
                    {pendingRequests.length > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{pendingRequests.length}</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AppointmentCalendar')}>
                    <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>VIEW ALL</Text>
                </TouchableOpacity>
            </View>

            {pendingRequests.length === 0 ? (
                <View style={[styles.emptyState, { borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.textSecondary }}>No new requests</Text>
                </View>
            ) : (
                pendingRequests.map((booking, index) => (
                    <View key={booking._id || booking.id || `pending-${index}`} style={[styles.requestCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        {/* Price Tag - Top Right Corner */}
                        <View style={[styles.priceTagCorner, { backgroundColor: isDarkMode ? '#1B4D3E' : '#DCFCE7' }]}>
                            <Text style={[styles.priceText, { color: isDarkMode ? '#4ADE80' : '#15803D' }]}>${booking.totalAmount}</Text>
                        </View>

                        {/* Top Row: Avatar + Info + Call Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
                            <Image
                                source={{ uri: booking.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${booking.userId?.name || 'User'}` }}
                                style={styles.requestAvatar}
                            />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.requestName, { color: theme.colors.text }]}>{booking.userId?.name || 'Customer'}</Text>
                                <Text style={[styles.requestService, { color: theme.colors.primary }]}>🔥 {booking.services?.[0]?.name || 'Service'}{booking.services?.length > 1 ? ` +${booking.services.length - 1}` : ''}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="call" size={10} color={theme.colors.textSecondary} />
                                    <Text style={[styles.requestPhone, { color: theme.colors.textSecondary }]}>{booking.userId?.phone || booking.userId?.phoneNumber || 'Hidden'}</Text>
                                </View>
                            </View>
                            {/* Call Button */}
                            <TouchableOpacity
                                style={[styles.callBtn, { backgroundColor: isDarkMode ? '#1B4D3E' : '#F0FDF4' }]}
                                onPress={() => {
                                    const phone = booking.userId?.phone || booking.userId?.phoneNumber;
                                    if (phone && phone !== 'Hidden') {
                                        Linking.openURL(`tel:${phone}`);
                                    } else {
                                        Alert.alert('No Phone', 'Customer phone number not available');
                                    }
                                }}
                            >
                                <Ionicons name="call" size={16} color="#10B981" />
                            </TouchableOpacity>
                        </View>

                        {/* Actions */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: theme.colors.primary }]} onPress={() => handleAcceptBooking(booking._id)}>
                                <Text style={[styles.acceptText, { color: theme.colors.background }]}>Accept Booking</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.declineBtn, { borderColor: theme.colors.border, backgroundColor: 'transparent' }]} onPress={() => handleRejectBooking(booking._id)}>
                                <Text style={[styles.declineText, { color: theme.colors.textSecondary }]}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
            >
                <AppUpdateModal />
                {renderHeader()}
                {salonId && <VisitorsStoryBar salonId={salonId} />}
                {renderStatsGrid()}
                {renderShopController()}
                {renderNewRequests()}
            </ScrollView>

            {/* Walk-in Modal */}
            {salonData && (
                <WalkInModal
                    visible={isWalkInVisible}
                    onClose={() => setWalkInVisible(false)}
                    salon={salonData}
                    onAdded={() => {
                        fetchQueueDetails(salonId);
                        setWalkInVisible(false);
                    }}
                />
            )}

            {/* Cannot Close Shop Modal */}
            <Modal
                visible={closeBlockedModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setCloseBlockedModal(false)}
            >
                <View style={closeBlockedStyles.overlay}>
                    <View style={[closeBlockedStyles.container, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF' }]}>
                        {/* Warning Icon */}
                        <View style={closeBlockedStyles.iconCircle}>
                            <Ionicons name="people" size={32} color="#FFF" />
                        </View>

                        {/* Count Badge */}
                        <View style={closeBlockedStyles.countBadge}>
                            <Text style={closeBlockedStyles.countText}>{activeCustomerCount}</Text>
                        </View>
                        <Text style={[closeBlockedStyles.title, { color: isDarkMode ? '#FFF' : '#1A1F2B' }]}>Active Customers in Queue</Text>
                        <Text style={[closeBlockedStyles.subtitle, { color: isDarkMode ? '#AAA' : '#666' }]}>
                            You cannot close the shop while customers are being served or waiting. Please complete or cancel all bookings first.
                        </Text>

                        {/* Action Buttons */}
                        <TouchableOpacity
                            style={closeBlockedStyles.primaryBtn}
                            onPress={() => {
                                setCloseBlockedModal(false);
                                navigation.navigate('SalonLiveMode', { salonId });
                            }}
                        >
                            <Ionicons name="list" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={closeBlockedStyles.primaryBtnText}>Go to Queue</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={closeBlockedStyles.dismissBtn}
                            onPress={() => setCloseBlockedModal(false)}
                        >
                            <Text style={[closeBlockedStyles.dismissBtnText, { color: isDarkMode ? '#AAA' : '#888' }]}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Break Duration Modal */}
            {showBreakModal && (
                <View style={styles.breakModalOverlay}>
                    <View style={[styles.breakModalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.breakModalTitle, { color: theme.colors.text }]}>☕ Set Break Duration</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>New bookings will be paused during break</Text>
                        <View style={styles.breakOptionsGrid}>
                            {BREAK_OPTIONS.map(min => (
                                <TouchableOpacity
                                    key={min}
                                    style={[styles.breakOptionBtn, { borderColor: theme.colors.border }]}
                                    onPress={() => handleStartBreak(min)}
                                >
                                    <Text style={[styles.breakOptionTime, { color: theme.colors.text }]}>{min}</Text>
                                    <Text style={[styles.breakOptionLabel, { color: theme.colors.textSecondary }]}>min</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={styles.breakCancelBtn}
                            onPress={() => setShowBreakModal(false)}
                        >
                            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD', // Light Theme Background
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        marginBottom: 16
    },
    salonAvatarCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#7C4DFF',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    salonAvatarImg: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    salonAvatarText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    salonName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    notifBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notifDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF5252',
        borderWidth: 1.5,
        borderColor: '#F5F5F5',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#F8F9FD'
    },
    // BANNER SLIDER
    bannerContainer: {
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    bannerCard: {
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
    },
    bannerIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    bannerTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    bannerSubtitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 10,
        lineHeight: 18,
    },
    bannerBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
    },
    bannerBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    bannerDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
        gap: 6,
    },
    bannerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#DDD',
    },

    // STATS GRID
    statsGrid: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        gap: 16,
        marginBottom: 32
    },
    revenueCard: {
        flex: 1.2,
        backgroundColor: '#1C2237', // Dark Navy from image
        borderRadius: 24,
        padding: 20,
        justifyContent: 'space-between',
        height: 160,
        position: 'relative',
        overflow: 'hidden'
    },
    revenueOverlayCircle: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    revenueLabel: {
        color: '#8A8D96',
        fontSize: 14
    },
    revenueAmount: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginVertical: 8
    },
    growthRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    growthText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4
    },

    rightStatsCol: {
        flex: 1,
        gap: 16
    },
    statCardSmall: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    statLabelSmall: {
        color: '#888',
        fontSize: 12
    },
    statValueSmall: {
        color: '#1A1F2B',
        fontSize: 20,
        fontWeight: 'bold',
        marginRight: 8
    },
    activeBadge: {
        backgroundColor: '#F3E5F5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    activeBadgeText: {
        color: '#AB47BC',
        fontSize: 10,
        fontWeight: 'bold'
    },

    // NEW REQUESTS
    sectionContainer: {
        paddingHorizontal: 24
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    countBadge: {
        backgroundColor: '#FF5252',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8
    },
    countText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold'
    },
    viewAllText: {
        color: '#7C4DFF',
        fontWeight: 'bold',
        fontSize: 12
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 16,
        marginTop: 10
    },

    requestCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 16,
        paddingTop: 20, // More space for the top tag
        marginTop: 16,
        // Premium shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F0F0F0'
    },
    priceTagCorner: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#DCFCE7', // Light green bg
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomLeftRadius: 20,
        zIndex: 10
    },
    priceText: {
        color: '#15803D', // Dark green text
        fontSize: 14,
        fontWeight: 'bold'
    },
    requestAvatar: {
        width: 56, // Larger avatar
        height: 56,
        borderRadius: 18, // Squircle
        backgroundColor: '#F3F4F6'
    },
    requestName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827', // Darker text
        marginBottom: 2
    },
    requestService: {
        color: '#7C4DFF', // Purple brand accent
        fontSize: 13,
        fontWeight: '600',
        marginRight: 6
    },
    requestPhone: {
        color: '#999',
        fontSize: 12,
        marginLeft: 4
    },
    priceTag: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        height: 24, // Fixed height for alignment
        justifyContent: 'center'
    },
    priceText: {
        color: '#15803D',
        fontSize: 13,
        fontWeight: 'bold'
    },
    callBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F0FDF4', // Very light green
        justifyContent: 'center',
        alignItems: 'center',
        // Floating right style
        marginTop: 8
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20 // More spacing from content
    },
    acceptBtn: {
        flex: 1,
        backgroundColor: '#1E293B', // Dark slate/navy
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    acceptText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14
    },
    declineBtn: {
        flex: 1,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    declineText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14
    },

    // ========================
    // SHOP STATUS CONTROLLER
    // ========================
    shopControllerContainer: {
        paddingHorizontal: 24,
        marginBottom: 24
    },
    shopToggleCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F0F0F0'
    },
    shopToggleCardActive: {
        borderColor: '#BBF7D0',
        shadowColor: '#22C55E',
        shadowOpacity: 0.1
    },
    toggleButtonsRow: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        padding: 4,
        height: 56
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 14
    },
    toggleBtnClosed: {
        backgroundColor: '#E5E5E5'
    },
    toggleBtnOpen: {
        backgroundColor: '#22C55E',
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    toggleBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#999'
    },
    toggleBtnTextActive: {
        color: '#555'
    },
    toggleBtnTextOpen: {
        color: '#FFF'
    },
    statusMsgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12
    },
    statusMsgOnline: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#22C55E'
    },
    statusMsgSub: {
        fontSize: 12,
        color: '#888'
    },
    statusMsgOffline: {
        fontSize: 12,
        color: '#999'
    },

    // ACTION CARDS GRID
    actionCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16
    },
    actionCardPurple: {
        width: (width - 60) / 2,
        backgroundColor: '#7C3AED',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4
    },
    actionCardWhite: {
        width: (width - 60) / 2,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        position: 'relative'
    },
    actionIconCircleWhite: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    actionIconCircleGray: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    actionCardTextWhite: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFF'
    },
    actionCardTextDark: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    queueBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#EF4444',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    queueBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFF'
    },

    // BREAK MODAL STYLES
    breakModalOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999
    },
    breakModalContent: {
        width: width - 60,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10
    },
    breakModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8
    },
    breakOptionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20
    },
    breakOptionBtn: {
        width: 70,
        height: 70,
        borderRadius: 16,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(249,115,22,0.05)'
    },
    breakOptionTime: {
        fontSize: 22,
        fontWeight: 'bold'
    },
    breakOptionLabel: {
        fontSize: 11,
        marginTop: 2
    },
    breakCancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 32
    }
});

// Close Blocked Modal Styles
const closeBlockedStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width - 60,
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 15,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    countBadge: {
        backgroundColor: '#EF4444',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -24,
        marginLeft: 50,
        borderWidth: 3,
        borderColor: '#FFF',
        marginBottom: 16,
    },
    countText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    primaryBtn: {
        flexDirection: 'row',
        backgroundColor: '#1A1F2B',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 12,
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    dismissBtn: {
        paddingVertical: 10,
    },
    dismissBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SalonDashboardScreen;
