import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const { width } = Dimensions.get('window');

const BookingRequestModal = ({ visible, request, onAccept, onReject }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [timeLeft, setTimeLeft] = useState(60); // 60s countdown

    useEffect(() => {
        if (visible) {
            setTimeLeft(60);
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [visible]);

    if (!visible || !request) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={() => {}} // Block back button
        >
            <View style={styles.overlay}>
                {/* Dark Theme Card as requested */}
                <View style={[styles.card, { backgroundColor: '#1E1E2E' }]}> 
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={styles.fireIcon}>🔥</Text>
                            <Text style={styles.title}>New Booking Request</Text>
                        </View>
                        <Text style={[styles.timer, { color: timeLeft < 10 ? '#FF5252' : '#FF7043' }]}>
                            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                        </Text>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.profileContainer}>
                            {request.customerImage ? (
                                <Image source={{ uri: request.customerImage }} style={styles.profileImage} />
                            ) : (
                                <View style={[styles.profilePlaceholder, { backgroundColor: '#FF7043' }]}>
                                     <Text style={styles.initials}>{request.customerName?.charAt(0) || 'G'}</Text>
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.details}>
                            <Text style={styles.customerName}>{request.customerName}</Text>
                            <Text style={styles.serviceName}>{request.services}</Text>
                            <Text style={styles.price}>₹{request.totalAmount}</Text>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity 
                            style={[styles.btn, styles.rejectBtn]} 
                            onPress={onReject}
                        >
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.btn, styles.acceptBtn]} 
                            onPress={onAccept}
                        >
                            <Text style={styles.btnText}>Accept</Text>
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
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    fireIcon: {
        fontSize: 18,
        marginRight: 8
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    timer: {
        fontSize: 16,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums']
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24
    },
    profileContainer: {
        marginRight: 16
    },
    profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30
    },
    profilePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center'
    },
    initials: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold'
    },
    details: {
        flex: 1
    },
    customerName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4
    },
    serviceName: {
        color: '#B0B0B0',
        fontSize: 14,
        marginBottom: 4
    },
    price: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    rejectBtn: {
        backgroundColor: '#FF5252'
    },
    acceptBtn: {
        backgroundColor: '#4CAF50'
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold'
    }
});

export default BookingRequestModal;
