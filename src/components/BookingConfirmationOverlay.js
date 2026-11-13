import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    Image,
    Easing
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getSocket } from '../utils/socket';

const { width, height } = Dimensions.get('window');

const BookingConfirmationOverlay = ({
    visible,
    bookingData,
    salon,
    onClose,
    onViewQueue
}) => {
    const [status, setStatus] = useState('confirming'); // 'confirming' | 'accepted' | 'rejected'
    const [bookingResult, setBookingResult] = useState(null);
    const [countdown, setCountdown] = useState(60);
    const countdownRef = useRef(null);
    const progressAnim = useRef(new Animated.Value(1)).current;

    // Animations
    const checkmarkScale = useRef(new Animated.Value(0)).current;
    const checkmarkFill = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sheetAnim = useRef(new Animated.Value(height)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const confettiAnims = useRef([...Array(20)].map(() => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(0)
    }))).current;

    // Socket listener for booking response
    useEffect(() => {
        if (!visible) return;

        const socket = getSocket();
        if (!socket) {
            return;
        }
        // Listen to the 'bookingStatus' event that backend emits
        const handleBookingStatus = (data) => {
            // Check if this is our booking
            if (data.bookingId === bookingData?.bookingId) {
                if (data.status === 'accepted') {
                    setBookingResult({
                        ...data,
                        tokenNumber: data.tokenNumber || bookingResult?.tokenNumber || bookingData?.tokenNumber || '--',
                        estimatedTime: data.estimatedTime || '~10 min'
                    });
                    setStatus('accepted');
                    playSuccessAnimation();
                } else if (data.status === 'rejected') {
                    setStatus('rejected');
                }
            }
        };

        socket.on('bookingStatus', handleBookingStatus);

        // Also listen for queueUpdate which has booking info
        socket.on('queueUpdate', (data) => {
            // Match by bookingId first, then fall back to salonId match
            const isOurBooking = (data.bookingId && data.bookingId === bookingData?.bookingId) ||
                (!data.bookingId && data.salonId === salon?._id);
            if (data.action === 'booking_accepted' && isOurBooking) {
                setBookingResult({
                    tokenNumber: data.tokenNumber || bookingData?.tokenNumber || '--',
                    estimatedTime: data.estimatedTime || '~10 min'
                });
                setStatus('accepted');
                playSuccessAnimation();
            } else if (data.action === 'booking_rejected' && isOurBooking) {
                setStatus('rejected');
            }
        });

        return () => {
            socket.off('bookingStatus', handleBookingStatus);
            socket.off('queueUpdate');
        };
    }, [visible, bookingData, salon]);

    // Helper: Format time "14:00" -> "2:00 PM"
    const formatTime12 = (time24) => {
        if (!time24) return '';
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    // Reset on open
    useEffect(() => {
        if (visible) {
            setBookingResult(null);
            setCountdown(60);
            checkmarkScale.setValue(0);
            checkmarkFill.setValue(0);
            sheetAnim.setValue(height);
            backdropOpacity.setValue(0);
            progressAnim.setValue(1);

            // Auto-accept for appointment bookings
            if (bookingData?.bookingType === 'appointment') {
                setStatus('accepted');
                setBookingResult({
                    tokenNumber: bookingData?.tokenNumber || '--',
                    appointmentSlot: bookingData?.appointmentSlot,
                    appointmentDate: bookingData?.appointmentDate,
                    bookingType: 'appointment',
                });
                setTimeout(() => playSuccessAnimation(), 200);
                return;
            }

            setStatus('confirming');
            startPulseAnimation();

            // Start countdown animation
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 60000,
                useNativeDriver: false,
                easing: Easing.linear
            }).start();
        } else {
            // Clear countdown when overlay closes
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }
    }, [visible]);

    // Countdown timer
    useEffect(() => {
        if (visible && status === 'confirming') {
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        countdownRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        };
    }, [visible, status]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true
                })
            ])
        ).start();
    };

    const playSuccessAnimation = () => {
        // Checkmark animation
        Animated.sequence([
            Animated.timing(checkmarkScale, {
                toValue: 1,
                duration: 400,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true
            }),
            Animated.timing(checkmarkFill, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false
            })
        ]).start();

        // Confetti
        confettiAnims.forEach((anim, i) => {
            const angle = (i / 20) * Math.PI * 2;
            const distance = 80 + Math.random() * 60;
            const targetX = Math.cos(angle) * distance;
            const targetY = Math.sin(angle) * distance;

            Animated.parallel([
                Animated.timing(anim.scale, {
                    toValue: 1,
                    duration: 200,
                    delay: i * 20,
                    useNativeDriver: true
                }),
                Animated.timing(anim.x, {
                    toValue: targetX,
                    duration: 500,
                    delay: i * 20,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true
                }),
                Animated.timing(anim.y, {
                    toValue: targetY,
                    duration: 500,
                    delay: i * 20,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true
                }),
                Animated.timing(anim.opacity, {
                    toValue: 0,
                    duration: 400,
                    delay: i * 20 + 300,
                    useNativeDriver: true
                })
            ]).start();
        });

        // Show bottom sheet after animation
        setTimeout(() => {
            showBottomSheet();
        }, 1200);
    };

    const showBottomSheet = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.spring(sheetAnim, {
                toValue: 0,
                tension: 65,
                friction: 11,
                useNativeDriver: true
            })
        ]).start();
    };

    const hideBottomSheet = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            }),
            Animated.timing(sheetAnim, {
                toValue: height,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            onClose?.();
        });
    };

    const confettiColors = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>

                {/* Confirming State */}
                {status === 'confirming' && (
                    <View style={styles.centerContent}>
                        {/* Countdown Circle */}
                        <View style={styles.countdownContainer}>
                            {/* Background ring (gray) */}
                            <View style={styles.countdownRingBg} />
                            {/* Progress ring - Right half */}
                            <View style={styles.halfClipRight}>
                                <Animated.View style={[styles.halfCircleRight, {
                                    transform: [{
                                        rotate: progressAnim.interpolate({
                                            inputRange: [0, 0.5],
                                            outputRange: ['180deg', '0deg'],
                                            extrapolate: 'clamp'
                                        })
                                    }]
                                }]} />
                            </View>
                            {/* Progress ring - Left half */}
                            <View style={styles.halfClipLeft}>
                                <Animated.View style={[styles.halfCircleLeft, {
                                    transform: [{
                                        rotate: progressAnim.interpolate({
                                            inputRange: [0.5, 1],
                                            outputRange: ['180deg', '0deg'],
                                            extrapolate: 'clamp'
                                        })
                                    }]
                                }]} />
                            </View>
                            {/* Inner circle with timer */}
                            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                                <View style={styles.confirmingIcon}>
                                    <Text style={styles.countdownNumber}>{countdown}</Text>
                                    <Text style={styles.countdownSec}>sec</Text>
                                </View>
                            </Animated.View>
                        </View>
                        <Text style={styles.confirmingText}>Confirming...</Text>
                        <Text style={styles.confirmingSubtext}>Waiting for salon to accept</Text>
                    </View>
                )}

                {/* Rejected State */}
                {status === 'rejected' && (
                    <View style={styles.centerContent}>
                        <View style={styles.rejectedIcon}>
                            <Ionicons name="close" size={50} color="#FFF" />
                        </View>
                        <Text style={styles.rejectedText}>Booking Declined</Text>
                        <Text style={styles.rejectedSubtext}>The salon couldn't accept your request</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Success Animation */}
                {status === 'accepted' && (
                    <>
                        {/* Checkmark */}
                        <Animated.View style={[
                            styles.checkmarkContainer,
                            { transform: [{ scale: checkmarkScale }] }
                        ]}>
                            <Animated.View style={[
                                styles.checkmarkCircle,
                                {
                                    backgroundColor: checkmarkFill.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['transparent', '#10B981']
                                    })
                                }
                            ]}>
                                <Ionicons name="checkmark" size={45} color="#FFF" />
                            </Animated.View>
                        </Animated.View>

                        {/* Confetti */}
                        <View style={styles.confettiContainer}>
                            {confettiAnims.map((anim, i) => (
                                <Animated.View
                                    key={i}
                                    style={[
                                        styles.confetti,
                                        {
                                            backgroundColor: confettiColors[i % confettiColors.length],
                                            transform: [
                                                { translateX: anim.x },
                                                { translateY: anim.y },
                                                { scale: anim.scale }
                                            ],
                                            opacity: anim.opacity
                                        }
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Bottom Sheet Backdrop */}
                        <Animated.View
                            style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}
                            pointerEvents={status === 'accepted' ? 'auto' : 'none'}
                        >
                            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={hideBottomSheet} />
                        </Animated.View>

                        {/* Success Bottom Sheet */}
                        <Animated.View style={[
                            styles.bottomSheet,
                            { transform: [{ translateY: sheetAnim }] }
                        ]}>
                            {/* Handle */}
                            <View style={styles.sheetHandle} />

                            {/* Success Header */}
                            <View style={styles.successHeader}>
                                <View style={styles.celebrationIcon}>
                                    <Text style={{ fontSize: 32 }}>🎉</Text>
                                </View>
                                <Text style={styles.successTitle}>Booking Confirmed!</Text>
                                <Text style={styles.successSubtitle}>Your slot is secured.</Text>
                            </View>

                            {/* Ticket Card */}
                            <View style={styles.ticketCard}>
                                {/* Decorative circles */}
                                <View style={[styles.ticketCircle, styles.circleLeft]} />
                                <View style={[styles.ticketCircle, styles.circleRight]} />

                                <View style={styles.ticketTop}>
                                    <View>
                                        <Text style={styles.ticketLabel}>{bookingResult?.bookingType === 'appointment' ? 'APPOINTMENT' : 'TOKEN NO'}</Text>
                                        <Text style={styles.tokenNumber}>
                                            {bookingResult?.bookingType === 'appointment'
                                                ? formatTime12(bookingResult?.appointmentSlot?.start)
                                                : `#${bookingResult?.tokenNumber || bookingData?.tokenNumber || '--'}`
                                            }
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.ticketLabel}>
                                            {bookingResult?.bookingType === 'appointment' ? 'DATE' : 'EST. TIME'}
                                        </Text>
                                        <Text style={styles.estTime}>
                                            {bookingResult?.bookingType === 'appointment'
                                                ? new Date(bookingResult?.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                                : (bookingResult?.estimatedTime || '~10 min')
                                            }
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.ticketDivider} />

                                <View style={styles.ticketBottom}>
                                    <Image
                                        source={{ uri: salon?.images?.[0] || 'https://via.placeholder.com/50' }}
                                        style={styles.salonThumb}
                                    />
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={styles.salonName}>{salon?.name || 'Salon'}</Text>
                                        <Text style={styles.serviceName}>
                                            {bookingData?.services?.[0]?.name || 'Service'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Actions */}
                            <TouchableOpacity
                                style={styles.viewQueueBtn}
                                onPress={() => {
                                    hideBottomSheet();
                                    setTimeout(() => onViewQueue?.(bookingResult), 400);
                                }}
                            >
                                <Ionicons name={bookingResult?.bookingType === 'appointment' ? 'calendar' : 'eye'} size={20} color="#4ADE80" />
                                <Text style={styles.viewQueueText}>
                                    {bookingResult?.bookingType === 'appointment' ? 'VIEW MY BOOKINGS' : 'VIEW LIVE QUEUE'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.closeLightBtn} onPress={hideBottomSheet}>
                                <Text style={styles.closeLightText}>Close</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.98)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    centerContent: {
        alignItems: 'center'
    },

    // Confirming
    pulseCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center'
    },
    confirmingIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center'
    },
    confirmingText: {
        marginTop: 24,
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937'
    },
    confirmingSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280'
    },
    countdownContainer: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    countdownRingBg: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 5,
        borderColor: '#E5E7EB'
    },
    halfClipRight: {
        position: 'absolute',
        width: 60,
        height: 120,
        left: 60,
        overflow: 'hidden'
    },
    halfClipLeft: {
        position: 'absolute',
        width: 60,
        height: 120,
        left: 0,
        overflow: 'hidden'
    },
    halfCircleRight: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 5,
        borderColor: '#6366F1',
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
        left: -60
    },
    halfCircleLeft: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 5,
        borderColor: '#6366F1',
        borderRightColor: 'transparent',
        borderTopColor: 'transparent'
    },
    countdownNumber: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFF'
    },
    countdownSec: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginTop: -2
    },

    // Rejected
    rejectedIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center'
    },
    rejectedText: {
        marginTop: 24,
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937'
    },
    rejectedSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 40
    },
    closeBtn: {
        marginTop: 32,
        paddingVertical: 14,
        paddingHorizontal: 40,
        backgroundColor: '#1F2937',
        borderRadius: 16
    },
    closeBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },

    // Checkmark
    checkmarkContainer: {
        position: 'absolute',
        top: height * 0.35
    },
    checkmarkCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Confetti
    confettiContainer: {
        position: 'absolute',
        top: height * 0.35 + 40,
        left: width / 2,
        width: 0,
        height: 0
    },
    confetti: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5
    },

    // Bottom Sheet
    sheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20
    },
    sheetHandle: {
        width: 48,
        height: 5,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 24
    },

    // Success Header
    successHeader: {
        alignItems: 'center',
        marginBottom: 24
    },
    celebrationIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937'
    },
    successSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4
    },

    // Ticket
    ticketCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginBottom: 24,
        overflow: 'hidden'
    },
    ticketCircle: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    circleLeft: {
        left: -12,
        top: '50%',
        marginTop: -12
    },
    circleRight: {
        right: -12,
        top: '50%',
        marginTop: -12
    },
    ticketTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        borderStyle: 'dashed'
    },
    ticketLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9CA3AF',
        letterSpacing: 1
    },
    tokenNumber: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1F2937'
    },
    estTime: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#8B5CF6'
    },
    ticketDivider: {
        height: 16
    },
    ticketBottom: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    salonThumb: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#E5E7EB'
    },
    salonName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1F2937'
    },
    serviceName: {
        fontSize: 12,
        color: '#6B7280'
    },

    // Buttons
    viewQueueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1F2937',
        paddingVertical: 18,
        borderRadius: 20,
        gap: 10,
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6
    },
    viewQueueText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    closeLightBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 12
    },
    closeLightText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '600'
    }
});

export default BookingConfirmationOverlay;
