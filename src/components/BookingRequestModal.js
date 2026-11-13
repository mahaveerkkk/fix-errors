import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Image, Dimensions, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

// ... (imports remain)

const BookingRequestModal = ({ visible, booking, onAccept, onReject }) => {
    // ... (timer logic remains)
    const [timeLeft, setTimeLeft] = useState(60);
    const [progress] = useState(new Animated.Value(1));

    useEffect(() => {
        let interval;
        if (visible) {
            setTimeLeft(60);
            progress.setValue(1);
            Animated.timing(progress, {
                toValue: 0,
                duration: 60000,
                useNativeDriver: false
            }).start();
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [visible]);

    if (!visible || !booking) return null;

    const isUrgent = timeLeft < 20;

    return (
        <Modal transparent={true} visible={visible} animationType="slide">
            <View style={styles.overlay}>
                <View style={[styles.container, isUrgent && styles.urgentBorder]}>

                    {/* Progress Bar (Top Line ) */}
                    <Animated.View
                        style={[
                            styles.progressBar,
                            {
                                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                                backgroundColor: isUrgent ? '#FF5252' : '#4CAF50'
                            }
                        ]}
                    />

                    {/* Section 1: Header (Name & Timer) */}
                    <View style={styles.headerRow}>
                        <View style={styles.nameContainer}>
                            <Ionicons name="person" size={18} color="#FFF" />
                            <Text style={styles.userName} numberOfLines={1}>{booking.customerName || 'Guest'}</Text>
                        </View>
                        <View style={[styles.timerPill, isUrgent && { backgroundColor: '#FF5252' }]}>
                            <Ionicons name="hourglass" size={14} color="#FFF" />
                            <Text style={styles.timerText}>{timeLeft}s</Text>
                        </View>
                    </View>

                    {/* Section 2: Photo & Token */}
                    <View style={styles.subHeaderRow}>
                        <Image
                            source={{ uri: booking.userPhoto || 'https://ui-avatars.com/api/?name=' + (booking.customerName || 'User') }}
                            style={styles.userAvatar}
                        />
                        <View style={styles.tokenBadge}>
                            <Text style={styles.tokenLabel}>Token</Text>
                            <Text style={styles.tokenNumber}>#{booking.tokenNumber || '--'}</Text>
                        </View>
                    </View>

                    {/* Divider 1 */}
                    <View style={styles.divider} />

                    {/* Section 3: Service & Price */}
                    <View style={styles.detailsContainer}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Service</Text>
                            <Text style={styles.serviceValue}>{booking.services || 'Service Details'}</Text>
                        </View>

                        <View style={styles.priceRow}>
                            <Text style={styles.detailLabel}>Price</Text>
                            <Text style={styles.priceValue}>💰 ₹{booking.totalAmount}</Text>
                        </View>
                    </View>

                    {/* Divider 2 */}
                    <View style={styles.divider} />

                    {/* Section 4: Actions */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(booking.bookingId)}>
                            <Ionicons name="close" size={24} color="#FF5252" />
                            <Text style={styles.rejectText}>Reject</Text>
                        </TouchableOpacity>

                        <View style={styles.verticalDivider} />

                        <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(booking.bookingId)}>
                            <Ionicons name="checkmark" size={24} color="#4CAF50" />
                            <Text style={styles.acceptText}>Accept</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center', // Centered for focus
        padding: 20
    },
    container: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center'
    },
    urgentBorder: {
        borderColor: '#FF5252',
        borderWidth: 2
    },
    progressBar: {
        height: 4,
        width: '100%'
    },

    // Header Row
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 10,
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20
    },
    timerText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 6
    },

    // Sub Header (Photo + Token)
    subHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    userAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#FFF'
    },
    tokenBadge: {
        alignItems: 'flex-end',
        backgroundColor: '#2A2A2A',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    tokenLabel: {
        color: '#888',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    tokenNumber: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold'
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: '#333',
        width: '100%'
    },

    // Details Content
    detailsContainer: {
        padding: 20,
        backgroundColor: '#191919'
    },
    detailRow: {
        marginBottom: 16
    },
    detailLabel: {
        color: '#666',
        fontSize: 12,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    serviceValue: {
        color: '#EEE',
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 24
    },
    priceRow: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    priceValue: {
        color: '#4CAF50',
        fontSize: 24,
        fontWeight: 'bold'
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        height: 60,
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E1E1E', // Darker
    },
    acceptBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E1E1E', // Same dark (button text carries color) OR distinct
        // Note: User diagram shows simple Reject/Accept cells, usually split visually.
    },
    verticalDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#333'
    },
    rejectText: {
        color: '#FF5252',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8
    },
    acceptText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8
    }
});

export default BookingRequestModal;
