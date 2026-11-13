import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import RazorpayCheckout from 'react-native-razorpay';
import { bookService, createOrder, verifyPayment, getRazorpayKey, getAvailableSlots, bookAppointment } from '../services/api';
import { ENV } from '../config/env';
import BookingConfirmationOverlay from '../components/BookingConfirmationOverlay';

// Helper: Get current time in IST (HH:MM format)
const getISTTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    return istNow.toISOString().slice(11, 16);
};

// Helper: Format time "14:00" -> "2:00 PM"
const formatTime12 = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Helper: Generate next N days
const getNextDays = (count = 7) => {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < count; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        days.push({
            date: date.toISOString().slice(0, 10),
            day: dayNames[date.getDay()],
            dateNum: date.getDate(),
            month: monthNames[date.getMonth()],
            isToday: i === 0,
        });
    }
    return days;
};

const BookingScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon = {}, selectedServices = [], selectedStaff, user } = route.params || {};
    const [paymentMethod, setPaymentMethod] = useState('pay_at_salon');
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [currentBookingData, setCurrentBookingData] = useState(null);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitMessage, setLimitMessage] = useState('');

    // Appointment states
    const [bookingType, setBookingType] = useState('queue'); // 'queue' or 'appointment'
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Dynamic Razorpay Key State
    const [razorpayKey, setRazorpayKey] = useState(ENV.RAZORPAY_KEY);

    useEffect(() => {
        const fetchKey = async () => {
            try {
                const key = await getRazorpayKey();
                if (key) setRazorpayKey(key);
            } catch (e) { }
        };
        fetchKey();
    }, []);

    const safeServices = selectedServices || [];
    const subtotal = safeServices.reduce((sum, s) => sum + s.price, 0);
    const total = subtotal;
    const totalDuration = safeServices.reduce((sum, s) => sum + (s.duration || 30), 0);

    // Check if salon is currently closed
    const isSalonClosed = () => {
        if (salon?.status === 'closed') return true;
        if (!salon?.timings?.open || !salon?.timings?.close) return false;
        const currentTime = getISTTime();
        return currentTime < salon.timings.open || currentTime > salon.timings.close;
    };

    // Listen for appointment data from SlotSelectionScreen
    useEffect(() => {
        if (route.params?.appointmentDate !== undefined) {
            setSelectedDate(route.params.appointmentDate);
            setSelectedSlot(route.params.appointmentSlot);
            setBookingType(route.params.appointmentDate ? 'appointment' : 'queue');
        }
    }, [route.params?.appointmentDate, route.params?.appointmentSlot]);

    // Queue booking (existing flow)
    const handleConfirmBooking = async () => {
        try {
            setLoading(true);
            if (paymentMethod === 'pay_at_salon') {
                const bookingData = {
                    userId: user?.id || user?._id || 'GUEST_USER',
                    salonId: salon._id,
                    services: selectedServices,
                    staffId: selectedStaff?._id,
                    totalAmount: total
                };
                const result = await bookService(bookingData);
                setCurrentBookingData({ ...bookingData, bookingId: result?.bookingId || result?._id, tokenNumber: result?.tokenNumber });
                setShowConfirmation(true);
                setLoading(false);
                return;
            }

            if (paymentMethod === 'razorpay') {
                const order = await createOrder({
                    userId: user?.id || user?._id || 'GUEST_USER',
                    isFirstMonth: false
                });
                const options = {
                    description: 'Booking Fee',
                    image: 'https://i.imgur.com/3g7nmJC.png',
                    currency: 'INR',
                    key: razorpayKey,
                    amount: order.amount,
                    name: 'Smart Salon',
                    order_id: order.id,
                    prefill: {
                        email: user?.email || 'user@example.com',
                        contact: user?.phone || '9999999999',
                        name: user?.name || 'User Name'
                    },
                    theme: { color: theme.colors.primary }
                };
                RazorpayCheckout.open(options).then(async (data) => {
                    await verifyPayment({
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature,
                        userId: user?.id || user?._id || 'GUEST_USER'
                    });
                    const bookingData = {
                        userId: user?.id || user?._id || 'GUEST_USER',
                        salonId: salon._id,
                        services: selectedServices,
                        staffId: selectedStaff?._id,
                        totalAmount: total,
                        paymentId: data.razorpay_payment_id
                    };
                    const result = await bookService(bookingData);
                    setCurrentBookingData({ ...bookingData, bookingId: result?.bookingId || result?._id, tokenNumber: result?.tokenNumber });
                    setShowConfirmation(true);
                    setLoading(false);
                }).catch((error) => {
                    Alert.alert('Payment Failed', error.description || 'Something went wrong');
                    setLoading(false);
                });
            }
        } catch (error) {
            const errorMsg = error.message || 'Booking failed';
            if (errorMsg.toLowerCase().includes('monthly booking limit') || errorMsg.toLowerCase().includes('limit reached')) {
                setLimitMessage(errorMsg);
                setShowLimitModal(true);
            } else {
                Alert.alert('Error', errorMsg);
            }
            setLoading(false);
        }
    };

    // Appointment booking
    const handleBookAppointment = async () => {
        if (!selectedDate || !selectedSlot) {
            Alert.alert('Select Slot', 'Please select a date and time slot first');
            return;
        }
        try {
            setLoading(true);
            const bookingData = {
                userId: user?.id || user?._id || 'GUEST_USER',
                salonId: salon._id,
                services: selectedServices,
                staffId: selectedStaff?._id,
                totalAmount: total,
                appointmentDate: selectedDate,
                appointmentSlot: selectedSlot,
            };
            const result = await bookAppointment(bookingData);
            setCurrentBookingData({
                ...bookingData,
                bookingId: result?.bookingId || result?._id,
                tokenNumber: result?.tokenNumber,
                bookingType: 'appointment',
                appointmentSlot: selectedSlot,
                appointmentDate: selectedDate,
            });
            setShowConfirmation(true);
        } catch (error) {
            const errorMsg = error.message || 'Appointment booking failed';
            if (errorMsg.toLowerCase().includes('monthly booking limit') || errorMsg.toLowerCase().includes('limit reached')) {
                setLimitMessage(errorMsg);
                setShowLimitModal(true);
            } else {
                Alert.alert('Error', errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOverlayClose = () => {
        setShowConfirmation(false);
        setCurrentBookingData(null);
    };

    const handleViewQueue = (bookingResult) => {
        setShowConfirmation(false);
        navigation.navigate('LiveQueue', {
            bookingId: bookingResult?.bookingId || 'SUCCESS',
            salon,
            user
        });
    };

    const renderPaymentOption = (id, label, icon) => {
        const isComingSoon = id === 'razorpay' || id === 'upi';
        return (
            <TouchableOpacity
                style={[
                    styles.paymentOption,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    paymentMethod === id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceHighlight },
                    isComingSoon && { opacity: 0.6 }
                ]}
                onPress={() => {
                    if (isComingSoon) {
                        Alert.alert('Coming Soon', 'Online payment methods will be available soon. Please use Pay at Salon for now.');
                        return;
                    }
                    setPaymentMethod(id);
                }}
                activeOpacity={isComingSoon ? 0.8 : 0.2}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons
                        name={icon}
                        size={24}
                        color={paymentMethod === id ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <View style={{ marginLeft: 12 }}>
                        <Text style={[
                            styles.paymentLabel,
                            { color: theme.colors.text },
                            paymentMethod === id && { color: theme.colors.primary, fontWeight: 'bold' }
                        ]}>{label}</Text>
                        {isComingSoon && (
                            <Text style={{ fontSize: 10, color: theme.colors.secondary, marginTop: 2, fontWeight: '600' }}>
                                COMING SOON
                            </Text>
                        )}
                    </View>
                </View>
                {paymentMethod === id && <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />}
            </TouchableOpacity>
        );
    };

    const salonClosed = isSalonClosed();

    return (
        <ScreenWrapper>
            <Header title="Confirm Booking" showBack />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* Salon Summary */}
                <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.salonName, { color: theme.colors.text }]}>{salon.name}</Text>
                    <Text style={[styles.salonAddress, { color: theme.colors.textSecondary }]}>{salon.address}</Text>
                    {bookingType === 'appointment' && selectedDate && selectedSlot ? (
                        <View style={styles.row}>
                            <Badge label={selectedDate === new Date().toISOString().slice(0, 10) ? 'Today' : new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} color="#7C4DFF" size="sm" />
                            <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                Appointment: {formatTime12(selectedSlot.start)} - {formatTime12(selectedSlot.end)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.row}>
                            <Badge label="Today" color={theme.colors.secondary} size="sm" />
                            <Text style={[styles.timeText, { color: theme.colors.text }]}>Estimated Start: 10:30 AM</Text>
                        </View>
                    )}
                </Card>

                {/* Appointment Selected Info */}
                {bookingType === 'appointment' && selectedDate && selectedSlot && (
                    <View style={[styles.appointmentSelectedCard, { backgroundColor: isDarkMode ? '#1A2E1A' : '#F0FDF4', borderColor: '#BBF7D0' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="calendar" size={22} color="#7C4DFF" />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={[styles.appointmentSelectedTitle, { color: theme.colors.text }]}>Appointment Selected</Text>
                                <Text style={[styles.appointmentSelectedSub, { color: theme.colors.textSecondary }]}>
                                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} • {formatTime12(selectedSlot.start)} - {formatTime12(selectedSlot.end)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('SlotSelection', {
                                salonId: salon._id,
                                totalDuration,
                                existingDate: selectedDate,
                                existingSlot: selectedSlot,
                            })}
                        >
                            <Ionicons name="create-outline" size={20} color="#7C4DFF" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Services Summary */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Services ({selectedServices.length})</Text>
                    {selectedServices.map((service, index) => (
                        <View key={index} style={styles.serviceRow}>
                            <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
                                {service.photos && service.photos.length > 0 && (
                                    <Image
                                        source={{ uri: service.photos[0] }}
                                        style={styles.serviceImage}
                                    />
                                )}
                                <View style={{ marginLeft: service.photos?.length > 0 ? 12 : 0, flex: 1 }}>
                                    <Text style={[styles.serviceName, { color: theme.colors.text }]}>{service.name}</Text>
                                    <Text style={[styles.serviceDuration, { color: theme.colors.textLight }]}>{service.duration} mins • General</Text>
                                </View>
                            </View>
                            <Text style={[styles.servicePrice, { color: theme.colors.text }]}>₹{service.price}</Text>
                        </View>
                    ))}
                </View>

                {/* Staff Summary */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Specialist</Text>
                    <View style={[styles.staffCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {selectedStaff ? (
                                <Image
                                    source={{ uri: selectedStaff.photo || selectedStaff.image || `https://ui-avatars.com/api/?name=${selectedStaff.name}` }}
                                    style={styles.staffImage}
                                />
                            ) : (
                                <View style={[styles.staffImage, { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="people" size={20} color="#666" />
                                </View>
                            )}
                            <View style={{ marginLeft: 12 }}>
                                <Text style={[styles.staffName, { color: theme.colors.text }]}>
                                    {selectedStaff?.name || 'Any Professional'}
                                </Text>
                                <Text style={[styles.staffRole, { color: theme.colors.textSecondary }]}>
                                    {selectedStaff?.role || 'Maximum availability'}
                                </Text>
                            </View>
                        </View>
                        {selectedStaff && <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />}
                    </View>
                </View>

                {/* Payment Method — Only for Queue booking */}
                {bookingType === 'queue' && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Method</Text>
                        {salonClosed ? (
                            <View style={{
                                backgroundColor: '#ffebee',
                                padding: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#ffcdd2',
                                marginBottom: 12,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <Ionicons name="warning" size={20} color="#d32f2f" />
                                <Text style={{ color: '#d32f2f', marginLeft: 8, fontWeight: 'bold' }}>
                                    Salon is currently closed.
                                </Text>
                                <Text style={{ color: '#d32f2f', marginLeft: 4, fontSize: 12 }}>
                                    ({salon?.timings?.open} - {salon?.timings?.close})
                                </Text>
                            </View>
                        ) : (
                            <>
                                {renderPaymentOption('razorpay', 'Pay via Razorpay', 'card-outline')}
                                {renderPaymentOption('upi', 'UPI / GPay / PhonePe', 'qr-code-outline')}
                                {renderPaymentOption('pay_at_salon', 'Pay at Salon', 'cash-outline')}
                            </>
                        )}
                    </View>
                )}

                {/* Appointment Info Card */}
                {bookingType === 'appointment' && (
                    <View style={[styles.appointmentInfoCard, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F0ECFF' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="information-circle" size={20} color="#7C4DFF" />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C4DFF', marginLeft: 6 }}>Appointment Info</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
                            • Appointment auto-accepted, queue mein add hoga{'\n'}
                            • Payment salon pe service ke baad karni hogi{'\n'}
                            • Cancel karne ke liye "My Bookings" mein jaaye
                        </Text>
                    </View>
                )}

                {/* Bill Details */}
                <View style={[styles.billContainer, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Bill Details</Text>
                    <View style={styles.billRow}>
                        <Text style={[styles.billLabel, { color: theme.colors.textSecondary }]}>Item Total</Text>
                        <Text style={[styles.billValue, { color: theme.colors.text }]}>₹{subtotal}</Text>
                    </View>
                    <View style={[styles.billRow, styles.totalRow, { borderTopColor: theme.colors.divider }]}>
                        <Text style={[styles.totalLabel, { color: theme.colors.text }]}>To Pay</Text>
                        <Text style={[styles.totalValue, { color: theme.colors.primary }]}>₹{total.toFixed(2)}</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Footer — Calendar + Confirm/Appointment button */}
            <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.divider }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {/* Calendar Button (Appointment) */}
                    <TouchableOpacity
                        style={[
                            styles.calendarFooterBtn,
                            {
                                borderColor: bookingType === 'appointment' ? '#7C4DFF' : theme.colors.border,
                                backgroundColor: bookingType === 'appointment' ? (isDarkMode ? '#2D1B69' : '#F0ECFF') : (isDarkMode ? '#2C2C2C' : '#F5F5F5'),
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 12,
                            }
                        ]}
                        onPress={() => navigation.navigate('SlotSelection', {
                            salonId: salon._id,
                            totalDuration,
                            existingDate: selectedDate,
                            existingSlot: selectedSlot,
                            // Pass original params so SlotSelection can send them back
                            originalParams: { salon, selectedServices, selectedStaff, user },
                        })}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={18} color={bookingType === 'appointment' ? '#7C4DFF' : theme.colors.textSecondary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: bookingType === 'appointment' ? '#7C4DFF' : theme.colors.textSecondary, marginLeft: 4 }}>Appointment</Text>
                    </TouchableOpacity>

                    {/* Main Action Button */}
                    {bookingType === 'appointment' ? (
                        <TouchableOpacity
                            style={[
                                styles.appointmentBtn,
                                { flex: 1, marginLeft: 12 },
                                (!selectedDate || !selectedSlot) && { opacity: 0.5 }
                            ]}
                            onPress={handleBookAppointment}
                            disabled={loading || !selectedDate || !selectedSlot}
                            activeOpacity={0.7}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="calendar-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.appointmentBtnText}>
                                        {selectedSlot
                                            ? `Book • ${formatTime12(selectedSlot.start)} • ₹${total.toFixed(2)}`
                                            : 'Select Date & Slot'
                                        }
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Button
                                title={salonClosed ? "Salon Closed" : `Confirm Booking • ₹${total.toFixed(2)}`}
                                onPress={handleConfirmBooking}
                                loading={loading}
                                disabled={salonClosed}
                                style={salonClosed ? { opacity: 0.5, backgroundColor: '#999' } : {}}
                            />
                        </View>
                    )}
                </View>
            </View>

            {/* Booking Confirmation Overlay */}
            <BookingConfirmationOverlay
                visible={showConfirmation}
                bookingData={currentBookingData}
                salon={salon}
                onClose={handleOverlayClose}
                onViewQueue={handleViewQueue}
            />

            {/* Booking Limit Reached Modal */}
            <LimitReachedModal
                visible={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                message={limitMessage}
                theme={theme}
            />
        </ScreenWrapper >
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 24,
        paddingBottom: 100,
    },
    sectionCard: {
        padding: 16,
        marginBottom: 24,
    },
    salonName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    salonAddress: {
        fontSize: 14,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        marginLeft: 8,
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },

    // Appointment Selected Card
    appointmentSelectedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 24,
        borderWidth: 1,
    },
    appointmentSelectedTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    appointmentSelectedSub: {
        fontSize: 12,
        marginTop: 2,
    },

    // Calendar Footer Button
    calendarFooterBtn: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
    },

    // Appointment Info
    appointmentInfoCard: {
        padding: 16,
        borderRadius: 14,
        marginBottom: 24,
        borderLeftWidth: 3,
        borderLeftColor: '#7C4DFF',
    },

    // Services
    serviceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    serviceImage: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F0F0F0',
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    serviceDuration: {
        fontSize: 12,
        fontWeight: '500',
    },
    servicePrice: {
        fontSize: 15,
        fontWeight: 'bold',
    },

    // Staff
    staffCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
    },
    staffImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F0F0F0',
    },
    staffName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    staffRole: {
        fontSize: 13,
    },

    // Payment
    paymentOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 12,
    },
    paymentLabel: {
        marginLeft: 12,
        fontSize: 14,
    },

    // Bill
    billContainer: {
        padding: 16,
        borderRadius: 12,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    billLabel: {
        fontSize: 14,
    },
    billValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        elevation: 10,
    },
    appointmentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7C4DFF',
        paddingVertical: 16,
        borderRadius: 14,
        elevation: 4,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    appointmentBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

// --- BOOKING LIMIT REACHED MODAL ---
const LimitReachedModal = ({ visible, onClose, message, theme }) => {
    const resetMatch = message.match(/resets on (.+)\./i);
    const resetDate = resetMatch ? resetMatch[1] : '';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={limitStyles.overlay}>
                <View style={[limitStyles.card, { backgroundColor: theme.colors.surface }]}>
                    <TouchableOpacity style={limitStyles.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={22} color="#888" />
                    </TouchableOpacity>
                    <View style={limitStyles.iconCircle}>
                        <Ionicons name="calendar-outline" size={32} color="#FF6B6B" />
                    </View>
                    <Text style={[limitStyles.title, { color: theme.colors.text }]}>Booking Limit Reached</Text>
                    <View style={limitStyles.infoCard}>
                        <View style={limitStyles.infoRow}>
                            <Ionicons name="information-circle" size={20} color="#FF6B6B" />
                            <Text style={limitStyles.infoTitle}>Limit Reached</Text>
                        </View>
                        <Text style={limitStyles.infoText}>
                            Aap ek mahine mein sirf 3 baar booking kar sakte hain
                        </Text>
                        {resetDate ? (
                            <Text style={limitStyles.resetText}>
                                Aapki limit <Text style={{ fontWeight: '700' }}>{resetDate}</Text> ko reset hogi.
                            </Text>
                        ) : null}
                    </View>
                    <TouchableOpacity style={limitStyles.okBtn} onPress={onClose}>
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={limitStyles.okBtnText}>Samajh Gaya</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const limitStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    infoCard: {
        width: '100%',
        backgroundColor: '#FFF8F0',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 3,
        borderLeftColor: '#FF6B6B',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FF6B6B',
        marginLeft: 6,
    },
    infoText: {
        fontSize: 13,
        color: '#555',
        lineHeight: 20,
    },
    resetText: {
        fontSize: 13,
        color: '#555',
        marginTop: 8,
        lineHeight: 20,
    },
    okBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1C2237',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 14,
        width: '100%',
        gap: 8,
    },
    okBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default BookingScreen;
