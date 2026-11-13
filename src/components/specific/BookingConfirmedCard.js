import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const BookingConfirmedCard = ({ booking, onCancel, onViewQueue }) => {
    if (!booking) return null;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.headerText}>🎉 Booking Confirmed</Text>
            </View>

            <View style={styles.content}>
                <Image 
                    source={{ uri: booking.salonImage || 'https://via.placeholder.com/100' }} 
                    style={styles.salonImage} 
                />
                <View style={styles.details}>
                    <Text style={styles.salonName}>{booking.salonName}</Text>
                    <Text style={styles.timeInfo}>
                        {new Date(booking.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.tokenText}>Token: #{booking.tokenNumber}</Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity 
                    style={[styles.btn, styles.cancelBtn]} 
                    onPress={onCancel}
                >
                    <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.btn, styles.viewBtn]} 
                    onPress={onViewQueue}
                >
                    <Text style={[styles.btnText, { color: '#FFFFFF' }]}>View Queue</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1E1E2E',
        borderRadius: 24,
        padding: 20,
        margin: 16,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold'
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20
    },
    salonImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 16
    },
    details: {
        flex: 1
    },
    salonName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4
    },
    timeInfo: {
        color: '#B0B0B0',
        fontSize: 12,
        marginBottom: 4
    },
    tokenText: {
        color: '#42A5F5',
        fontSize: 14,
        fontWeight: 'bold'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cancelBtn: {
        backgroundColor: '#2C2C3E'
    },
    viewBtn: {
        backgroundColor: '#42A5F5' // Blue
    },
    btnText: {
        color: '#B0B0B0', // Lighter text for cancel
        fontSize: 14,
        fontWeight: 'bold'
    }
});

export default BookingConfirmedCard;
