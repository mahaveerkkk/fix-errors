import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import { getSalonHistory } from '../services/api';

const { width } = Dimensions.get('window');

const BookingHistoryScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('Daily'); // Daily, Weekly, Monthly

    useEffect(() => {
        if (salon?._id) {
            fetchHistory();
        }
    }, [salon?._id, period]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const data = await getSalonHistory(salon._id, period);
            setHistory(data);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    // Helper to format date reliably - uses updatedAt, fallback to createdAt
    const formatDate = (item) => {
        const dateStr = item.updatedAt || item.createdAt;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Unknown Date";

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (item) => {
        const dateStr = item.updatedAt || item.createdAt;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Grouping logic
    const groupedHistory = history.reduce((groups, item) => {
        const date = formatDate(item);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(item);
        return groups;
    }, {});

    const renderHistoryItem = (item) => (
        <View key={item._id} style={[styles.historyCard, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
            <View style={styles.cardHeader}>
                <Image
                    source={{ uri: item.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${item.userId?.name || 'User'}` }}
                    style={[styles.avatar, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6', borderColor: isDarkMode ? '#444' : '#EEE' }]}
                />
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.colors.text }]}>{item.userId?.name || 'Served Customer'}</Text>
                    <Text style={styles.serviceText}>
                        <Ionicons name="cut" size={14} color="#7C4DFF" /> {item.services?.map(s => s.name).join(', ') || 'General Service'}
                    </Text>
                    <Text style={styles.timeText}>
                        <Ionicons name="time-outline" size={12} color="#9CA3AF" /> Served {item.updatedAt ? 'at' : 'on'} {formatTime(item)}
                    </Text>
                </View>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Paid</Text>
                    <Text style={styles.priceValue}>₹{item.totalAmount}</Text>
                </View>
            </View>
        </View>
    );

    const getStyles = () => StyleSheet.create({
        filterContainer: {
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            borderRadius: 12,
            padding: 4,
            margin: 16,
            borderWidth: 1,
            borderColor: isDarkMode ? '#333' : '#F0F0F0',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 5
        },
    });

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="Booking History" showBack />

            {/* Tab Filter */}
            <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                {['Daily', 'Weekly', 'Monthly'].map(range => (
                    <TouchableOpacity
                        key={range}
                        style={[styles.filterBtn, period === range && styles.activeFilterBtn]}
                        onPress={() => setPeriod(range)}
                    >
                        <Text style={[styles.filterText, period === range && styles.activeFilterText]}>{range}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#7C4DFF" />
                </View>
            ) : history.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#555' : '#CCC'} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No service history for {period.toLowerCase()}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                    {Object.keys(groupedHistory).map((dateGroup) => (
                        <View key={dateGroup} style={styles.dateSection}>
                            <Text style={[styles.dateHeader, { color: theme.colors.textSecondary }]}>{dateGroup}</Text>
                            {groupedHistory[dateGroup].map(item => renderHistoryItem(item))}
                        </View>
                    ))}
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
        paddingBottom: 50
    },
    listContainer: {
        padding: 16,
        paddingTop: 0
    },
    filterContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        margin: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeFilterBtn: {
        backgroundColor: '#1A1F2B',
    },
    filterText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 13
    },
    activeFilterText: {
        color: '#FFF',
    },
    dateSection: {
        marginBottom: 20,
    },
    dateHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 4
    },
    historyCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
    },
    userInfo: {
        flex: 1,
        marginLeft: 14,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2
    },
    serviceText: {
        fontSize: 13,
        color: '#7C4DFF',
        fontWeight: '600'
    },
    timeText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    priceContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        minWidth: 70
    },
    priceLabel: {
        fontSize: 10,
        color: '#059669',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    priceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#059669',
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
        fontWeight: '500'
    }
});

export default BookingHistoryScreen;
