import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image, Modal, Linking, Share, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { getUserBookings, updateCustomerStatus, sendCustomerStatus, cancelBookingByUser, addReview } from '../services/api';
import WriteReviewModal from '../components/common/WriteReviewModal';

const UserBookingsScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [activeTab, setActiveTab] = useState('upcoming');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = route.params || {};

    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);

    // In-App Receipt & WhatsApp Bill State
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptBooking, setReceiptBooking] = useState(null);

    // Cancel Reason Modal State
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [selectedCancelBookingId, setSelectedCancelBookingId] = useState(null);
    const userCancelReasons = [
        "Change of Plans",
        "Found Another Salon",
        "Running Late",
        "Emergency",
        "Other"
    ];

    // Helper: Dynamic On-The-Fly Receipt Text for WhatsApp (Zero Database Overhead)
    const generateReceiptText = (b) => {
        if (!b) return '';
        const salon = b.salonId || {};
        const salonName = salon.name || 'Salon';
        const dateStr = b.appointmentDate
            ? new Date(b.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : (b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today');
        const timeStr = b.slotTime || (b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
        const servicesList = (b.services || []).map(s => `• ${s.name} — ₹${s.price || 0}`).join('\n');
        const tokenStr = b.tokenNumber ? `Token #${b.tokenNumber}` : `ID: ${String(b._id).slice(-6).toUpperCase()}`;

        return `🧾 *STYLQ - SERVICE RECEIPT*
━━━━━━━━━━━━━━━━━━━━
📍 *Salon:* ${salonName}
${salon.address ? `📌 *Location:* ${salon.address}\n` : ''}📅 *Date:* ${dateStr} ${timeStr ? `| ${timeStr}` : ''}
🎟️ *Booking:* ${tokenStr}
👤 *Customer:* ${user?.name || 'Valued Customer'}

✂️ *SERVICES:*
${servicesList || '• Salon Service'}

━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL PAID:* ₹${b.totalAmount || 0}
💳 *PAYMENT MODE:* ${b.paymentMethod === 'online' ? 'Online Paid ✅' : 'Paid at Counter (Cash/UPI)'}
━━━━━━━━━━━━━━━━━━━━
✨ _Thank you for visiting! Book again anytime on StylQ._`;
    };

    const handleShareWhatsAppReceipt = async (booking) => {
        if (!booking) return;
        const text = generateReceiptText(booking);
        const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                await Share.share({ message: text });
            }
        } catch (error) {
            Share.share({ message: text });
        }
    };

    const fetchBookings = async () => {
        try {
            const userId = user?.id || user?._id;
            if (userId) {
                const bookingsData = await getUserBookings(userId);
                setData(bookingsData);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [user]);

    const handleStatusUpdate = async (booking, status) => {
        try {
            // Update booking status
            await updateCustomerStatus(booking._id, status);

            // Also send push notification to salon owner
            const salonId = booking.salonId?._id || booking.salonId;
            const userId = user?.id || user?._id;
            const notifyStatus = status.includes('on my way') ? 'on_the_way' : 'delayed';

            await sendCustomerStatus(salonId, userId, notifyStatus);

            Alert.alert('✅ Status Sent!', `Salon notified: "${status}"`);
        } catch (error) {
            Alert.alert('Error', 'Failed to send status update');
        }
    };

    const handleCancelBooking = (bookingId) => {
        setSelectedCancelBookingId(bookingId);
        setCancelReason('');
        setCancelModalVisible(true);
    };

    const handleConfirmCancel = async () => {
        if (!cancelReason) {
            Alert.alert("Reason Required", "Please select a reason for cancellation.");
            return;
        }
        try {
            setLoading(true);
            setCancelModalVisible(false);
            const userId = user?.id || user?._id;
            await cancelBookingByUser(selectedCancelBookingId, userId, cancelReason);
            Alert.alert("Success", "Booking cancelled successfully.");
            fetchBookings();
        } catch (error) {
            Alert.alert("Error", error.message || "Failed to cancel booking.");
        } finally {
            setLoading(false);
            setSelectedCancelBookingId(null);
            setCancelReason('');
        }
    };


    const filteredBookings = data.filter(b =>
        activeTab === 'upcoming'
            ? ['upcoming', 'accepted', 'pending', 'scheduled'].includes(b.status)
            : !['upcoming', 'accepted', 'pending', 'scheduled'].includes(b.status)
    );

    const getStatusBadgeConfig = (status) => {
        const isDark = isDarkMode;
        switch (status) {
            case 'completed':
                return {
                    label: 'Completed',
                    icon: 'checkmark-circle',
                    bg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                    color: '#10B981',
                    border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0'
                };
            case 'cancelled':
                return {
                    label: 'Cancelled',
                    icon: 'close-circle',
                    bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                    color: '#EF4444',
                    border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA'
                };
            case 'rejected':
                return {
                    label: 'Declined',
                    icon: 'ban',
                    bg: isDark ? 'rgba(107, 114, 128, 0.2)' : '#F3F4F6',
                    color: '#6B7280',
                    border: isDark ? 'rgba(107, 114, 128, 0.3)' : '#E5E7EB'
                };
            case 'accepted':
            case 'upcoming':
            case 'scheduled':
                return {
                    label: status === 'accepted' ? 'Confirmed' : 'Scheduled',
                    icon: 'shield-checkmark',
                    bg: isDark ? 'rgba(124, 77, 255, 0.2)' : '#EDE8FF',
                    color: '#7C4DFF',
                    border: isDark ? 'rgba(124, 77, 255, 0.35)' : '#DDD6FE'
                };
            case 'in_service':
                return {
                    label: 'In Service',
                    icon: 'cut',
                    bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                    color: '#D97706',
                    border: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A'
                };
            case 'pending':
                return {
                    label: 'Pending',
                    icon: 'time',
                    bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
                    color: '#B45309',
                    border: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A'
                };
            default:
                return {
                    label: status ? status.toUpperCase() : 'BOOKING',
                    icon: 'calendar',
                    bg: isDark ? '#2A2A3C' : '#F1F5F9',
                    color: '#64748B',
                    border: isDark ? '#3E3E55' : '#E2E8F0'
                };
        }
    };

    const handleRebook = (salon) => {
        const salonId = salon?._id || salon?.id;
        if (salonId) {
            navigation.navigate('SalonDetails', { salonId, salon });
        } else {
            Alert.alert("Notice", "Salon details unavailable.");
        }
    };

    const renderBookingItem = ({ item }) => {
        const salon = item.salonId || {};
        const salonPhoto = salon.images?.[0] || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(salon.name || 'Salon') + '&background=7C4DFF&color=fff';
        const badge = getStatusBadgeConfig(item.status);
        const isDark = isDarkMode;

        // Formatted Date & Time
        const bookingDate = item.appointmentDate
            ? new Date(item.appointmentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : new Date(item.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        const bookingTime = item.slotTime || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

        return (
            <View style={[styles.bookingCard, { backgroundColor: isDark ? '#1C182E' : '#FFFFFF', borderColor: isDark ? '#2E274D' : '#E8EDF5' }]}>
                {/* CARD HEADER */}
                <View style={styles.cardHeader}>
                    <Image source={{ uri: salonPhoto }} style={styles.salonPhoto} />
                    <View style={styles.headerInfo}>
                        <Text style={[styles.salonName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                            {salon.name || 'Salon'}
                        </Text>
                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={13} color={isDark ? '#9CA3AF' : '#64748B'} />
                            <Text style={[styles.dateText, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                                {bookingDate} {bookingTime ? `• ${bookingTime}` : ''}
                            </Text>
                        </View>
                    </View>

                    {/* STATUS BADGE */}
                    <View style={[styles.statusBadgePill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Ionicons name={badge.icon} size={12} color={badge.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                </View>

                {/* TICKET PERFORATED DIVIDER */}
                <View style={styles.perforatedLineContainer}>
                    <View style={[styles.perforatedLine, { borderColor: isDark ? '#2E274D' : '#E2E8F0' }]} />
                </View>

                {/* SERVICES & TOKEN SECTION */}
                <View style={styles.detailsSection}>
                    <View style={styles.serviceRowContainer}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.serviceLabel, { color: isDark ? '#A1A5B7' : '#64748B' }]}>SERVICES BOOKED</Text>
                            <Text style={[styles.serviceText, { color: isDark ? '#F3F4F6' : '#1E293B' }]}>
                                {item.services?.map(s => s.name).join(', ') || 'Salon Service'}
                            </Text>
                        </View>

                        {item.tokenNumber && (
                            <View style={[styles.tokenPassBadge, { backgroundColor: isDark ? '#29224A' : '#EDE8FF', borderColor: isDark ? '#433878' : '#D8B4FE' }]}>
                                <Ionicons name="ticket-outline" size={12} color="#7C4DFF" style={{ marginRight: 4 }} />
                                <Text style={styles.tokenPassText}>Token #{item.tokenNumber}</Text>
                            </View>
                        )}
                    </View>

                    {/* CANCELLATION REASON BANNER */}
                    {item.status === 'cancelled' && item.cancellationReason && (
                        <View style={[styles.cancelReasonBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FECACA' }]}>
                            <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 5 }} />
                            <Text style={[styles.cancelReasonText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                                Reason: {item.cancellationReason}
                            </Text>
                        </View>
                    )}
                </View>

                {/* PRICE & PAYMENT METHOD FOOTER */}
                <View style={[styles.pricingRow, { backgroundColor: isDark ? '#161325' : '#F8FAFC', borderColor: isDark ? '#261F42' : '#F1F5F9' }]}>
                    <View>
                        <Text style={[styles.priceSubLabel, { color: isDark ? '#9CA3AF' : '#64748B' }]}>Total Amount</Text>
                        <Text style={[styles.priceText, { color: isDark ? '#FFF' : '#0F172A' }]}>₹{item.totalAmount}</Text>
                    </View>
                    <View style={[styles.paymentMethodPill, { backgroundColor: isDark ? '#231E3D' : '#EDE8FF' }]}>
                        <Ionicons name={item.paymentMethod === 'online' ? "card-outline" : "cash-outline"} size={13} color="#7C4DFF" style={{ marginRight: 4 }} />
                        <Text style={styles.paymentMethodText}>
                            {item.paymentMethod === 'online' ? 'Paid Online' : 'Pay at Counter'}
                        </Text>
                    </View>
                </View>

                {/* INTERACTIVE ACTION BAR */}
                {/* 1. Status Update Actions for Active / Accepted Bookings */}
                {item.status === 'accepted' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5', borderColor: '#10B981' }]}
                            onPress={() => handleStatusUpdate(item, 'On my way 🏃')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="walk" size={15} color="#10B981" style={{ marginRight: 5 }} />
                            <Text style={[styles.statusBtnText, { color: '#10B981' }]}>On my way</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: isDark ? '#7F1D1D' : '#FEF2F2', borderColor: '#EF4444' }]}
                            onPress={() => handleStatusUpdate(item, 'Running Late ⏰')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="time" size={15} color="#EF4444" style={{ marginRight: 5 }} />
                            <Text style={[styles.statusBtnText, { color: '#EF4444' }]}>Running Late</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2. Cancel Button for Active Bookings */}
                {['pending', 'accepted', 'upcoming', 'scheduled'].includes(item.status) && (
                    <TouchableOpacity
                        style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}
                        onPress={() => handleCancelBooking(item._id)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="close-circle-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                    </TouchableOpacity>
                )}

                {/* 3. Completed Booking: Rate Service + Rebook + Receipt Buttons */}
                {item.status === 'completed' && (
                    <View>
                        <View style={styles.historyActionRow}>
                            {!item.isReviewed ? (
                                <TouchableOpacity
                                    style={styles.reviewBtn}
                                    onPress={() => {
                                        setSelectedBooking(item);
                                        setShowReviewModal(true);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="star" size={14} color="#FFF" style={{ marginRight: 5 }} />
                                    <Text style={styles.reviewBtnText}>Rate (5★)</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.reviewedBadge, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5', borderColor: '#10B981' }]}>
                                    <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                                    <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.rebookBtn, { backgroundColor: isDark ? '#261F4D' : '#EDE8FF', borderColor: isDark ? '#433878' : '#DDD6FE' }]}
                                onPress={() => handleRebook(salon)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="repeat" size={14} color="#7C4DFF" style={{ marginRight: 5 }} />
                                <Text style={styles.rebookBtnText}>Book Again</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 1-Tap Digital Bill / Receipt Button */}
                        <TouchableOpacity
                            style={[styles.receiptBtn, { backgroundColor: isDark ? '#064E3B' : '#F0FDF4', borderColor: isDark ? '#059669' : '#BBF7D0' }]}
                            onPress={() => {
                                setReceiptBooking(item);
                                setShowReceiptModal(true);
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="receipt-outline" size={15} color={isDark ? '#34D399' : '#16A34A'} style={{ marginRight: 6 }} />
                            <Text style={[styles.receiptBtnText, { color: isDark ? '#34D399' : '#15803D' }]}>View Bill / Share on WhatsApp</Text>
                            <Ionicons name="logo-whatsapp" size={15} color="#25D366" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* 4. Cancelled / Declined Booking: 1-Tap Rebook Option */}
                {['cancelled', 'rejected'].includes(item.status) && (
                    <TouchableOpacity
                        style={[styles.rebookFullBtn, { backgroundColor: isDark ? '#261F4D' : '#EDE8FF', borderColor: isDark ? '#433878' : '#DDD6FE' }]}
                        onPress={() => handleRebook(salon)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="refresh" size={15} color="#7C4DFF" style={{ marginRight: 6 }} />
                        <Text style={styles.rebookFullBtnText}>Rebook Salon</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="My Bookings" />

            <View style={[styles.tabsContainer, { borderBottomColor: theme.colors.divider }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'upcoming' && { borderBottomColor: theme.colors.primary }]}
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'upcoming' ? theme.colors.primary : theme.colors.textSecondary }]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'past' && { borderBottomColor: theme.colors.primary }]}
                    onPress={() => setActiveTab('past')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'past' ? theme.colors.primary : theme.colors.textSecondary }]}>History</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredBookings}
                    renderItem={renderBookingItem}
                    keyExtractor={item => item._id || item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color={theme.colors.textLight} />
                            <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>No bookings found</Text>
                        </View>
                    }
                />
            )}

            <WriteReviewModal
                visible={showReviewModal}
                onClose={() => {
                    setShowReviewModal(false);
                    setSelectedBooking(null);
                }}
                salonId={selectedBooking?.salonId?._id || selectedBooking?.salonId}
                userId={user?._id || user?.id}
                salonName={selectedBooking?.salonId?.name || 'Salon'}
                onSuccess={() => {
                    if (selectedBooking) {
                        setData(prevData => prevData.map(b =>
                            b._id === selectedBooking._id ? { ...b, isReviewed: true } : b
                        ));
                    }
                    Alert.alert("Success", "Shukriya! Aapka review submit ho gaya hai. ⭐");
                }}
            />

            {/* --- Cancel Reason Modal --- */}
            <Modal
                visible={cancelModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View style={cancelStyles.overlay}>
                    <View style={cancelStyles.container}>
                        <View style={cancelStyles.handle} />
                        <View style={cancelStyles.header}>
                            <Text style={cancelStyles.title}>Cancel Booking</Text>
                            <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={cancelStyles.subtitle}>Why are you cancelling?</Text>
                        <Text style={cancelStyles.hint}>Reason will be sent to the salon via notification.</Text>

                        {userCancelReasons.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                style={[
                                    cancelStyles.reasonOption,
                                    cancelReason === reason && cancelStyles.reasonOptionSelected
                                ]}
                                onPress={() => setCancelReason(reason)}
                            >
                                <Ionicons
                                    name={cancelReason === reason ? "radio-button-on" : "radio-button-off"}
                                    size={20}
                                    color={cancelReason === reason ? '#EF4444' : '#999'}
                                />
                                <Text style={[
                                    cancelStyles.reasonText,
                                    cancelReason === reason && cancelStyles.reasonTextSelected
                                ]}>{reason}</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={[
                                cancelStyles.confirmBtn,
                                !cancelReason && { opacity: 0.5 }
                            ]}
                            onPress={handleConfirmCancel}
                            disabled={!cancelReason}
                        >
                            <Text style={cancelStyles.confirmBtnText}>Confirm Cancellation</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={cancelStyles.closeBtn}
                            onPress={() => setCancelModalVisible(false)}
                        >
                            <Text style={cancelStyles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- DIGITAL INVOICE / RECEIPT MODAL --- */}
            <Modal
                visible={showReceiptModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowReceiptModal(false)}
            >
                <View style={receiptStyles.overlay}>
                    <View style={[receiptStyles.container, { backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF' }]}>
                        <View style={receiptStyles.handle} />

                        {/* RECEIPT HEADER */}
                        <View style={receiptStyles.headerRow}>
                            <View style={receiptStyles.receiptBadge}>
                                <Ionicons name="receipt" size={16} color="#7C4DFF" style={{ marginRight: 6 }} />
                                <Text style={receiptStyles.receiptBadgeText}>SERVICE RECEIPT</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowReceiptModal(false)} style={receiptStyles.closeIconBtn}>
                                <Ionicons name="close" size={22} color={isDarkMode ? '#AAA' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                            {/* SALON INFO */}
                            <View style={receiptStyles.salonInfoBox}>
                                <Text style={[receiptStyles.salonTitle, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>
                                    {receiptBooking?.salonId?.name || 'Salon'}
                                </Text>
                                {receiptBooking?.salonId?.address ? (
                                    <Text style={[receiptStyles.salonAddress, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                                        📍 {receiptBooking.salonId.address}
                                    </Text>
                                ) : null}
                                <Text style={[receiptStyles.metaText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                                    📅 {receiptBooking?.appointmentDate
                                        ? new Date(receiptBooking.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : (receiptBooking?.createdAt ? new Date(receiptBooking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today')
                                    } • {receiptBooking?.tokenNumber ? `Token #${receiptBooking.tokenNumber}` : 'Direct Service'}
                                </Text>
                            </View>

                            {/* DOTTED PERFORATION */}
                            <View style={receiptStyles.dottedLine} />

                            {/* ITEM DETAILS */}
                            <Text style={[receiptStyles.sectionTitle, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>SERVICES RENDERED</Text>
                            {receiptBooking?.services && receiptBooking.services.length > 0 ? (
                                receiptBooking.services.map((srv, idx) => (
                                    <View key={idx} style={receiptStyles.serviceLine}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[receiptStyles.serviceName, { color: isDarkMode ? '#F1F5F9' : '#1E293B' }]}>{srv.name}</Text>
                                            {srv.duration ? (
                                                <Text style={[receiptStyles.serviceDuration, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>{srv.duration} mins</Text>
                                            ) : null}
                                        </View>
                                        <Text style={[receiptStyles.servicePrice, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>₹{srv.price || 0}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={receiptStyles.serviceLine}>
                                    <Text style={[receiptStyles.serviceName, { color: isDarkMode ? '#F1F5F9' : '#1E293B' }]}>Salon Service</Text>
                                    <Text style={[receiptStyles.servicePrice, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>₹{receiptBooking?.totalAmount || 0}</Text>
                                </View>
                            )}

                            {/* DOTTED PERFORATION */}
                            <View style={receiptStyles.dottedLine} />

                            {/* TOTAL & PAYMENT */}
                            <View style={receiptStyles.totalRow}>
                                <Text style={[receiptStyles.totalLabel, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>Total Paid</Text>
                                <Text style={receiptStyles.totalAmount}>₹{receiptBooking?.totalAmount || 0}</Text>
                            </View>
                            <View style={receiptStyles.paymentRow}>
                                <Text style={[receiptStyles.paymentModeLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Payment Method</Text>
                                <View style={receiptStyles.paidBadge}>
                                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" style={{ marginRight: 4 }} />
                                    <Text style={receiptStyles.paidBadgeText}>
                                        {receiptBooking?.paymentMethod === 'online' ? 'Online Paid' : 'Paid at Counter'}
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* ACTION BUTTONS */}
                        <View style={receiptStyles.btnRow}>
                            <TouchableOpacity
                                style={receiptStyles.whatsappBtn}
                                onPress={() => handleShareWhatsAppReceipt(receiptBooking)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={18} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={receiptStyles.whatsappBtnText}>Share on WhatsApp</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[receiptStyles.dismissBtn, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                                onPress={() => setShowReceiptModal(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[receiptStyles.dismissBtnText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        marginBottom: 16,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderColor: 'transparent'
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        padding: 24,
    },
    bookingCard: {
        padding: 16,
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    salonPhoto: {
        width: 50,
        height: 50,
        borderRadius: 14,
        marginRight: 12,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    salonName: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 2,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '500',
    },
    statusBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    perforatedLineContainer: {
        marginVertical: 12,
    },
    perforatedLine: {
        borderTopWidth: 1,
        borderStyle: 'dashed',
    },
    detailsSection: {
        marginBottom: 12,
    },
    serviceRowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 3,
    },
    serviceText: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    tokenPassBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        marginLeft: 8,
    },
    tokenPassText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '800',
    },
    cancelReasonBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        padding: 9,
        borderRadius: 10,
        borderWidth: 1,
    },
    cancelReasonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pricingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
    },
    priceSubLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '900',
        marginTop: 1,
    },
    paymentMethodPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 8,
    },
    paymentMethodText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7C4DFF',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 8,
    },
    statusBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 12,
        marginTop: 10,
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },
    historyActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    reviewBtn: {
        flex: 1,
        backgroundColor: '#7C4DFF',
        flexDirection: 'row',
        paddingVertical: 11,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    reviewBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFF',
    },
    reviewedBadge: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewedBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#10B981',
    },
    rebookBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rebookBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#7C4DFF',
    },
    rebookFullBtn: {
        marginTop: 12,
        flexDirection: 'row',
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rebookFullBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#7C4DFF',
    },
    receiptBtn: {
        marginTop: 10,
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptBtnText: {
        fontSize: 13,
        fontWeight: '700',
    }
});

const cancelStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 34,
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#DDD',
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    hint: {
        fontSize: 12,
        color: '#888',
        marginBottom: 20,
    },
    reasonOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F8F8F8',
        marginBottom: 8,
    },
    reasonOptionSelected: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    reasonText: {
        fontSize: 15,
        color: '#444',
        marginLeft: 12,
    },
    reasonTextSelected: {
        color: '#EF4444',
        fontWeight: '600',
    },
    confirmBtn: {
        backgroundColor: '#EF4444',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    confirmBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 14,
    },
});

const receiptStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    handle: {
        width: 44,
        height: 5,
        backgroundColor: '#CBD5E1',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 14,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    receiptBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(124, 77, 255, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    receiptBadgeText: {
        color: '#7C4DFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    closeIconBtn: {
        padding: 4,
    },
    salonInfoBox: {
        marginBottom: 12,
    },
    salonTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    salonAddress: {
        fontSize: 13,
        marginBottom: 4,
    },
    metaText: {
        fontSize: 12,
    },
    dottedLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        marginVertical: 14,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    serviceLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '600',
    },
    serviceDuration: {
        fontSize: 12,
        marginTop: 2,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '700',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
    },
    totalAmount: {
        fontSize: 22,
        fontWeight: '900',
        color: '#16A34A',
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 8,
    },
    paymentModeLabel: {
        fontSize: 13,
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(22, 163, 74, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    paidBadgeText: {
        color: '#16A34A',
        fontSize: 12,
        fontWeight: '700',
    },
    btnRow: {
        marginTop: 16,
        gap: 10,
    },
    whatsappBtn: {
        backgroundColor: '#25D366',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    whatsappBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
    },
    dismissBtn: {
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
    },
    dismissBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

export default UserBookingsScreen;
