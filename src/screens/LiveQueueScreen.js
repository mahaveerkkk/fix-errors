import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Animated, Easing, Alert, FlatList, TouchableOpacity, Modal, Linking } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

import socketService from '../services/socketService';
import CustomerProfileSheet from '../components/salon/CustomerProfileSheet';

const LiveQueueScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { bookingId, salon, user } = route.params || {};
    // Fallback if salon not passed
    const salonId = salon?._id || salon?.id || 'mock_salon_id';

    const [queueStatus, setQueueStatus] = useState({
        position: -1, // -1 means searching/not found
        waitTime: 0,
        currentToken: 0,
        yourToken: 0,
        status: 'waiting'
    });

    const [queueList, setQueueList] = useState([]);
    const [activeBooking, setActiveBooking] = useState(null);
    const [isStoryModalVisible, setIsStoryModalVisible] = useState(false);
    const [selectedUserStory, setSelectedUserStory] = useState(null);
    const [userStatusMessage, setUserStatusMessage] = useState('');
    const [notificationPref, setNotificationPref] = useState(3);
    const [, setTick] = useState(0); // Force re-render for live timer

    // Customer Profile Sheet
    const [profileSheetVisible, setProfileSheetVisible] = useState(false);
    const [profileUserId, setProfileUserId] = useState(null);
    const [profileCustomerImage, setProfileCustomerImage] = useState(null);
    const [profileCustomerName, setProfileCustomerName] = useState('');

    // Live ticking timer — updates "Started X mins ago" every 10 seconds for accuracy
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(prev => prev + 1);
        }, 10000); // Every 10 seconds for responsive timer
        return () => clearInterval(timer);
    }, []);

    // Connect to Socket & Fetch Data
    useEffect(() => {
        const socket = socketService.connect();
        socketService.joinRoom(salonId);

        fetchQueueData();

        // Listen for Queue Updates
        socketService.on('queueUpdate', (data) => {
            // Re-fetch queue to ensure consistency
            fetchQueueData();
        });

        return () => {
            socketService.off('queueUpdate');
            socketService.leaveRoom(salonId);
        };
    }, [salonId]);

    const fetchQueueData = async () => {
        try {
            const { getSalonQueue } = require('../services/api');
            const data = await getSalonQueue(salonId);

            // Transform API data to UI format
            const formattedQueue = data.queue.map(booking => {
                const isWalkIn = booking.isWalkIn;

                // ROBUST NAME HANDLING
                let displayName = 'Guest';
                if (isWalkIn && booking.walkInName) {
                    displayName = booking.walkInName;
                } else if (booking.userId && booking.userId.name) {
                    displayName = booking.userId.name;
                }

                // ROBUST IMAGE HANDLING
                let displayImage = `https://ui-avatars.com/api/?name=${displayName}&background=random`;
                if (!isWalkIn && booking.userId?.profilePhoto) {
                    displayImage = booking.userId.profilePhoto;
                } else if (isWalkIn) {
                    displayImage = `https://ui-avatars.com/api/?name=${displayName}&background=7C3AED&color=fff`;
                }

                // SERVICE HANDLING with duration
                const serviceName = (booking.services && booking.services.length > 0)
                    ? booking.services[0].name
                    : 'General Service';

                // Calculate total duration for this booking
                let totalDuration = 0;
                if (Array.isArray(booking.services)) {
                    booking.services.forEach(s => {
                        totalDuration += (s.duration || 30); // Default 30 mins
                    });
                } else {
                    totalDuration = 30;
                }

                return {
                    id: booking._id,
                    name: displayName,
                    token: booking.tokenNumber,
                    service: serviceName,
                    staff: booking.staffId ? 'Assigned Staff' : 'Any',
                    image: displayImage,
                    status: booking.status === 'accepted' ? 'waiting' : 'serving',
                    isYou: !isWalkIn && booking.userId?._id === (user?._id || user?.id),
                    isWalkIn: isWalkIn,
                    duration: totalDuration,
                    serviceStartTime: booking.serviceStartTime,
                    // Extra data for customer info bottom sheet
                    phone: booking.userId?.phone || null,
                    allServices: booking.services || [],
                    totalAmount: booking.totalAmount || (booking.services || []).reduce((s, sv) => s + (sv.price || 0), 0),
                    rawUserId: booking.userId?._id || null // For customer profile sheet
                };
            });

            // Identify current serving (lowest token number or status serving if we had it)
            // For now, assume top of list is next/serving
            if (formattedQueue.length > 0) {
                // If we had a 'serving' status in DB we would use it. 
                // Currently 'accepted' means waiting/serving.
                formattedQueue[0].status = 'serving';
                setActiveBooking(formattedQueue[0]);
            }

            setQueueList(formattedQueue);

            // Update Status Card - Calculate dynamic wait time
            const myBooking = formattedQueue.find(u => u.isYou);
            if (myBooking) {
                const myIndex = formattedQueue.indexOf(myBooking);

                // Calculate wait time based on people ahead and their service durations
                let calculatedWaitTime = 0;
                for (let i = 0; i < myIndex; i++) {
                    const personAhead = formattedQueue[i];
                    // If first person (serving), calculate remaining time
                    if (i === 0 && personAhead.serviceStartTime) {
                        const elapsed = Math.floor((Date.now() - new Date(personAhead.serviceStartTime).getTime()) / (1000 * 60));
                        const remaining = Math.max(0, personAhead.duration - elapsed);
                        calculatedWaitTime += remaining;
                    } else {
                        calculatedWaitTime += personAhead.duration;
                    }
                }

                setQueueStatus({
                    position: myIndex,
                    waitTime: calculatedWaitTime || 0,
                    currentToken: formattedQueue[0]?.token || 0,
                    yourToken: myBooking.token,
                    status: 'waiting'
                });
            } else {
                // Not in queue or served
                setQueueStatus(prev => ({ ...prev, position: -1, yourToken: 0 }));
            }

        } catch (error) {
        }
    };

    // Pulse animation - use useRef to prevent recreation
    const pulseAnim = React.useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, easing: Easing.ease, useNativeDriver: false }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.ease, useNativeDriver: false }),
            ])
        );
        animation.start();
        return () => animation.stop(); // Cleanup on unmount
    }, []);

    const openUserStory = (user) => {
        setSelectedUserStory(user);
        setIsStoryModalVisible(true);
    };

    const closeUserStory = () => {
        setIsStoryModalVisible(false);
    };

    const sendStatusUpdate = async (msg, statusKey) => {
        try {
            // Find my booking ID if not in params
            const myBooking = queueList.find(u => u.isYou);
            const validBookingId = bookingId || myBooking?.id;

            if (!validBookingId) {
                Alert.alert('Error', 'Booking ID not found');
                return;
            }

            const { updateCustomerStatus: apiUpdateStatus, sendCustomerStatus } = require('../services/api');

            // 1. Update DB Status
            await apiUpdateStatus(validBookingId, msg); // Pass msg as status text for DB

            // 2. Send Push Notification
            const notifyStatus = msg.includes('On my way') ? 'on_the_way' : 'delayed';
            await sendCustomerStatus(salonId, user?._id || user?.id, notifyStatus);

            setUserStatusMessage(msg);
            Alert.alert('✅ Status Sent', `Salon notified: "${msg}"`);
            closeUserStory();
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    const handleCancelBooking = () => {
        Alert.alert('Cancel?', 'Are you sure?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes', style: 'destructive', onPress: () => navigation.goBack() }
        ]);
    };

    const renderStoryAvatar = ({ item }) => (
        <TouchableOpacity
            style={styles.storyAvatarItem}
            onPress={() => openUserStory(item)}
        >
            <View style={[styles.storyRing, item.status === 'serving' && styles.storyRingActive, item.isYou && { borderColor: theme.colors.primary }]}>
                <Image
                    source={{ uri: item.image }}
                    style={styles.storyImage}
                />
                {item.isYou && (
                    <View style={[styles.youIndicator, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.youIndicatorText}>You</Text>
                    </View>
                )}
            </View>
            <Text style={[styles.storyName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {item.isYou ? 'You' : item.name.split(' ')[0]}
            </Text>
        </TouchableOpacity>
    );

    const renderStoryModal = () => {
        if (!selectedUserStory) return null;
        const isClientYou = selectedUserStory.isYou;
        const isServing = selectedUserStory.status === 'serving';

        // Calculate this person's wait time based on position
        const personIndex = queueList.findIndex(u => u.id === selectedUserStory.id);
        let estimatedWait = 0;
        if (personIndex > 0) {
            for (let i = 0; i < personIndex; i++) {
                const ahead = queueList[i];
                if (i === 0 && ahead.serviceStartTime) {
                    const elapsed = Math.floor((Date.now() - new Date(ahead.serviceStartTime).getTime()) / (1000 * 60));
                    estimatedWait += Math.max(0, ahead.duration - elapsed);
                } else {
                    estimatedWait += ahead.duration;
                }
            }
        }

        return (
            <Modal
                visible={isStoryModalVisible}
                onClose={closeUserStory}
                transparent
                animationType="slide"
            >
                <View style={sheetStyles.overlay} onStartShouldSetResponder={() => true} onResponderRelease={closeUserStory}>
                    <View style={sheetStyles.sheet} onStartShouldSetResponder={() => true}>

                        {/* Drag Handle */}
                        <View style={sheetStyles.dragHandle} />

                        {/* Close Button */}
                        <TouchableOpacity style={sheetStyles.closeBtn} onPress={closeUserStory}>
                            <Ionicons name="close" size={22} color="#94A3B8" />
                        </TouchableOpacity>

                        {/* Customer Photo + Name + Status */}
                        <View style={sheetStyles.profileSection}>
                            <View style={[sheetStyles.avatarRing, { borderColor: isServing ? '#22C55E' : '#7C4DFF' }]}>
                                <Image source={{ uri: selectedUserStory.image }} style={sheetStyles.avatar} />
                            </View>
                            <Text style={sheetStyles.customerName}>{selectedUserStory.name}</Text>
                            <View style={[sheetStyles.statusPill, { backgroundColor: isServing ? '#F0FDF4' : '#F5F3FF' }]}>
                                <View style={[sheetStyles.statusDot, { backgroundColor: isServing ? '#22C55E' : '#7C4DFF' }]} />
                                <Text style={[sheetStyles.statusText, { color: isServing ? '#22C55E' : '#7C4DFF' }]}>
                                    {isServing ? 'Now Serving' : 'In Queue'}
                                </Text>
                            </View>
                        </View>

                        {/* Quick Info Row: Token + Wait Time */}
                        <View style={sheetStyles.quickInfoRow}>
                            <View style={sheetStyles.quickInfoBox}>
                                <Ionicons name="ticket-outline" size={18} color="#7C4DFF" />
                                <Text style={sheetStyles.quickInfoLabel}>Token</Text>
                                <Text style={sheetStyles.quickInfoValue}>#{selectedUserStory.token}</Text>
                            </View>
                            <View style={sheetStyles.quickInfoBox}>
                                <Ionicons name="time-outline" size={18} color="#F59E0B" />
                                <Text style={sheetStyles.quickInfoLabel}>Wait Time</Text>
                                <Text style={sheetStyles.quickInfoValue}>{isServing ? 'Now' : `~${estimatedWait}m`}</Text>
                            </View>
                            <View style={sheetStyles.quickInfoBox}>
                                <Ionicons name="cash-outline" size={18} color="#10B981" />
                                <Text style={sheetStyles.quickInfoLabel}>Total</Text>
                                <Text style={sheetStyles.quickInfoValue}>₹{selectedUserStory.totalAmount || 0}</Text>
                            </View>
                        </View>

                        {/* Phone + Call/Message */}
                        <View style={sheetStyles.phoneSection}>
                            <View style={sheetStyles.phoneInfo}>
                                <Ionicons name="call-outline" size={16} color="#64748B" />
                                <Text style={sheetStyles.phoneText}>
                                    {selectedUserStory.phone || 'No phone'}
                                </Text>
                            </View>
                            {selectedUserStory.phone && (
                                <View style={sheetStyles.phoneActions}>
                                    <TouchableOpacity
                                        style={[sheetStyles.phoneBtn, { backgroundColor: '#E8F5E9' }]}
                                        onPress={() => Linking.openURL(`tel:${selectedUserStory.phone}`)}
                                    >
                                        <Ionicons name="call" size={16} color="#4CAF50" />
                                        <Text style={[sheetStyles.phoneBtnText, { color: '#4CAF50' }]}>Call</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[sheetStyles.phoneBtn, { backgroundColor: '#E3F2FD' }]}
                                        onPress={() => Linking.openURL(`sms:${selectedUserStory.phone}`)}
                                    >
                                        <Ionicons name="chatbubble" size={16} color="#2196F3" />
                                        <Text style={[sheetStyles.phoneBtnText, { color: '#2196F3' }]}>Message</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Services List */}
                        <View style={sheetStyles.servicesSection}>
                            <Text style={sheetStyles.sectionLabel}>BOOKED SERVICES</Text>
                            {(selectedUserStory.allServices || []).map((svc, idx) => (
                                <View key={idx} style={sheetStyles.serviceRow}>
                                    <View style={sheetStyles.serviceLeft}>
                                        <Ionicons name="cut-outline" size={14} color="#7C4DFF" />
                                        <View style={{ marginLeft: 10 }}>
                                            <Text style={sheetStyles.serviceName}>{svc.name}</Text>
                                            <Text style={sheetStyles.serviceMeta}>{svc.duration || 30} mins • {svc.category || 'General'}</Text>
                                        </View>
                                    </View>
                                    <Text style={sheetStyles.servicePrice}>₹{svc.price || 0}</Text>
                                </View>
                            ))}
                            {(!selectedUserStory.allServices || selectedUserStory.allServices.length === 0) && (
                                <View style={sheetStyles.serviceRow}>
                                    <View style={sheetStyles.serviceLeft}>
                                        <Ionicons name="cut-outline" size={14} color="#7C4DFF" />
                                        <Text style={[sheetStyles.serviceName, { marginLeft: 10 }]}>{selectedUserStory.service}</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Action Buttons for "You" */}
                        {isClientYou && queueStatus.position <= 5 && (
                            <View style={sheetStyles.actionSection}>
                                <Text style={sheetStyles.sectionLabel}>UPDATE YOUR STATUS</Text>
                                <View style={sheetStyles.actionGrid}>
                                    {[
                                        { label: 'On my way 🏃', title: 'On my way', key: 'on_way', icon: 'walk', color: '#059669', bg: '#ECFDF5' },
                                        { label: '5 mins late ⏰', title: '5 mins late', key: 'delayed', icon: 'time', color: '#DC2626', bg: '#FEF2F2' },
                                        { label: 'Start prep 💇', title: 'Start prep', key: 'prep', icon: 'cut', color: '#4F46E5', bg: '#EEF2FF' }
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.key}
                                            style={[sheetStyles.actionChip, { backgroundColor: opt.bg }]}
                                            onPress={() => sendStatusUpdate(opt.label, opt.key)}
                                        >
                                            <Ionicons name={opt.icon} size={14} color={opt.color} style={{ marginRight: 4 }} />
                                            <Text style={[sheetStyles.actionChipText, { color: opt.color }]}>{opt.title}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* View Full Profile (for any customer with userId) */}
                        {selectedUserStory.rawUserId && (
                            <TouchableOpacity
                                style={sheetStyles.profileBtn}
                                onPress={() => {
                                    closeUserStory();
                                    setProfileUserId(selectedUserStory.rawUserId);
                                    setProfileCustomerImage(selectedUserStory.image);
                                    setProfileCustomerName(selectedUserStory.name);
                                    setTimeout(() => setProfileSheetVisible(true), 300);
                                }}
                            >
                                <Ionicons name="analytics" size={16} color="#7C4DFF" />
                                <Text style={sheetStyles.profileBtnText}>View Full Profile & Analytics</Text>
                                <Ionicons name="chevron-forward" size={14} color="#7C4DFF" />
                            </TouchableOpacity>
                        )}

                        {/* Close Button */}
                        <TouchableOpacity style={sheetStyles.doneBtn} onPress={closeUserStory}>
                            <Text style={sheetStyles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <ScreenWrapper>
            <Header title="Live Queue" showBack
                rightComponent={
                    <TouchableOpacity onPress={fetchQueueData}>
                        <Ionicons name="sync-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                }
            />

            <View style={styles.liveStatusBanner}>
                <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }], backgroundColor: theme.colors.success }]} />
                <Text style={[styles.liveStatusText, { color: theme.colors.success }]}>Salon is Live</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* 1. ON THE CHAIR (Hero Section) */}
                <View style={styles.sectionHeaderLine}>
                    <Text style={styles.sectionTitleText}>In The Chair</Text>
                    <View style={styles.servingTokenBadge}>
                        <Text style={styles.servingTokenBadgeText}>#{queueList[0]?.token || '?'} Serving</Text>
                    </View>
                </View>

                {queueList.length > 0 ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => openUserStory(queueList[0])}>
                        <Animated.View style={[styles.heroCard, {
                            borderColor: pulseAnim.interpolate({
                                inputRange: [1, 1.2],
                                outputRange: ['#E0E0E0', '#22C55E']
                            }),
                            borderWidth: pulseAnim.interpolate({
                                inputRange: [1, 1.2],
                                outputRange: [1, 2.5]
                            })
                        }]}>
                            {/* Header Row - IN THE CHAIR + Live Badge */}
                            <View style={styles.heroHeaderRow}>
                                <Text style={styles.heroHeaderLabel}>IN THE CHAIR</Text>
                                <View style={styles.heroLiveBadge}>
                                    <View style={styles.heroLiveDot} />
                                    <Text style={styles.heroLiveBadgeText}>Live</Text>
                                </View>
                            </View>

                            {/* Top Row: Avatar + Info + Call Button */}
                            <View style={styles.heroTopRow}>
                                <View style={styles.heroAvatarContainer}>
                                    <View style={styles.heroAvatarRingGreen}>
                                        <Image source={{ uri: queueList[0].image }} style={styles.heroImageAvatar} />
                                    </View>
                                    <View style={[styles.liveLabel, { backgroundColor: theme.colors.success }]}>
                                        <Text style={styles.liveLabelText}>Live</Text>
                                    </View>
                                </View>

                                <View style={styles.heroInfoContainer}>
                                    <Text style={styles.heroName}>{queueList[0].name}</Text>
                                    <Text style={styles.heroSubText}>
                                        {(() => {
                                            if (!queueList[0].serviceStartTime) return 'Started 0 mins ago';
                                            const start = new Date(queueList[0].serviceStartTime);
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
                                        })()}
                                    </Text>
                                </View>

                                {/* Call button removed - user phone privacy */}
                            </View>

                            {/* Service Info Row with Price */}
                            <View style={styles.serviceRowSimple}>
                                <View>
                                    <Text style={styles.serviceLabel}>SERVICE</Text>
                                    <Text style={styles.serviceValue}>{queueList[0].service}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.serviceLabel}>EST. END</Text>
                                    <Text style={[styles.serviceValue, { color: '#8B5CF6' }]}>
                                        {(() => {
                                            const startTime = queueList[0].serviceStartTime
                                                ? new Date(queueList[0].serviceStartTime)
                                                : new Date();
                                            const duration = queueList[0].duration || 30;
                                            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
                                            let hours = endTime.getHours();
                                            const minutes = endTime.getMinutes();
                                            const ampm = hours >= 12 ? 'PM' : 'AM';
                                            hours = hours % 12 || 12;
                                            return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                                        })()}
                                    </Text>
                                </View>
                            </View>

                            {/* Duration + Remaining Time Row */}
                            <View style={styles.heroDurationRow}>
                                <View style={styles.heroDurationItem}>
                                    <Ionicons name="time-outline" size={14} color="#64748B" />
                                    <Text style={styles.heroDurationText}>{queueList[0].duration || 30} min service</Text>
                                </View>
                                <Text style={styles.heroRemainingText}>
                                    {(() => {
                                        if (!queueList[0].serviceStartTime) return `~${queueList[0].duration || 30}m left`;
                                        const start = new Date(queueList[0].serviceStartTime);
                                        const elapsed = Math.floor((Date.now() - start.getTime()) / (1000 * 60));
                                        const remaining = Math.max(0, (queueList[0].duration || 30) - elapsed);
                                        if (remaining === 0) return 'Finishing up...';
                                        return `~${remaining}m remaining`;
                                    })()}
                                </Text>
                            </View>

                            {/* Real Progress Bar */}
                            <View style={styles.progressContainer}>
                                <View style={styles.progressTrack} />
                                <View
                                    style={[
                                        styles.progressBarGreen,
                                        {
                                            width: (() => {
                                                if (!queueList[0].serviceStartTime) return '0%';
                                                const start = new Date(queueList[0].serviceStartTime);
                                                const elapsed = (Date.now() - start.getTime()) / (1000 * 60);
                                                const duration = queueList[0].duration || 30;
                                                const pct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
                                                return `${pct}%`;
                                            })()
                                        }
                                    ]}
                                />
                            </View>
                        </Animated.View>
                    </TouchableOpacity>
                ) : (
                    <Card style={styles.emptyHeroCard}>
                        <Text style={{ color: theme.colors.textSecondary }}>No one is being served right now</Text>
                        <Text style={{ color: theme.colors.textLight, fontSize: 10, marginTop: 4 }}>Checking live queue...</Text>
                    </Card>
                )}

                {/* 2. TIMELINE VIEW */}
                <View style={styles.timelineContainer}>
                    {/* Vertical Line */}
                    <View style={styles.timelineLineFull} />

                    {/* Your Turn Card */}
                    {queueStatus.yourToken > 0 && queueStatus.position !== -1 && (
                        <View style={styles.timelineNode}>
                            <View style={styles.nodeDotActive} />
                            <Card style={styles.yourTurnBlackCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.yourTurnLabelMini}>YOU ARE HERE</Text>
                                    <Text style={styles.yourTurnTitleLarge}>
                                        {queueStatus.position === 0 ? 'Your Turn' : `${queueStatus.position} People Ahead`}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.yourTurnTokenNum}>Token #{queueStatus.yourToken}</Text>
                                    <Text style={styles.yourTurnWaitTime}>~{queueStatus.waitTime} mins</Text>
                                </View>
                            </Card>
                        </View>
                    )}

                    {queueStatus.position === -1 && queueStatus.yourToken === 0 && (
                        <View style={[styles.timelineNode, { opacity: 0.5 }]}>
                            <View style={styles.nodeDot} />
                            <Text style={{ color: theme.colors.textLight, marginLeft: 20 }}>You are not in this queue</Text>
                        </View>
                    )}

                    {/* Upcoming Users */}
                    {queueList.slice(1).map((item, index) => (
                        <TouchableOpacity
                            key={`timeline-${item.id}-${index}`}
                            style={styles.timelineNode}
                            onPress={() => openUserStory(item)}
                        >
                            <View style={styles.nodeDot} />
                            <View style={styles.queueUserCard}>
                                <Image source={{ uri: item.image }} style={styles.queueUserAvatar} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.queueUserName}>{item.name}</Text>
                                    <Text style={styles.queueUserToken}>Token #{item.token} • {index === 0 ? 'Next' : 'Waiting'}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.viewBadge}
                                    onPress={() => openUserStory(item)}
                                >
                                    <Text style={styles.viewBadgeText}>View</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* 3. STORY BAR (Fixed Bottom) */}
            <View style={styles.storyBarContainer}>
                <Text style={styles.storyBarTitle}>Who's in Line (Tap to see)</Text>
                <FlatList
                    data={queueList}
                    renderItem={renderStoryAvatar}
                    keyExtractor={item => `story-${item.id}-${item.token}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storyListContent}
                />
            </View>

            {renderStoryModal()}

            {/* Customer Profile Analytics Sheet */}
            <CustomerProfileSheet
                visible={profileSheetVisible}
                onClose={() => setProfileSheetVisible(false)}
                salonId={salonId}
                userId={profileUserId}
                customerImage={profileCustomerImage}
                customerName={profileCustomerName}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 24,
    },
    liveStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#fff',
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    liveStatusText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sectionHeaderLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitleText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    servingTokenBadge: {
        backgroundColor: '#000',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    servingTokenBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    heroCard: {
        padding: 16,
        borderRadius: 24,
        backgroundColor: '#fff',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        marginBottom: 24,
        overflow: 'hidden',
    },
    heroHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    heroHeaderLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#94A3B8',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    heroLiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    heroLiveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        marginRight: 5,
    },
    heroLiveBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#22C55E',
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    heroAvatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    heroAvatarRingGreen: {
        padding: 4,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#10B981', // Green ring
    },
    heroImageAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    liveLabel: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fff',
    },
    liveLabelText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    heroInfoContainer: {
        flex: 1,
    },
    heroName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    heroStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    fireIcon: {
        marginRight: 4,
    },
    heroSubText: {
        fontSize: 12,
        fontWeight: '600',
    },
    heroPhoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -2, // Align icon visually
    },
    heroPhoneText: {
        fontSize: 12,
        color: '#94A3B8',
        marginLeft: 4,
    },
    heroRightBadge: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    heroTimeText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    heroTimeLabel: {
        fontSize: 10,
        color: '#6B7280',
        fontWeight: '600',
        marginTop: 2,
    },
    heroDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
    },
    serviceRowSimple: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
    },
    serviceLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 4,
    },
    serviceValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    heroCallBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    heroDurationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    heroDurationItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroDurationText: {
        fontSize: 12,
        color: '#64748B',
        marginLeft: 5,
        fontWeight: '500',
    },
    heroRemainingText: {
        fontSize: 12,
        color: '#22C55E',
        fontWeight: 'bold',
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    progressTrack: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#F1F5F9',
    },
    progressBarGreen: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 3,
    },
    timelineContainer: {
        paddingLeft: 4,
    },
    timelineLineFull: {
        position: 'absolute',
        left: 27,
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#E2E8F0',
    },
    timelineNode: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    nodeDotActive: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#000',
        borderWidth: 4,
        borderColor: '#fff',
        elevation: 4,
        zIndex: 10,
        marginRight: 20,
    },
    nodeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#CBD5E1',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 10,
        marginRight: 24,
    },
    yourTurnBlackCard: {
        flex: 1,
        backgroundColor: '#000',
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 6,
    },
    yourTurnLabelMini: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    yourTurnTitleLarge: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    yourTurnTokenNum: {
        color: '#94A3B8',
        fontSize: 12,
    },
    yourTurnWaitTime: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: 'bold',
    },
    queueUserCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
    },
    queueUserAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    queueUserName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    queueUserToken: {
        fontSize: 10,
        color: '#64748B',
    },
    viewBadge: {
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    viewBadgeText: {
        color: '#7C3AED',
        fontSize: 10,
        fontWeight: 'bold',
    },
    storyBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    storyBarTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94A3B8',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginLeft: 4,
    },
    storyListContent: {
        paddingBottom: 4,
    },
    storyAvatarItem: {
        alignItems: 'center',
        marginRight: 20,
    },
    storyRing: {
        padding: 2,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    storyRingActive: {
        borderColor: '#10B981',
    },
    storyImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    storyName: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    storyModalContent: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 40,
        padding: 32,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 24,
        right: 24,
        backgroundColor: '#F1F5F9',
        padding: 8,
        borderRadius: 20,
    },
    modalStoryRing: {
        padding: 4,
        borderRadius: 60,
        borderWidth: 3,
        marginBottom: 16,
    },
    modalAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    modalName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    statusBadgeModal: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
        marginBottom: 24,
    },
    statusBadgeTextModal: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statBox: {
        flex: 1,
        padding: 16,
        borderRadius: 24,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#94A3B8',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    statusActionBox: {
        width: '100%',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    actionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
        textAlign: 'center',
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    actionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    actionChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    youIndicator: {
        position: 'absolute',
        bottom: -5,
        alignSelf: 'center',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fff',
    },
    youIndicatorText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
    },
    emptyHeroCard: {
        padding: 40,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        marginBottom: 32,
    }
});

// --- CUSTOMER INFO BOTTOM SHEET STYLES ---
const sheetStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 36,
        maxHeight: '85%',
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 20,
        backgroundColor: '#F1F5F9',
        padding: 6,
        borderRadius: 16,
        zIndex: 10,
    },
    profileSection: {
        alignItems: 'center',
        paddingTop: 8,
        marginBottom: 20,
    },
    avatarRing: {
        padding: 3,
        borderRadius: 50,
        borderWidth: 3,
        marginBottom: 12,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    customerName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 6,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    quickInfoRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    quickInfoBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
    },
    quickInfoLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 6,
        textTransform: 'uppercase',
    },
    quickInfoValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 2,
    },
    phoneSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    phoneInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneText: {
        fontSize: 14,
        color: '#475569',
        marginLeft: 8,
        fontWeight: '500',
    },
    phoneActions: {
        flexDirection: 'row',
        gap: 8,
    },
    phoneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 4,
    },
    phoneBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    servicesSection: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 10,
    },
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    serviceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    serviceMeta: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#7C4DFF',
    },
    actionSection: {
        marginBottom: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    actionChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    doneBtn: {
        backgroundColor: '#7C4DFF',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 4,
    },
    doneBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    profileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F3FF',
        paddingVertical: 12,
        borderRadius: 14,
        marginBottom: 10,
        gap: 6,
    },
    profileBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C4DFF',
    },
});

export default LiveQueueScreen;
