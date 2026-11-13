import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    Alert,
    Dimensions,
    StatusBar,
    Modal,
    TextInput,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
    AppState,
    ToastAndroid,
    Vibration
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api, { quickAddWalkIn, getSalonById, sendStatusToCustomer } from '../services/api';
import io from 'socket.io-client';
import { ENV } from '../config/env';
import WalkInModal from '../components/salon/WalkInModal';
import CustomerProfileSheet from '../components/salon/CustomerProfileSheet';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const { width, height } = Dimensions.get('window');
// Use centralized config for Socket URL
const SOCKET_URL = ENV.SOCKET_URL;

const SalonLiveMode = ({ navigation, route }) => {
    // FIX: Handle both { salonId: "..." } and { salon: { _id: "..." } } param structures
    const params = route.params || {};
    // Prioritize direct salonId, fallback to salon._id
    const salonId = params.salonId || params.salon?._id;

    if (!salonId) {
        // Optional: navigation.goBack() or show error UI if critical
    }

    const [queue, setQueue] = useState([]);
    const [nowServing, setNowServing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [shopStatus, setShopStatus] = useState(params.salon?.status || 'open');
    const [pendingBookings, setPendingBookings] = useState([]);
    const [salon, setSalon] = useState(null);
    const [isSocketConnected, setIsSocketConnected] = useState(true);
    const [, setTick] = useState(0); // Force re-render for live timer

    // Live ticking timer — updates "Started X mins ago" every 10 seconds for accuracy
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(prev => prev + 1);
        }, 10000); // Every 10 seconds for responsive timer
        return () => clearInterval(timer);
    }, []);

    // Keep screen awake while Live Mode is open
    useEffect(() => {
        let activated = false;
        try {
            const { activateKeepAwake, deactivateKeepAwake } = require('@sayem314/react-native-keep-awake');
            activateKeepAwake();
            activated = true;
            return () => deactivateKeepAwake();
        } catch (e) {
            // Package not installed — screen may sleep normally
        }
    }, []);

    // Walk-in Modal State
    const [isWalkInVisible, setWalkInVisible] = useState(false);

    // Customer Profile Sheet State
    const [profileSheetVisible, setProfileSheetVisible] = useState(false);
    const [profileUserId, setProfileUserId] = useState(null);
    const [profileCustomerImage, setProfileCustomerImage] = useState(null);
    const [profileCustomerName, setProfileCustomerName] = useState('');

    // Close Blocked Modal State
    const [closeBlockedModal, setCloseBlockedModal] = useState(false);
    const [activeCustomerCount, setActiveCustomerCount] = useState(0);

    // --- NEW: Cancel Modal State ---
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const cancellationReasons = [
        "Customer No Show",
        "Late Arrival",
        "Salon Emergency",
        "Staff Unavailable",
        "Other"
    ];

    // --- Send Status Modal State ---
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedStatusBookingId, setSelectedStatusBookingId] = useState(null);
    const [customStatusText, setCustomStatusText] = useState('');
    const quickStatusOptions = [
        "Your turn is next! 🎯",
        "Please be ready 🙏",
        "~5 mins left ⏱️",
        "Coming soon! 🔜"
    ];

    const handleSendStatus = async () => {
        const finalMessage = statusMessage || customStatusText;
        if (!finalMessage) {
            Alert.alert("Message Required", "Please select or type a status message.");
            return;
        }
        try {
            await sendStatusToCustomer(selectedStatusBookingId, salonId, finalMessage);
            setStatusModalVisible(false);
            setStatusMessage('');
            setCustomStatusText('');
            setSelectedStatusBookingId(null);
            fetchQueue();
            Alert.alert("✅ Sent!", "Status message sent to customer.");
        } catch (error) {
            Alert.alert("Error", error.message || "Failed to send status");
        }
    };

    // --- NEW: Animation for Live Card Border ---
    const moveAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(moveAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false, // Border color interpolation requires false
            })
        ).start();
    }, []);

    const borderColor = moveAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['#E0E0E0', '#22C55E', '#E0E0E0']
    });

    const borderWidth = moveAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 3, 1]
    });
    // ----------------------------------------

    const socketRef = useRef(null);

    // ... (Socket useEffect exists below, keeping it)

    // NEW: Handle Cancellation
    const handleCancelQueueBooking = async () => {
        if (!cancelReason) {
            Alert.alert("Reason Required", "Please select a reason for cancellation.");
            return;
        }

        try {
            await api.updateQueue(salonId, 'cancel', cancelReason);
            setCancelModalVisible(false);
            setCancelReason('');
            fetchQueue(); // Refresh
            Alert.alert("Cancelled", "Booking has been cancelled.");
        } catch (error) {
            Alert.alert("Error", "Failed to cancel booking");
        }
    };

    // ... (Existing Socket useEffect)

    useEffect(() => {
        if (!salonId) return;

        fetchQueue();
        fetchSalon();

        // Socket Connection with Auto-Recovery & Resilient Reconnection
        socketRef.current = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        socketRef.current.on('connect', () => {
            setIsSocketConnected(true);
            socketRef.current.emit('joinRoom', salonId);
            fetchQueue(); // Sync latest queue upon connection
        });

        socketRef.current.on('reconnect', () => {
            setIsSocketConnected(true);
            socketRef.current.emit('joinRoom', salonId);
            fetchQueue(); // Auto-refresh immediately upon network reconnection
        });

        socketRef.current.on('queueUpdate', (data) => {
            fetchQueue();
        });

        socketRef.current.on('newBooking', (data) => {
            fetchQueue();
        });

        // NEW: Listen for shop status changes
        socketRef.current.on('shopStatusUpdate', (data) => {
            if (data.salonId === salonId) {
                setShopStatus(data.status);
            }
        });

        socketRef.current.on('disconnect', () => {
            setIsSocketConnected(false);
        });

        socketRef.current.on('connect_error', () => {
            setIsSocketConnected(false);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [salonId]);

    const fetchQueue = async () => {
        try {
            const response = await api.getSalonQueue(salonId);
            const allBookings = response.queue || [];

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            // Filter for ACTIVE flow
            const activeBookings = allBookings.filter(b => b.status === 'accepted' || b.status === 'arrived');
            // NEW: Filter for PENDING bookings (need accept/decline)
            const pending = allBookings.filter(b => b.status === 'pending');
            setPendingBookings(pending);
            if (activeBookings.length > 0) {
                setNowServing(activeBookings[0]);
                setQueue(activeBookings.slice(1));
            } else {
                setNowServing(null);
                setQueue([]);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const fetchSalon = async () => {
        try {
            const salonData = await getSalonById(salonId);
            setSalon(salonData);
            if (salonData?.status) {
                setShopStatus(salonData.status);
            }
        } catch (error) {
        }
    };

    const [quickAdding, setQuickAdding] = useState(false);

    // 1-Click Express Walk-in Handler (Zero Typing)
    const handleQuickAddWalkIn = async () => {
        if (quickAdding) return;
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
            fetchQueue();
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to add quick walk-in');
        } finally {
            setQuickAdding(false);
        }
    };

    // NEW: Accept booking handler
    const handleAcceptBooking = async (bookingId) => {
        try {
            await api.respondToBooking(bookingId, 'accept');
            fetchQueue(); // Refresh
        } catch (error) {
            Alert.alert('Error', 'Failed to accept booking');
        }
    };

    // NEW: Decline booking handler
    const handleDeclineBooking = async (bookingId) => {
        try {
            await api.respondToBooking(bookingId, 'reject');
            fetchQueue(); // Refresh
        } catch (error) {
            Alert.alert('Error', 'Failed to decline booking');
        }
    };

    const handleMarkDone = async () => {
        if (!nowServing) return;
        try {
            await api.completeBooking(nowServing._id);
            // Optimistic update handled by socket or re-fetch
            fetchQueue();
        } catch (error) {
            Alert.alert("Error", "Could not complete booking");
        }
    };

    const handleToggleShop = async () => {
        const newStatus = shopStatus === 'open' ? 'closed' : 'open';

        const performToggle = async () => {
            try {
                await api.toggleSalonStatus(salonId, newStatus);
                setShopStatus(newStatus);
                if (newStatus === 'closed') {
                    Alert.alert("Shop Closed", "You are now offline. Customers cannot join the queue.");
                    navigation.goBack();
                } else {
                    Alert.alert("Shop Open", "You are now live!");
                }
            } catch (error) {
                // Show custom modal ONLY when close is genuinely blocked due to active customers
                if (newStatus === 'closed' && error.message?.toLowerCase().includes('active')) {
                    const match = error.message?.match(/(\d+)\s*active/);
                    setActiveCustomerCount(match ? parseInt(match[1]) : 0);
                    setCloseBlockedModal(true);
                } else {
                    Alert.alert("Shop Status", error.message || "Failed to update status");
                }
            }
        };

        if (newStatus === 'closed') {
            Alert.alert(
                'Close Shop?',
                'Are you sure you want to close the shop? Customers will not be able to join the queue while offline.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Close Shop', style: 'destructive', onPress: performToggle }
                ]
            );
        } else {
            performToggle();
        }
    };

    const handleAddWalkIn = async () => {
        if (!walkInName || !walkInService) return;

        // In a real app, you'd hit an endpoint like /bookings/walk-in
        // For now, we'll simulate it or use a placeholder if backend allows
        try {
            // Mocking functionality as Backend might not have specific route yet
            // Just alerting for UI Demo purposes as requested
            Alert.alert("Success", "Walk-in added to queue!");
            setWalkInVisible(false);
            setWalkInName('');
            setWalkInService('');
            setWalkInPrice('');
            // Re-fetch to see if anything changed (if we had a real endpoint)
        } catch (e) {
            Alert.alert("Error", "Failed to add walk-in");
        }
    };

    // --- Render Helpers ---

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#1A1F2B" />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
                <View style={styles.liveIndicatorContainer}>
                    <View style={[styles.liveDotPulsing, !isSocketConnected && { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.headerTitle}>{isSocketConnected ? 'LIVE SALON' : 'RECONNECTING...'}</Text>
                </View>
                <Text style={styles.headerSubtitle}>{isSocketConnected ? 'Queue Management' : 'Restoring live connection...'}</Text>
            </View>

            <TouchableOpacity onPress={handleToggleShop} style={[styles.statusToggle, { backgroundColor: shopStatus === 'open' ? '#E8F5E9' : '#FFEBEE' }]}>
                <Text style={[styles.statusText, { color: shopStatus === 'open' ? '#2E7D32' : '#C62828' }]}>
                    {shopStatus === 'open' ? 'OPEN' : 'CLOSED'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486747.png' }} // Placeholder illustration
                style={styles.emptyImage}
            />
            <Text style={styles.emptyTitle}>Chair is Empty</Text>
            <Text style={styles.emptySubtitle}>No active customers right now.</Text>
            <TouchableOpacity style={styles.walkInLargeBtn} onPress={() => setWalkInVisible(true)}>
                <Text style={styles.walkInLargeText}>+ Add Walk-in Customer</Text>
            </TouchableOpacity>
        </View>
    );

    const renderActiveChair = () => {
        if (!nowServing) return renderEmptyState();

        const user = nowServing.userId || {};
        const phone = user.phone || user.phoneNumber || 'No phone';

        // Calculate time since service started (live-ticking via setTick)
        const getTimeElapsed = () => {
            if (!nowServing.serviceStartTime) return 'Started 0 mins ago';
            const start = new Date(nowServing.serviceStartTime);
            const now = new Date();
            const totalMins = Math.floor((now - start) / (1000 * 60));
            if (totalMins <= 0) return 'Started 0 mins ago';
            if (totalMins === 1) return 'Started 1 min ago';
            if (totalMins < 60) return `Started ${totalMins} mins ago`;
            const hours = Math.floor(totalMins / 60);
            const remainMins = totalMins % 60;
            if (hours < 24) {
                return remainMins > 0 ? `Started ${hours}h ${remainMins}m ago` : `Started ${hours}h ago`;
            }
            const days = Math.floor(hours / 24);
            return `Started ${days} day${days > 1 ? 's' : ''} ago`;
        };

        // Calculate estimated end time based on service durations
        const getEstimatedEndTime = () => {
            // Get total duration from all services
            let totalDuration = 0;
            if (Array.isArray(nowServing.services)) {
                nowServing.services.forEach(s => {
                    totalDuration += (s.duration || 30); // Default 30 mins if not set
                });
            } else {
                totalDuration = nowServing.estimatedDuration || 30;
            }

            // Calculate end time from start time
            let startTime;
            if (nowServing.serviceStartTime) {
                startTime = new Date(nowServing.serviceStartTime);
            } else {
                startTime = new Date(); // Use current time as fallback
            }

            const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);

            // Format as HH:MM AM/PM
            let hours = endTime.getHours();
            const minutes = endTime.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        };

        return (
            <Animated.View style={[styles.activeCard, { borderColor: borderColor, borderWidth: borderWidth }]}>
                {/* Header Row */}
                <View style={styles.activeHeader}>
                    <Text style={styles.activeLabel}>{nowServing.bookingType === 'appointment' ? '📅 APPOINTMENT' : 'IN THE CHAIR'}</Text>
                    <View style={styles.timerBadge}>
                        <View style={styles.liveIndicator} />
                        <Text style={styles.timerText}>Live</Text>
                    </View>
                </View>

                {/* Compact Customer Row */}
                <View style={styles.customerRow}>
                    {/* Avatar with Green Ring */}
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarRing}>
                            <Image
                                source={{ uri: user.profilePhoto || `https://ui-avatars.com/api/?name=${user.name || 'Client'}` }}
                                style={styles.avatarCompact}
                            />
                        </View>
                        <View style={styles.liveBadge}>
                            <Text style={styles.liveBadgeText}>Live</Text>
                        </View>
                    </View>

                    {/* Customer Info */}
                    <View style={styles.customerInfo}>
                        <Text style={styles.customerName}>{user.name || nowServing.walkInName || 'Walk-in'}</Text>
                        <Text style={styles.customerSubtitle}>{getTimeElapsed()}</Text>
                    </View>

                    {/* Call Button */}
                    <TouchableOpacity style={styles.callBtn} onPress={() => {
                        if (phone && phone !== 'No phone') {
                            require('react-native').Linking.openURL(`tel:${phone}`);
                        }
                    }}>
                        <Ionicons name="call" size={18} color="#22C55E" />
                    </TouchableOpacity>
                </View>

                {/* Status Row */}
                {nowServing.userStatus && (
                    <View style={styles.statusRow}>
                        <Ionicons name="walk" size={14} color="#F59E0B" />
                        <Text style={styles.statusText}>{nowServing.userStatus}</Text>
                    </View>
                )}

                {/* Service & Price Row */}
                <View style={styles.serviceRowCompact}>
                    <View style={styles.serviceBox}>
                        <Text style={styles.serviceLabelSmall}>SERVICE</Text>
                        <Text style={styles.serviceValueSmall}>
                            {Array.isArray(nowServing.services)
                                ? nowServing.services.map(s => s.name || s).join(', ')
                                : 'Custom Service'}
                        </Text>
                    </View>
                    <View style={styles.priceBox}>
                        <Text style={styles.serviceLabelSmall}>EST. END</Text>
                        <Text style={styles.estEndTime}>
                            {getEstimatedEndTime()}
                        </Text>
                    </View>
                </View>

                {/* Phone Number Row */}
                <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={14} color="#888" />
                    <Text style={styles.phoneText}>{phone}</Text>
                    <View style={styles.priceTagCorner}>
                        <Text style={styles.priceTagText}>₹{nowServing.totalAmount}</Text>
                    </View>
                </View>

                {/* View Full Profile Button */}
                {user._id && (
                    <TouchableOpacity
                        style={styles.viewProfileBtn}
                        onPress={() => {
                            setProfileUserId(user._id);
                            setProfileCustomerImage(user.profilePhoto);
                            setProfileCustomerName(user.name || 'Customer');
                            setProfileSheetVisible(true);
                        }}
                    >
                        <Ionicons name="analytics" size={14} color="#7C4DFF" />
                        <Text style={styles.viewProfileBtnText}>View Full Profile & Analytics</Text>
                        <Ionicons name="chevron-forward" size={12} color="#7C4DFF" />
                    </TouchableOpacity>
                )}

                {/* Actions */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity
                        style={[styles.actionBtnOutline, { borderColor: '#EF4444' }]}
                        onPress={() => setCancelModalVisible(true)}
                    >
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                        <Text style={[styles.actionTextOutline, { color: '#EF4444' }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleMarkDone}>
                        <Text style={styles.actionTextPrimary}>Mark Done</Text>
                        <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    const renderUpNext = () => {
        // Calculate total wait time for a person at position index
        const calculateWaitTime = (index) => {
            let totalWait = 0;

            // Add remaining time of nowServing
            if (nowServing) {
                let nowServingDuration = 0;
                if (Array.isArray(nowServing.services)) {
                    nowServing.services.forEach(s => {
                        nowServingDuration += (s.duration || 30);
                    });
                }
                // Calculate how much time has passed
                if (nowServing.serviceStartTime) {
                    const elapsed = Math.floor((Date.now() - new Date(nowServing.serviceStartTime).getTime()) / (1000 * 60));
                    const remaining = Math.max(0, nowServingDuration - elapsed);
                    totalWait += remaining;
                } else {
                    totalWait += nowServingDuration;
                }
            }

            // Add durations of all people ahead in queue
            for (let i = 0; i < index; i++) {
                const person = queue[i];
                if (Array.isArray(person.services)) {
                    person.services.forEach(s => {
                        totalWait += (s.duration || 30);
                    });
                } else {
                    totalWait += 30; // Default
                }
            }

            return totalWait;
        };

        return (
            <View style={styles.queueSection}>
                <View style={styles.queueHeader}>
                    <Text style={styles.queueTitle}>UP NEXT ({queue.length})</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                            style={styles.quickAddBtn}
                            onPress={handleQuickAddWalkIn}
                            disabled={quickAdding}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="flash" size={13} color="#FFF" />
                            <Text style={styles.quickAddBtnText}>
                                {quickAdding ? 'Adding...' : `⚡ 1-Tap (Token #${(nowServing ? 1 : 0) + queue.length + 1})`}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setWalkInVisible(true)} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                            <Text style={styles.addWalkInText}>+ Custom</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                    {queue.length === 0 ? (
                        <Text style={styles.emptyQueueText}>Queue is empty. Waiting for bookings...</Text>
                    ) : (
                        queue.map((item, index) => {
                            const waitMins = calculateWaitTime(index);
                            return (
                                <TouchableOpacity
                                    key={item._id || index}
                                    style={styles.queueCard}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (item.userId?._id) {
                                            setProfileUserId(item.userId._id);
                                            setProfileCustomerImage(item.userId.profilePhoto);
                                            setProfileCustomerName(item.userId.name || 'Customer');
                                            setProfileSheetVisible(true);
                                        }
                                    }}
                                >
                                    <View style={styles.queueTokenBadge}>
                                        <Text style={styles.queueTokenText}>{index + 1}</Text>
                                    </View>
                                    <Image
                                        source={{ uri: item.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${item.userId?.name || 'U'}` }}
                                        style={styles.queueAvatar}
                                    />
                                    <Text style={styles.queueName} numberOfLines={1}>{item.userId?.name || item.walkInName || 'User'}</Text>
                                    <Text style={styles.queueTokenDetail}>Token #{item.tokenNumber}</Text>
                                    <Text style={styles.queueService} numberOfLines={1}>
                                        {Array.isArray(item.services) ? item.services[0]?.name : 'Service'}
                                    </Text>
                                    <View style={styles.queueTime}>
                                        <Ionicons name="time-outline" size={10} color="#888" />
                                        <Text style={styles.queueTimeText}>~{waitMins}m</Text>
                                    </View>

                                    {/* Appointment Badge */}
                                    {item.bookingType === 'appointment' && item.appointmentSlot && (
                                        <View style={{ backgroundColor: '#EDE7F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 }}>
                                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#7C4DFF' }}>
                                                📅 {item.appointmentSlot.start}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Send Status Button */}
                                    {!item.isWalkIn && (
                                        <TouchableOpacity
                                            style={styles.sendStatusBtn}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                setSelectedStatusBookingId(item._id);
                                                setStatusMessage('');
                                                setCustomStatusText('');
                                                setStatusModalVisible(true);
                                            }}
                                        >
                                            <Ionicons name="send" size={10} color="#FFF" />
                                            <Text style={styles.sendStatusBtnText}>Status</Text>
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8F9FD" />
            {renderHeader()}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderActiveChair()}
                {renderUpNext()}

                {/* NEW: Pending Bookings Section (Accept/Decline) */}
                {pendingBookings.length > 0 && (
                    <View style={styles.pendingSection}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.pendingTitle}>New Booking</Text>
                                <View style={styles.pendingBadge}>
                                    <Text style={styles.pendingBadgeText}>{pendingBookings.length}</Text>
                                </View>
                            </View>
                        </View>

                        {pendingBookings.slice(0, 1).map((booking) => (
                            <View key={booking._id} style={styles.bookingCard}>
                                {/* Price Tag */}
                                <View style={styles.priceTagCorner}>
                                    <Text style={styles.priceTagText}>₹{booking.totalAmount || booking.services?.reduce((sum, s) => sum + (s.price || 0), 0) || 0}</Text>
                                </View>

                                {/* Customer Info Row */}
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
                                    <Image
                                        source={{ uri: booking.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${booking.userId?.name || 'User'}&background=random` }}
                                        style={styles.bookingAvatar}
                                    />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.bookingName}>{booking.userId?.name || 'Customer'}</Text>
                                        <Text style={styles.bookingService}>🔥 {booking.services?.[0]?.name || 'Service'}{booking.services?.length > 1 ? ` +${booking.services.length - 1}` : ''}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="call" size={10} color="#9CA3AF" />
                                            <Text style={styles.bookingPhone}>{booking.userId?.phone || booking.userId?.phoneNumber || 'No phone'}</Text>
                                        </View>
                                    </View>
                                    {/* Call Button */}
                                    <TouchableOpacity style={styles.callBtnGreen}>
                                        <Ionicons name="call" size={16} color="#10B981" />
                                    </TouchableOpacity>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.bookingActions}>
                                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptBooking(booking._id)}>
                                        <Text style={styles.acceptBtnText}>Accept Booking</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineBooking(booking._id)}>
                                        <Text style={styles.declineBtnText}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Walk-in Modal - Advanced Component */}
            {salon && (
                <WalkInModal
                    visible={isWalkInVisible}
                    onClose={() => setWalkInVisible(false)}
                    salon={salon}
                    onAdded={() => {
                        fetchQueue();
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
                    <View style={closeBlockedStyles.container}>
                        {/* Warning Icon */}
                        <View style={closeBlockedStyles.iconCircle}>
                            <Ionicons name="people" size={32} color="#FFF" />
                        </View>

                        {/* Count Badge */}
                        <View style={closeBlockedStyles.countBadge}>
                            <Text style={closeBlockedStyles.countText}>{activeCustomerCount}</Text>
                        </View>
                        <Text style={closeBlockedStyles.title}>Active Customers in Queue</Text>
                        <Text style={closeBlockedStyles.subtitle}>
                            You cannot close the shop while customers are being served or waiting. Please complete or cancel all bookings first.
                        </Text>

                        <TouchableOpacity
                            style={closeBlockedStyles.dismissBtn}
                            onPress={() => setCloseBlockedModal(false)}
                        >
                            <Text style={closeBlockedStyles.dismissBtnText}>Got It</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- NEW: Cancellation Reasons Modal --- */}
            <Modal
                visible={cancelModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { minHeight: 450 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cancel Booking</Text>
                            <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Why are you cancelling?</Text>
                        <Text style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                            Reason will be sent to the customer via notification.
                        </Text>

                        {cancellationReasons.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                style={[
                                    styles.reasonOption,
                                    cancelReason === reason && styles.reasonOptionSelected
                                ]}
                                onPress={() => setCancelReason(reason)}
                            >
                                <Ionicons
                                    name={cancelReason === reason ? "radio-button-on" : "radio-button-off"}
                                    size={20}
                                    color={cancelReason === reason ? '#EF4444' : '#666'}
                                />
                                <Text style={[
                                    styles.reasonText,
                                    cancelReason === reason && styles.reasonTextSelected
                                ]}>
                                    {reason}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={[
                                styles.submitBtn,
                                { backgroundColor: '#EF4444', marginTop: 24 },
                                !cancelReason && { opacity: 0.5 }
                            ]}
                            onPress={handleCancelQueueBooking}
                            disabled={!cancelReason}
                        >
                            <Text style={styles.submitBtnText}>Confirm Cancellation</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ padding: 16, alignItems: 'center' }}
                            onPress={() => setCancelModalVisible(false)}
                        >
                            <Text style={{ color: '#888', fontWeight: 'bold' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- Send Status to Customer Modal --- */}
            <Modal
                visible={statusModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setStatusModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { minHeight: 420 }]}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 }} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Status</Text>
                            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Quick Messages</Text>
                        <Text style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                            Customer will receive this as a notification.
                        </Text>

                        {quickStatusOptions.map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[
                                    styles.reasonOption,
                                    statusMessage === option && { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }
                                ]}
                                onPress={() => { setStatusMessage(option); setCustomStatusText(''); }}
                            >
                                <Ionicons
                                    name={statusMessage === option ? "radio-button-on" : "radio-button-off"}
                                    size={20}
                                    color={statusMessage === option ? '#059669' : '#666'}
                                />
                                <Text style={[
                                    styles.reasonText,
                                    statusMessage === option && { color: '#059669', fontWeight: '600' }
                                ]}>{option}</Text>
                            </TouchableOpacity>
                        ))}

                        <Text style={[styles.inputLabel, { marginTop: 16 }]}>Or type custom message</Text>
                        <TextInput
                            style={[styles.textInput, { marginTop: 8 }]}
                            placeholder="Type your message..."
                            placeholderTextColor="#999"
                            value={customStatusText}
                            onChangeText={(text) => { setCustomStatusText(text); setStatusMessage(''); }}
                            maxLength={100}
                        />

                        <TouchableOpacity
                            style={[
                                styles.submitBtn,
                                { backgroundColor: '#059669', marginTop: 20 },
                                (!statusMessage && !customStatusText) && { opacity: 0.5 }
                            ]}
                            onPress={handleSendStatus}
                            disabled={!statusMessage && !customStatusText}
                        >
                            <Ionicons name="send" size={16} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.submitBtnText}>Send Status</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ padding: 14, alignItems: 'center' }}
                            onPress={() => setStatusModalVisible(false)}
                        >
                            <Text style={{ color: '#888', fontWeight: 'bold' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Customer Profile Sheet */}
            <CustomerProfileSheet
                visible={profileSheetVisible}
                onClose={() => setProfileSheetVisible(false)}
                salonId={salonId}
                userId={profileUserId}
                customerImage={profileCustomerImage}
                customerName={profileCustomerName}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40
    },
    // HEADER
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? 20 : 60,
        paddingBottom: 24,
    },
    backBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#FFF',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    headerTitleContainer: {
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1A1F2B',
        letterSpacing: 1
    },
    liveIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    liveDotPulsing: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E69500',
        marginRight: 6
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#888'
    },
    statusToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold'
    },

    // EMPTY
    emptyContainer: {
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 30,
        padding: 40,
        marginTop: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#DDD'
    },
    emptyImage: {
        width: 100,
        height: 100,
        marginBottom: 20,
        opacity: 0.8
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginBottom: 8
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 24,
        textAlign: 'center'
    },
    walkInLargeBtn: {
        backgroundColor: '#1A1F2B',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 20
    },
    walkInLargeText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14
    },

    // ACTIVE CHAIR CARD
    activeCard: {
        backgroundColor: '#FFF',
        borderRadius: 30,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 5,
        marginBottom: 32
    },
    activeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24
    },
    activeLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        letterSpacing: 1
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1', // Light Gold
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    timerText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#E69500',
        marginLeft: 4
    },
    customerProfile: {
        alignItems: 'center',
        marginBottom: 24
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: '#F8F9FD'
    },
    tokenBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#1A1F2B',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF'
    },
    tokenText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold'
    },
    // NEW COMPACT STYLES
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#22C55E',
        padding: 2,
    },
    avatarCompact: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
    liveBadge: {
        position: 'absolute',
        bottom: -2,
        left: '50%',
        transform: [{ translateX: -14 }],
        backgroundColor: '#22C55E',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    liveBadgeText: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    customerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    customerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginBottom: 2
    },
    customerSubtitle: {
        fontSize: 12,
        color: '#888',
    },
    callBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 12,
        alignSelf: 'flex-start',
    },
    statusText: {
        fontSize: 12,
        color: '#92400E',
        fontWeight: '600',
        marginLeft: 6,
    },
    serviceRowCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FD',
    },
    // --- NEW: Modal Styles ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Bottom sheet style
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        minHeight: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#1A1F2B',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    reasonOption: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EEE',
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    reasonOptionSelected: {
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2'
    },
    reasonText: {
        fontSize: 16,
        color: '#333'
    },
    reasonTextSelected: {
        color: '#EF4444',
        fontWeight: 'bold'
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20
    },
    modalBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 14,
        alignItems: 'center'
    },
    modalBtnCancel: {
        backgroundColor: '#F3F4F6',
        marginRight: 10
    },
    modalBtnConfirm: {
        backgroundColor: '#EF4444',
        marginLeft: 10
    },
    modalBtnTextCancel: {
        color: '#333',
        fontWeight: 'bold'
    },
    modalBtnTextConfirm: {
        color: '#FFF',
        fontWeight: 'bold'
    },
    serviceBox: {
        flex: 1,
    },
    priceBox: {
        alignItems: 'flex-end',
    },
    serviceLabelSmall: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#888',
        marginBottom: 4
    },
    serviceValueSmall: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1F2B'
    },
    estEndTime: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#7C3AED'
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    phoneText: {
        fontSize: 13,
        color: '#666',
        marginLeft: 6,
        flex: 1,
    },
    priceTagCorner: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    priceTagText: {
        color: '#15803D',
        fontSize: 14,
        fontWeight: 'bold',
    },
    liveIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        marginRight: 6,
    },
    customerPhone: {
        fontSize: 14,
        color: '#888'
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginBottom: 24
    },
    serviceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24
    },
    serviceLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#BBB',
        marginBottom: 6
    },
    serviceValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1F2B'
    },
    priceValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50'
    },
    viewProfileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3EEFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        gap: 6,
    },
    viewProfileBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7C4DFF',
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 16
    },
    actionBtnOutline: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DDD'
    },
    actionTextOutline: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginLeft: 8
    },
    actionBtnPrimary: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#1A1F2B'
    },
    actionTextPrimary: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFF'
    },

    // QUEUE UP NEXT
    queueSection: {
        marginBottom: 32
    },
    queueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 16
    },
    queueTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        letterSpacing: 0.5
    },
    addWalkInText: {
        color: '#7C4DFF',
        fontWeight: 'bold',
        fontSize: 14
    },
    quickAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C4DFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    quickAddBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    emptyQueueText: {
        color: '#BBB',
        fontStyle: 'italic',
        marginLeft: 4
    },
    queueCard: {
        backgroundColor: '#FFF',
        width: 130,
        padding: 16,
        borderRadius: 20,
        marginRight: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    queueTokenBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: '#F3E5F5',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    queueTokenText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#AB47BC'
    },
    queueAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EEE',
        marginBottom: 12,
        marginTop: 8
    },
    queueName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginBottom: 4,
        textAlign: 'center'
    },
    queueTokenDetail: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#7C3AED',
        marginBottom: 2,
        textAlign: 'center'
    },
    queueService: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
        textAlign: 'center'
    },
    queueTime: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    queueTimeText: {
        fontSize: 10,
        color: '#666',
        marginLeft: 4
    },

    // QR SECTION
    qrSection: {
        marginBottom: 32
    },
    qrCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    qrTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    qrSubtitle: {
        fontSize: 12,
        color: '#888'
    },
    qrButton: {
        marginLeft: 'auto',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12
    },
    qrBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },

    // MODAL
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end' // Bottom Sheet style
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        minHeight: 400
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8
    },
    input: {
        backgroundColor: '#F8F9FD',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1A1F2B',
        marginBottom: 20
    },
    submitBtn: {
        backgroundColor: '#1A1F2B',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 16
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    // NEW: Pending Booking Card Styles
    pendingSection: {
        marginTop: 24,
    },
    pendingTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1F2B',
    },
    pendingBadge: {
        backgroundColor: '#10B981',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    pendingBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    bookingCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
        position: 'relative',
    },
    bookingAvatar: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#E5E7EB',
    },
    bookingName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1F2B',
    },
    bookingService: {
        fontSize: 13,
        color: '#F59E0B',
        marginTop: 2,
    },
    bookingPhone: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    callBtnGreen: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#DCFCE7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookingActions: {
        flexDirection: 'row',
        gap: 12,
    },
    acceptBtn: {
        flex: 1,
        backgroundColor: '#1A1F2B',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    acceptBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    declineBtn: {
        flex: 1,
        backgroundColor: '#FFF',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    declineBtnText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    // Reasons Modal
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#F8F9FD',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    reasonOptionSelected: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA'
    },
    reasonText: {
        fontSize: 15,
        color: '#4B5563',
        marginLeft: 12
    },
    reasonTextSelected: {
        color: '#EF4444',
        fontWeight: 'bold'
    },
    // Send Status styles
    statusMsgBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 6,
        gap: 3,
    },
    statusMsgText: {
        fontSize: 8,
        color: '#059669',
        fontWeight: '600',
        maxWidth: 80,
    },
    sendStatusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#059669',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        marginTop: 6,
        gap: 3,
    },
    sendStatusBtnText: {
        fontSize: 9,
        color: '#FFF',
        fontWeight: 'bold',
    },
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
        backgroundColor: '#FFF',
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
        color: '#1A1F2B',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    dismissBtn: {
        backgroundColor: '#1A1F2B',
        paddingVertical: 14,
        paddingHorizontal: 48,
        borderRadius: 16,
    },
    dismissBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default SalonLiveMode;
