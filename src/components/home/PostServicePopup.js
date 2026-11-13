/**
 * PostServicePopup - Shows after booking completion on Home Screen
 * Two action cards: Scratch Card (→ Wallet) + Review (→ Bookings)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Modal,
    Animated, Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { getUserBookings } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const PostServicePopup = ({ user, navigation, isDarkMode }) => {
    const [visible, setVisible] = useState(false);
    const [completedBooking, setCompletedBooking] = useState(null);
    const slideAnim = useRef(new Animated.Value(300)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scratchScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        checkForCompletedBookings();
    }, []);

    const checkForCompletedBookings = async () => {
        try {
            const userId = user?._id || user?.id;
            if (!userId) return;

            const bookings = await getUserBookings(userId);
            if (!Array.isArray(bookings)) return;

            // Find recently completed booking (within last 24 hours) that hasn't been dismissed
            const now = new Date();
            const dismissed = JSON.parse(await AsyncStorage.getItem('dismissedPopups') || '[]');

            const recentCompleted = bookings.find(b => {
                if (b.status !== 'completed') return false;
                if (dismissed.includes(b._id)) return false;
                const completedAt = new Date(b.updatedAt || b.createdAt);
                const hoursDiff = (now - completedAt) / (1000 * 60 * 60);
                return hoursDiff <= 24;
            });

            if (recentCompleted) {
                setCompletedBooking(recentCompleted);
                setVisible(true);
                // Animate in
                Animated.parallel([
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        friction: 8,
                        tension: 40,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]).start();

                // Pulse scratch card
                pulseAnimation();
            }
        } catch (error) {
            console.log('PostServicePopup check error:', error);
        }
    };

    const pulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scratchScale, {
                    toValue: 1.05,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(scratchScale, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const dismissPopup = async () => {
        // Animate out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
        });

        // Save dismissal
        if (completedBooking?._id) {
            try {
                const dismissed = JSON.parse(await AsyncStorage.getItem('dismissedPopups') || '[]');
                dismissed.push(completedBooking._id);
                // Keep only last 50 to avoid storage bloat
                await AsyncStorage.setItem('dismissedPopups', JSON.stringify(dismissed.slice(-50)));
            } catch (e) {}
        }
    };

    const handleScratchCard = () => {
        dismissPopup();
        setTimeout(() => {
            navigation.navigate('Wallet', { user, showScratchCard: true });
        }, 300);
    };

    const handleReview = () => {
        dismissPopup();
        setTimeout(() => {
            navigation.navigate('Bookings', { user, highlightReview: completedBooking?._id });
        }, 300);
    };

    if (!visible || !completedBooking) return null;

    const salonName = completedBooking.salonId?.name || completedBooking.salonName || 'Salon';
    const serviceName = completedBooking.services?.map(s => s.name || s.serviceName).join(', ') || 'Service';

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={dismissPopup}>
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={dismissPopup} />
                <Animated.View style={[
                    styles.popup,
                    {
                        backgroundColor: isDarkMode ? '#1A1A2E' : '#FFFFFF',
                        transform: [{ translateY: slideAnim }],
                    }
                ]}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={dismissPopup}>
                        <Ionicons name="close" size={22} color={isDarkMode ? '#888' : '#999'} />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.headerSection}>
                        <View style={styles.checkCircle}>
                            <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                        </View>
                        <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#1A1A2E' }]}>
                            Service Complete! 🎉
                        </Text>
                        <Text style={[styles.subtitle, { color: isDarkMode ? '#AAA' : '#6B7280' }]}>
                            {serviceName} at {salonName}
                        </Text>
                    </View>

                    {/* Action Cards */}
                    <View style={styles.cardsRow}>
                        {/* Scratch Card */}
                        <Animated.View style={{ flex: 1, transform: [{ scale: scratchScale }] }}>
                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={handleScratchCard}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#F59E0B', '#EF4444']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cardGradient}
                                >
                                    <View style={styles.sparkleContainer}>
                                        <Text style={styles.sparkleEmoji}>✨</Text>
                                    </View>
                                    <Ionicons name="gift" size={32} color="#FFF" />
                                    <Text style={styles.cardTitle}>Scratch Card</Text>
                                    <Text style={styles.cardSubtitle}>Win Rewards!</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Review */}
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={handleReview}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#3B82F6', '#8B5CF6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cardGradient}
                                >
                                    <View style={styles.sparkleContainer}>
                                        <Text style={styles.sparkleEmoji}>⭐</Text>
                                    </View>
                                    <Ionicons name="star" size={32} color="#FFF" />
                                    <Text style={styles.cardTitle}>Rate Service</Text>
                                    <Text style={styles.cardSubtitle}>Share Review</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Skip text */}
                    <TouchableOpacity onPress={dismissPopup} style={styles.skipBtn}>
                        <Text style={[styles.skipText, { color: isDarkMode ? '#666' : '#9CA3AF' }]}>
                            Maybe Later
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    overlayTouch: {
        flex: 1,
    },
    popup: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 34,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    checkCircle: {
        marginBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 16,
    },
    actionCard: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    cardGradient: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
    },
    sparkleContainer: {
        position: 'absolute',
        top: 8,
        right: 10,
    },
    sparkleEmoji: {
        fontSize: 20,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginTop: 10,
    },
    cardSubtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    skipBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default PostServicePopup;
