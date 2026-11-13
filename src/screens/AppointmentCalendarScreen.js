import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    Linking,
    Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import { getUpcomingAppointments, respondToBooking } from '../services/api';

const { width } = Dimensions.get('window');

// Helper: Format "14:00" -> "2:00 PM"
const formatTime12 = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Helper: Format date nicely
const formatAppDate = (dateStr) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Helper: Get relative date label
const getDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 6) return date.toLocaleDateString('en-IN', { weekday: 'long' });
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const AppointmentCalendarScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all'); // all, today, upcoming

    const fetchAppointments = useCallback(async () => {
        try {
            if (!salon?._id) return;
            const data = await getUpcomingAppointments(salon._id);
            setAppointments(data.appointments || []);
        } catch (error) {
            // silently fail
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [salon?._id]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAppointments();
    };

    // Filter appointments
    const filtered = appointments.filter(a => {
        if (activeFilter === 'all') return true;
        const appDate = new Date(a.appointmentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (activeFilter === 'today') {
            return appDate.toDateString() === today.toDateString();
        }
        if (activeFilter === 'upcoming') {
            return appDate >= tomorrow;
        }
        return true;
    });

    // Group by date
    const grouped = filtered.reduce((acc, apt) => {
        const label = getDateLabel(apt.appointmentDate);
        if (!acc[label]) acc[label] = [];
        acc[label].push(apt);
        return acc;
    }, {});

    // Stats
    const todayCount = appointments.filter(a => {
        const d = new Date(a.appointmentDate);
        return d.toDateString() === new Date().toDateString();
    }).length;

    const totalRevenue = appointments.reduce((s, a) => s + (a.totalAmount || 0), 0);

    const handleCall = (phone) => {
        const num = phone || '';
        if (num) Linking.openURL(`tel:${num}`);
    };

    const handleCancel = async (bookingId) => {
        Alert.alert(
            'Cancel Appointment',
            'Are you sure you want to cancel this appointment?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
                        try {
                            await respondToBooking(bookingId, 'rejected');
                            fetchAppointments();
                            Alert.alert('Cancelled', 'Appointment has been cancelled.');
                        } catch (e) {
                            Alert.alert('Error', e.message || 'Failed to cancel');
                        }
                    }
                }
            ]
        );
    };

    const handleCheckIn = async (bookingId) => {
        Alert.alert(
            'Check In Customer',
            'Do you want to check in this customer and add them to the active live queue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Check In',
                    onPress: async () => {
                        try {
                            await respondToBooking(bookingId, 'accept');
                            fetchAppointments();
                            Alert.alert('Checked In! ✅', 'Customer checked in and added to the active live queue.');
                        } catch (e) {
                            Alert.alert('Error', e.message || 'Failed to check in customer');
                        }
                    }
                }
            ]
        );
    };

    const renderAppointmentCard = (apt) => {
        const user = apt.userId || {};
        const photo = user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=7C4DFF&color=fff`;
        const services = apt.services?.map(s => s.name).join(', ') || 'Service';
        const dateLabel = formatAppDate(apt.appointmentDate);
        const timeSlot = apt.appointmentSlot || {};
        const phone = user.phone || user.phoneNumber || '';

        return (
            <View key={apt._id} style={[styles.appointmentCard, { backgroundColor: isDarkMode ? '#1E1E2E' : '#FFF', borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                {/* Top Row: User + Time */}
                <View style={styles.cardTopRow}>
                    <Image source={{ uri: photo }} style={styles.avatar} />
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name || 'Customer'}</Text>
                        {phone ? (
                            <TouchableOpacity onPress={() => handleCall(phone)} style={styles.phoneRow}>
                                <Ionicons name="call-outline" size={12} color="#7C4DFF" />
                                <Text style={styles.phoneText}>{phone}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <View style={styles.timeBadge}>
                        <Ionicons name="time" size={12} color="#7C4DFF" />
                        <Text style={styles.timeBadgeText}>
                            {formatTime12(timeSlot.start)} - {formatTime12(timeSlot.end)}
                        </Text>
                    </View>
                </View>

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6' }]} />

                {/* Details Row */}
                <View style={styles.detailsRow}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.detailItem}>
                            <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{dateLabel}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Ionicons name="cut-outline" size={14} color="#7C4DFF" />
                            <Text style={[styles.serviceText, { color: theme.colors.text }]} numberOfLines={1}>{services}</Text>
                        </View>
                        {apt.estimatedDuration ? (
                            <View style={styles.detailItem}>
                                <Ionicons name="hourglass-outline" size={14} color={theme.colors.textSecondary} />
                                <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{apt.estimatedDuration} min</Text>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>Amount</Text>
                        <Text style={styles.amountValue}>₹{apt.totalAmount || 0}</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}
                        onPress={() => handleCheckIn(apt._id)}
                    >
                        <Ionicons name="enter-outline" size={16} color="#4F46E5" />
                        <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>Check In</Text>
                    </TouchableOpacity>
                    {phone ? (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#1A2E1A' : '#ECFDF5' }]} onPress={() => handleCall(phone)}>
                            <Ionicons name="call" size={16} color="#059669" />
                            <Text style={[styles.actionBtnText, { color: '#059669' }]}>Call</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEF2F2' }]}
                        onPress={() => handleCancel(apt._id)}
                    >
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="Appointments" showBack />

            {/* Stats Bar */}
            <View style={[styles.statsBar, { backgroundColor: isDarkMode ? '#1E1E2E' : '#FFF', borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F0ECFF' }]}>
                        <Ionicons name="today" size={18} color="#7C4DFF" />
                    </View>
                    <View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{todayCount}</Text>
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Today</Text>
                    </View>
                </View>
                <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]} />
                <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: isDarkMode ? '#1A2E1A' : '#E8F5E9' }]}>
                        <Ionicons name="calendar" size={18} color="#4CAF50" />
                    </View>
                    <View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{appointments.length}</Text>
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total</Text>
                    </View>
                </View>
                <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]} />
                <View style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: isDarkMode ? '#2E2A1A' : '#FFF8E1' }]}>
                        <Ionicons name="cash" size={18} color="#F59E0B" />
                    </View>
                    <View>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{totalRevenue}</Text>
                        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Revenue</Text>
                    </View>
                </View>
            </View>

            {/* Filter Tabs */}
            <View style={[styles.filterRow, { backgroundColor: isDarkMode ? '#1E1E2E' : '#F5F5F5' }]}>
                {[
                    { key: 'all', label: 'All', icon: 'list' },
                    { key: 'today', label: 'Today', icon: 'today' },
                    { key: 'upcoming', label: 'Upcoming', icon: 'arrow-forward' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
                        onPress={() => setActiveFilter(tab.key)}
                    >
                        <Ionicons name={tab.icon} size={14} color={activeFilter === tab.key ? '#FFF' : theme.colors.textSecondary} />
                        <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive, { color: activeFilter === tab.key ? '#FFF' : theme.colors.textSecondary }]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#7C4DFF" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading appointments...</Text>
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#555' : '#CCC'} />
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Appointments</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        {activeFilter === 'today' ? "No appointments scheduled for today" : "No upcoming appointments found"}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C4DFF']} />}
                >
                    {Object.keys(grouped).map(dateLabel => (
                        <View key={dateLabel} style={styles.dateSection}>
                            <View style={styles.dateLabelRow}>
                                <View style={[styles.dateDot, dateLabel === 'Today' && { backgroundColor: '#7C4DFF' }]} />
                                <Text style={[styles.dateLabel, { color: theme.colors.text }]}>{dateLabel}</Text>
                                <Text style={[styles.dateCount, { color: theme.colors.textSecondary }]}>{grouped[dateLabel].length} appointment{grouped[dateLabel].length > 1 ? 's' : ''}</Text>
                            </View>
                            {grouped[dateLabel].map(apt => renderAppointmentCard(apt))}
                        </View>
                    ))}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 50,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
        paddingHorizontal: 40,
    },

    // Stats Bar
    statsBar: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    statValue: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: '70%',
        alignSelf: 'center',
        marginHorizontal: 8,
    },

    // Filter Row
    filterRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 6,
        borderRadius: 12,
        padding: 4,
    },
    filterTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    filterTabActive: {
        backgroundColor: '#7C4DFF',
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 4,
    },
    filterTabTextActive: {
        color: '#FFF',
    },

    // List
    listContainer: {
        padding: 16,
        paddingTop: 8,
    },
    dateSection: {
        marginBottom: 20,
    },
    dateLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginRight: 8,
    },
    dateLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
    },
    dateCount: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Appointment Card
    appointmentCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    phoneText: {
        fontSize: 12,
        color: '#7C4DFF',
        fontWeight: '600',
        marginLeft: 4,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0ECFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    timeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7C4DFF',
        marginLeft: 4,
    },
    divider: {
        height: 1,
        marginVertical: 12,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    detailText: {
        fontSize: 12,
        marginLeft: 6,
        fontWeight: '500',
    },
    serviceText: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },
    amountContainer: {
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        minWidth: 70,
    },
    amountLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#059669',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    amountValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#059669',
    },

    // Action Row
    actionRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 6,
    },
});

export default AppointmentCalendarScreen;
