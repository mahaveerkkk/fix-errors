import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../../theme/theme';

const { width } = Dimensions.get('window');

const LiveQueueTicket = ({ booking, onClose, onView }) => {
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7
        }).start();
    }, []);

    if (!booking) return null;

    // Status Config
    const getStatusConfig = (status) => {
        switch (status) {
            case 'accepted': return { color: '#4CAF50', icon: 'checkmark-circle', text: 'Booking Confirmed' };
            case 'on_way': return { color: '#2196F3', icon: 'walk', text: 'You are On the Way' };
            case 'next_in_line': return { color: '#FF9800', icon: 'time', text: 'You are Next!' };
            default: return { color: theme.colors.primary, icon: 'ticket', text: 'Live Ticket' };
        }
    };

    const config = getStatusConfig(booking.status);

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={[styles.leftStrip, { backgroundColor: config.color }]} />
            
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Ionicons name={config.icon} size={14} color="#FFF" />
                        <Text style={styles.badgeText}>{config.text}</Text>
                    </View>
                    <Text style={styles.timeText}>10:30 AM</Text>
                </View>

                <View style={styles.row}>
                    <View>
                        <Text style={styles.salonName}>{booking.salonName || 'Luxe Salon'}</Text>
                        <Text style={styles.serviceName}>{booking.serviceName || 'Haircut & Spa'}</Text>
                    </View>
                    <View style={styles.tokenBox}>
                        <Text style={styles.tokenLabel}>TOKEN</Text>
                        <Text style={styles.tokenNum}>#{booking.token || '05'}</Text>
                    </View>
                </View>

                {/* Progress Bar (Fake for visual) */}
                <View style={styles.progressContainer}>
                    <Text style={styles.queueInfo}>3 people ahead of you</Text>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '60%', backgroundColor: config.color }]} />
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#999" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60, // Below header
        left: 20,
        right: 20,
        backgroundColor: '#FFF',
        borderRadius: 16,
        flexDirection: 'row',
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden'
    },
    leftStrip: {
        width: 6,
        height: '100%'
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4
    },
    timeText: {
        color: '#999',
        fontSize: 12,
        fontWeight: '600'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    salonName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000'
    },
    serviceName: {
        fontSize: 12,
        color: '#666',
        marginTop: 2
    },
    tokenBox: {
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8
    },
    tokenLabel: {
        fontSize: 8,
        color: '#999',
        fontWeight: 'bold'
    },
    tokenNum: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000'
    },
    progressContainer: {
        marginTop: 4
    },
    queueInfo: {
        fontSize: 10,
        color: theme.colors.primary,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'right'
    },
    progressBarBg: {
        height: 4,
        backgroundColor: '#EEE',
        borderRadius: 2,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2
    },
    closeBtn: {
        padding: 10,
        justifyContent: 'flex-start'
    }
});

export default LiveQueueTicket;
