import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StatusBar,
    SafeAreaView,
    Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getAvailableSlots } from '../services/api';

const { width } = Dimensions.get('window');

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

const SlotSelectionScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salonId, totalDuration, existingDate, existingSlot, originalParams } = route.params;

    const [selectedDate, setSelectedDate] = useState(existingDate || null);
    const [selectedSlot, setSelectedSlot] = useState(existingSlot || null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsMessage, setSlotsMessage] = useState('');

    const nextDays = getNextDays(7);

    // Fetch slots when date is selected
    useEffect(() => {
        if (selectedDate) {
            fetchSlots(selectedDate);
        }
    }, [selectedDate]);

    const fetchSlots = async (date) => {
        try {
            setSlotsLoading(true);
            setSlotsMessage('');
            setSelectedSlot(null);
            const data = await getAvailableSlots(salonId, date, totalDuration);
            setAvailableSlots(data.slots || []);
            if (data.message) setSlotsMessage(data.message);
            if (data.slots?.length === 0 && !data.message) {
                setSlotsMessage('No slots available for this date');
            }
        } catch (error) {
            setSlotsMessage('Failed to load slots');
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    const handleConfirmSlot = () => {
        if (!selectedDate || !selectedSlot) {
            Alert.alert('Select Slot', 'Please select a date and time slot');
            return;
        }
        // Navigate back with ALL original params + appointment data
        navigation.navigate('Booking', {
            ...originalParams,
            appointmentDate: selectedDate,
            appointmentSlot: selectedSlot,
        });
    };

    const handleClearSlot = () => {
        // Navigate back with ALL original params + cleared appointment data
        navigation.navigate('Booking', {
            ...originalParams,
            appointmentDate: null,
            appointmentSlot: null,
        });
    };

    // Count available (not booked) slots
    const freeSlotCount = availableSlots.filter(s => !s.isBooked).length;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={theme.colors.background}
            />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Select Appointment Slot</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* Info Card */}
                <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F0ECFF' }]}>
                    <Ionicons name="information-circle" size={20} color="#7C4DFF" />
                    <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                        Select a date and time slot for your appointment. Booked slots are shown in red.
                    </Text>
                </View>

                {/* Date Selector */}
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.text} /> Select Date
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                    {nextDays.map((d) => (
                        <TouchableOpacity
                            key={d.date}
                            style={[
                                styles.dateChip,
                                { backgroundColor: isDarkMode ? '#1E1E2E' : '#FFF', borderColor: theme.colors.border },
                                selectedDate === d.date && { backgroundColor: '#7C4DFF', borderColor: '#7C4DFF' }
                            ]}
                            onPress={() => setSelectedDate(d.date)}
                        >
                            <Text style={[
                                styles.dateChipDay,
                                { color: selectedDate === d.date ? '#FFF' : theme.colors.textSecondary }
                            ]}>{d.day}</Text>
                            <Text style={[
                                styles.dateChipNum,
                                { color: selectedDate === d.date ? '#FFF' : theme.colors.text }
                            ]}>{d.dateNum}</Text>
                            <Text style={[
                                styles.dateChipMonth,
                                { color: selectedDate === d.date ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
                            ]}>{d.month}</Text>
                            {d.isToday && (
                                <View style={[styles.todayDot, selectedDate === d.date && { backgroundColor: '#FFF' }]} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Time Slots */}
                {selectedDate && (
                    <>
                        <View style={styles.slotHeaderRow}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                                <Ionicons name="time-outline" size={16} color={theme.colors.text} /> Available Slots
                            </Text>
                            {freeSlotCount > 0 && (
                                <View style={styles.slotCountBadge}>
                                    <Text style={styles.slotCountText}>{freeSlotCount} available</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.durationHint, { color: theme.colors.textSecondary }]}>
                            Each slot: {totalDuration} mins
                        </Text>

                        {slotsLoading ? (
                            <View style={styles.slotsLoadingContainer}>
                                <ActivityIndicator size="large" color="#7C4DFF" />
                                <Text style={[styles.slotsLoadingText, { color: theme.colors.textSecondary }]}>Loading slots...</Text>
                            </View>
                        ) : slotsMessage ? (
                            <View style={[styles.noSlotsCard, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FFF5F5' }]}>
                                <Ionicons name="calendar-clear-outline" size={40} color="#FF6B6B" />
                                <Text style={[styles.noSlotsText, { color: theme.colors.textSecondary }]}>{slotsMessage}</Text>
                            </View>
                        ) : (
                            <View style={styles.slotsGrid}>
                                {availableSlots.map((slot, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.slotChip,
                                            { backgroundColor: isDarkMode ? '#1E1E2E' : '#FFF', borderColor: theme.colors.border },
                                            slot.isBooked && {
                                                backgroundColor: isDarkMode ? '#2A2A2A' : '#FFF0F0',
                                                borderColor: isDarkMode ? '#433' : '#FECACA',
                                                opacity: 0.6
                                            },
                                            selectedSlot?.start === slot.start && !slot.isBooked && {
                                                backgroundColor: '#7C4DFF',
                                                borderColor: '#7C4DFF'
                                            }
                                        ]}
                                        onPress={() => {
                                            if (slot.isBooked) {
                                                Alert.alert('Slot Booked', 'This time slot is already booked. Please choose another.');
                                                return;
                                            }
                                            setSelectedSlot({ start: slot.start, end: slot.end });
                                        }}
                                        disabled={slot.isBooked}
                                    >
                                        <Text style={[
                                            styles.slotTime,
                                            { color: theme.colors.text },
                                            slot.isBooked && { color: '#FF6B6B', textDecorationLine: 'line-through' },
                                            selectedSlot?.start === slot.start && !slot.isBooked && { color: '#FFF' }
                                        ]}>
                                            {formatTime12(slot.start)}
                                        </Text>
                                        {slot.isBooked ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                <Ionicons name="close-circle" size={12} color="#FF6B6B" />
                                                <Text style={{ fontSize: 9, color: '#FF6B6B', marginLeft: 2 }}>Booked</Text>
                                            </View>
                                        ) : selectedSlot?.start === slot.start ? (
                                            <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginTop: 2 }} />
                                        ) : (
                                            <Text style={[styles.slotEnd, { color: theme.colors.textSecondary }]}>
                                                to {formatTime12(slot.end)}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}

                {/* Selected Summary */}
                {selectedDate && selectedSlot && (
                    <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#1A2E1A' : '#F0FDF4' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Slot Selected</Text>
                            <Text style={[styles.summarySubtitle, { color: theme.colors.textSecondary }]}>
                                {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} • {formatTime12(selectedSlot.start)} - {formatTime12(selectedSlot.end)}
                            </Text>
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.divider }]}>
                {(existingSlot || selectedSlot) && (
                    <TouchableOpacity
                        style={[styles.clearBtn, { borderColor: theme.colors.border }]}
                        onPress={handleClearSlot}
                    >
                        <Ionicons name="close" size={18} color="#FF6B6B" />
                        <Text style={styles.clearBtnText}>Remove</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        (!selectedDate || !selectedSlot) && { opacity: 0.5, backgroundColor: '#999' },
                        (existingSlot || selectedSlot) ? { flex: 1, marginLeft: 12 } : { flex: 1 }
                    ]}
                    onPress={handleConfirmSlot}
                    disabled={!selectedDate || !selectedSlot}
                >
                    <Ionicons name="calendar-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>
                        {selectedSlot
                            ? `Confirm • ${formatTime12(selectedSlot.start)}`
                            : 'Select a Slot'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        padding: 20,
        paddingBottom: 120,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 24,
        borderLeftWidth: 3,
        borderLeftColor: '#7C4DFF',
    },
    infoText: {
        fontSize: 13,
        marginLeft: 10,
        flex: 1,
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 14,
    },
    slotHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    slotCountBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    slotCountText: {
        color: '#2E7D32',
        fontSize: 11,
        fontWeight: '700',
    },
    durationHint: {
        fontSize: 12,
        marginBottom: 14,
    },

    // Date Picker
    dateChip: {
        width: 68,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 16,
        marginRight: 10,
        borderWidth: 1.5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    dateChipDay: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    dateChipNum: {
        fontSize: 22,
        fontWeight: '800',
    },
    dateChipMonth: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    todayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#7C4DFF',
        marginTop: 6,
    },

    // Slots
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    slotChip: {
        width: '30%',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 14,
        borderWidth: 1.5,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    slotTime: {
        fontSize: 13,
        fontWeight: '700',
    },
    slotEnd: {
        fontSize: 10,
        marginTop: 2,
    },
    slotsLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    slotsLoadingText: {
        marginTop: 10,
        fontSize: 14,
    },
    noSlotsCard: {
        alignItems: 'center',
        padding: 32,
        borderRadius: 16,
    },
    noSlotsText: {
        marginTop: 10,
        fontSize: 14,
        textAlign: 'center',
    },

    // Summary
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    summarySubtitle: {
        fontSize: 13,
        marginTop: 2,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 10,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    clearBtnText: {
        color: '#FF6B6B',
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 4,
    },
    confirmBtn: {
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
    confirmBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default SlotSelectionScreen;
