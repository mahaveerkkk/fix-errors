import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Image,
    Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import Header from '../components/common/Header';
import { getAnalytics } from '../services/api';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};

    const [period, setPeriod] = useState('Weekly');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await getAnalytics(salon._id, period);
            setData(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <Header title="Analytics" showBack />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#7C4DFF" />
                </View>
            </SafeAreaView>
        );
    }

    // Protective check for old backend response (if backend not restarted)
    if (data && !data.heroStats) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <Header title="Analytics" showBack />
                <View style={[styles.center, { padding: 20 }]}>
                    <Ionicons name="warning-outline" size={60} color="#EF4444" />
                    <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
                        Restart Required
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                        The app is receiving old analytics data. Please close the backend terminal (`npm start`) and start it again to apply the new analytics API changes.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const {
        heroStats,
        revenueStats,
        customerInsights,
        lostCustomers,
        peakHours,
        bookingSource,
        servicesSummary,
        ratingSummary,
        chartData
    } = data;

    // Custom Bar Chart Renderers
    const renderRevenueChart = () => {
        const maxValue = Math.max(...chartData.map(d => d.value), 1);
        return (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Revenue Trend</Text>
                <View style={styles.chartContainer}>
                    {chartData.map((item, index) => {
                        const heightPercent = (item.value / maxValue) * 100;
                        return (
                            <View key={index} style={styles.barCol}>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                                </View>
                                <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderPeakHoursChart = () => {
        const hours = peakHours.chart;
        // Group by 2 hours to fit on screen
        const grouped = [];
        for (let i = 8; i < 22; i += 2) {
            grouped.push({
                label: `${i > 12 ? i - 12 : i}${i >= 12 ? 'p' : 'a'}`,
                value: hours[i] + hours[i + 1]
            });
        }

        const maxValue = Math.max(...grouped.map(d => d.value), 1);

        return (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                <View style={[styles.rowBetween, { marginBottom: 16 }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Peak Hours</Text>
                    <View style={styles.busiestBadge}>
                        <Ionicons name="flame" size={12} color="#EAB308" />
                        <Text style={styles.busiestText}>Busiest: {peakHours.busiestHour}</Text>
                    </View>
                </View>
                <View style={styles.chartContainer}>
                    {grouped.map((item, index) => {
                        const heightPercent = (item.value / maxValue) * 100;
                        return (
                            <View key={index} style={styles.barCol}>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { height: `${heightPercent}%`, backgroundColor: '#F59E0B' }]} />
                                </View>
                                <Text style={[styles.barLabel, { color: theme.colors.textSecondary, fontSize: 10 }]}>{item.label}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <Header title="Analytics" showBack />

            {/* Filter Tabs */}
            <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                {['Weekly', 'Monthly', 'Yearly'].map(range => (
                    <TouchableOpacity
                        key={range}
                        style={[styles.filterBtn, period === range && styles.activeFilterBtn]}
                        onPress={() => setPeriod(range)}
                    >
                        <Text style={[styles.filterText, period === range && styles.activeFilterText]}>{range}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. Hero Stats */}
                <View style={styles.heroGrid}>
                    <View style={[styles.heroCard, styles.mainHeroCard]}>
                        <Text style={styles.mainHeroLabel}>Total Revenue</Text>
                        <Text style={styles.mainHeroValue}>₹{heroStats.revenue}</Text>
                        <View style={styles.growthBadge}>
                            <Ionicons name="trending-up" size={14} color="#4CAF50" />
                            <Text style={styles.growthText}>{heroStats.growth} vs prev</Text>
                        </View>
                    </View>
                    <View style={styles.heroSideCol}>
                        <View style={[styles.heroCardSmall, { backgroundColor: theme.colors.surface }]}>
                            <Ionicons name="people" size={20} color="#7C4DFF" />
                            <View style={{ marginLeft: 8 }}>
                                <Text style={[styles.smallHeroVal, { color: theme.colors.text }]}>{heroStats.bookings}</Text>
                                <Text style={styles.smallHeroLabel}>Bookings</Text>
                            </View>
                        </View>
                        <View style={[styles.heroCardSmall, { backgroundColor: theme.colors.surface, marginTop: 10 }]}>
                            <Ionicons name="eye" size={20} color="#F59E0B" />
                            <View style={{ marginLeft: 8 }}>
                                <Text style={[styles.smallHeroVal, { color: theme.colors.text }]}>{heroStats.profileViews}</Text>
                                <Text style={styles.smallHeroLabel}>Profile Views</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. Revenue Breakdown */}
                <View style={styles.threeColGrid}>
                    <View style={[styles.miniCard, { backgroundColor: theme.colors.surface }]}>
                        <Text style={styles.miniLabel}>Daily Avg</Text>
                        <Text style={[styles.miniValue, { color: theme.colors.text }]}>₹{revenueStats.dailyAvg}</Text>
                    </View>
                    <View style={[styles.miniCard, { backgroundColor: theme.colors.surface }]}>
                        <Text style={styles.miniLabel}>Best Day</Text>
                        <Text style={[styles.miniValue, { color: theme.colors.text }]}>₹{revenueStats.bestDay}</Text>
                    </View>
                    <View style={[styles.miniCard, { backgroundColor: theme.colors.surface }]}>
                        <Text style={styles.miniLabel}>This Month</Text>
                        <Text style={[styles.miniValue, { color: theme.colors.text }]}>₹{revenueStats.thisMonth}</Text>
                    </View>
                </View>

                {/* 3. Revenue Trend Chart */}
                {renderRevenueChart()}

                {/* 4. Customer Insights */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Customer Insights</Text>
                    <Text style={styles.subText}>{customerInsights.totalUnique} Unique Customers • {Math.round((customerInsights.returning / Math.max(customerInsights.totalUnique, 1)) * 100)}% Retention</Text>

                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${(customerInsights.returning / Math.max(customerInsights.totalUnique, 1)) * 100}%`, backgroundColor: '#4CAF50' }]} />
                        <View style={[styles.progressFill, { width: `${(customerInsights.newCustomers / Math.max(customerInsights.totalUnique, 1)) * 100}%`, backgroundColor: '#3B82F6' }]} />
                    </View>

                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Returning: {customerInsights.returning}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>New: {customerInsights.newCustomers}</Text>
                        </View>
                    </View>
                </View>

                {/* 5. Peak Hours */}
                {renderPeakHoursChart()}

                {/* 6. Booking Source */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Booking Source</Text>
                    <View style={styles.sourceGrid}>
                        <View style={styles.sourceItem}>
                            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="walk" size={24} color="#10B981" />
                            </View>
                            <Text style={[styles.sourceVal, { color: theme.colors.text }]}>{bookingSource.walkIn}</Text>
                            <Text style={styles.sourceLabel}>Walk-ins</Text>
                        </View>
                        <View style={styles.sourceItem}>
                            <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                                <Ionicons name="people" size={24} color="#A855F7" />
                            </View>
                            <Text style={[styles.sourceVal, { color: theme.colors.text }]}>{bookingSource.queue}</Text>
                            <Text style={styles.sourceLabel}>Live Queue</Text>
                        </View>
                        <View style={styles.sourceItem}>
                            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="calendar" size={24} color="#3B82F6" />
                            </View>
                            <Text style={[styles.sourceVal, { color: theme.colors.text }]}>{bookingSource.appointment}</Text>
                            <Text style={styles.sourceLabel}>Appointments</Text>
                        </View>
                    </View>
                </View>

                {/* 7. Rating Summary */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                    <View style={[styles.rowBetween, { alignItems: 'flex-start' }]}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Shop Rating</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                <Text style={[styles.bigRating, { color: theme.colors.text }]}>{ratingSummary.average}</Text>
                                <View style={{ marginLeft: 12 }}>
                                    <View style={{ flexDirection: 'row' }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Ionicons key={s} name="star" size={16} color={s <= Math.round(ratingSummary.average) ? "#FFC107" : "#E5E7EB"} />
                                        ))}
                                    </View>
                                    <Text style={styles.totalReviewsText}>From {ratingSummary.total} reviews</Text>
                                </View>
                            </View>
                        </View>
                        {ratingSummary.recent.length > 0 && (
                            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('AllReviews', { salon })}>
                                <Text style={styles.viewAllText}>View All</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Recent Reviews Preview */}
                    {ratingSummary.recent.length > 0 && (
                        <View style={styles.recentReviewsList}>
                            {ratingSummary.recent.slice(0, 2).map((r, idx) => (
                                <View key={r.id} style={[styles.reviewPreview, idx > 0 && { borderTopWidth: 1, borderColor: isDarkMode ? '#333' : '#F3F4F6' }]}>
                                    <Text style={[styles.reviewUser, { color: theme.colors.textSecondary }]} numberOfLines={1}>{r.userName}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="star" size={10} color="#FFC107" />
                                        <Text style={[styles.reviewRatingText, { color: theme.colors.text }]}>{r.rating}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* 8. Top Services */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Top Services by Revenue</Text>
                    {servicesSummary.top.map((s, idx) => (
                        <View key={idx} style={[styles.serviceRow, idx > 0 && { borderTopWidth: 1, borderColor: isDarkMode ? '#333' : '#F3F4F6', paddingTop: 12 }]}>
                            <View style={styles.serviceRank}>
                                <Text style={styles.rankText}>{idx + 1}</Text>
                            </View>
                            <View style={styles.serviceInfo}>
                                <Text style={[styles.serviceName, { color: theme.colors.text }]} numberOfLines={1}>{s.name}</Text>
                                <Text style={styles.serviceCount}>{s.count} times performed</Text>
                            </View>
                            <Text style={[styles.serviceRevenue, { color: theme.colors.text }]}>₹{s.revenue}</Text>
                        </View>
                    ))}
                    {servicesSummary.top.length === 0 && <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginVertical: 10 }}>No service data available yet.</Text>}
                </View>

                {/* 9. Lost Customers */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text, marginLeft: 16 }]}>At Risk / Lost Customers</Text>
                    <Text style={[styles.subText, { marginLeft: 16, marginTop: -8, marginBottom: 12 }]}>Not visited in 30+ days. Follow up!</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, paddingBottom: 20 }}>
                    {lostCustomers.length > 0 ? lostCustomers.map((user) => (
                        <View key={user.id} style={[styles.lostCard, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                            <Image source={{ uri: user.photo || `https://ui-avatars.com/api/?name=${user.name}` }} style={styles.lostAvatar} />
                            <Text style={[styles.lostName, { color: theme.colors.text }]} numberOfLines={1}>{user.name}</Text>
                            <Text style={styles.lostSpent}>Lifetime: ₹{user.totalSpent}</Text>
                            <Text style={styles.lostDate}>Last: {new Date(user.lastVisit).toLocaleDateString()}</Text>

                            {user.phone && (
                                <TouchableOpacity
                                    style={styles.callBtn}
                                    onPress={() => Linking.openURL(`tel:${user.phone}`)}
                                >
                                    <Ionicons name="call" size={14} color="#FFF" />
                                    <Text style={styles.callText}>Follow Up</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )) : (
                        <View style={[styles.noLostCard, { borderColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                            <Ionicons name="happy-outline" size={32} color="#10B981" />
                            <Text style={{ color: theme.colors.textSecondary, marginTop: 10, textAlign: 'center' }}>Great job! No heavy-spending customers{"\n"}have abandoned you recently.</Text>
                        </View>
                    )}
                </ScrollView>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    filterContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        margin: 16,
        borderWidth: 1,
    },
    filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeFilterBtn: { backgroundColor: '#1A1F2B' },
    filterText: { color: '#666', fontWeight: 'bold', fontSize: 13 },
    activeFilterText: { color: '#FFF' },

    heroGrid: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
    heroCard: { borderRadius: 20, padding: 20, justifyContent: 'center' },
    mainHeroCard: { flex: 1.5, backgroundColor: '#1C2237', marginRight: 12 },
    mainHeroLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
    mainHeroValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
    growthBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76, 175, 80, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    growthText: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    heroSideCol: { flex: 1, justifyContent: 'space-between' },
    heroCardSmall: { flex: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', ...getShadow() },
    smallHeroVal: { fontSize: 18, fontWeight: 'bold' },
    smallHeroLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

    threeColGrid: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10 },
    miniCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', ...getShadow() },
    miniLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
    miniValue: { fontSize: 16, fontWeight: 'bold' },

    card: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, ...getShadow() },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    chartContainer: { flexDirection: 'row', height: 160, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 10 },
    barCol: { alignItems: 'center', flex: 1 },
    barTrack: { width: 12, height: 120, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6, justifyContent: 'flex-end' },
    barFill: { width: 12, backgroundColor: '#7C4DFF', borderRadius: 6 },
    barLabel: { fontSize: 11, marginTop: 8 },

    subText: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
    progressTrack: { height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 5, flexDirection: 'row', overflow: 'hidden', marginBottom: 12 },
    progressFill: { height: 10 },
    legendRow: { flexDirection: 'row', marginTop: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    legendText: { fontSize: 12 },

    sourceGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    sourceItem: { alignItems: 'center', flex: 1 },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    sourceVal: { fontSize: 18, fontWeight: 'bold' },
    sourceLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

    bigRating: { fontSize: 48, fontWeight: 'bold' },
    totalReviewsText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    viewAllBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    viewAllText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
    recentReviewsList: { marginTop: 16 },
    reviewPreview: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    reviewUser: { fontSize: 13, flex: 1, marginRight: 10 },
    reviewRatingText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

    serviceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    serviceRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    rankText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
    serviceInfo: { flex: 1 },
    serviceName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    serviceCount: { fontSize: 11, color: '#9CA3AF' },
    serviceRevenue: { fontSize: 15, fontWeight: 'bold' },

    busiestBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    busiestText: { color: '#B45309', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },

    lostCard: { width: 140, padding: 12, borderRadius: 16, marginRight: 12, alignItems: 'center', borderWidth: 1, ...getShadow() },
    lostAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 8 },
    lostName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    lostSpent: { fontSize: 11, color: '#4CAF50', fontWeight: 'bold', marginBottom: 2 },
    lostDate: { fontSize: 10, color: '#9CA3AF', marginBottom: 12 },
    callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, width: '100%', justifyContent: 'center' },
    callText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
    noLostCard: { width: 280, padding: 20, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
});

function getShadow() {
    return {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5
    };
}

export default AnalyticsScreen;
