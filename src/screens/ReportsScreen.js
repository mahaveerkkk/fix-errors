import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    SafeAreaView,
    StatusBar
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';

const { width } = Dimensions.get('window');

import { getAnalytics } from '../services/api';

const ReportsScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};
    const [timeRange, setTimeRange] = useState('Weekly'); // Weekly, Monthly, Yearly
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        stats: { revenue: 0, bookings: 0, growth: '0%' },
        chartData: [],
        topServices: []
    });

    useEffect(() => {
        if (salon) {
            fetchAnalytics();
        }
    }, [salon, timeRange]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const result = await getAnalytics(salon._id, timeRange);
            // Map backend response structure to local state structure
            setData({
                stats: {
                    revenue: result.heroStats?.revenue || 0,
                    bookings: result.heroStats?.bookings || 0,
                    growth: result.heroStats?.growth || '0%',
                },
                chartData: result.chartData || [],
                topServices: result.servicesSummary?.top || [],
            });
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const renderBarChart = () => {
        if (loading) return <Text style={{ color: theme.colors.textSecondary }}>Loading chart...</Text>;

        // Find max value to scale chart bars
        const maxVal = Math.max(...data.chartData.map(d => d.value), 1); // Avoid div by 0

        return (
            <View style={styles.chartContainer}>
                {data.chartData.map((item, index) => (
                    <View key={index} style={styles.barGroup}>
                        <View style={[
                            styles.bar,
                            {
                                height: (item.value / maxVal) * 100, // Scale to 100px max height
                                backgroundColor: item.value > 0 ? theme.colors.primary : (isDarkMode ? '#333' : '#E0E0E0')
                            }
                        ]} />
                        <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const styles = getStyles(theme, isDarkMode);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <Header title="Analytics" showBack />

            <ScrollView style={styles.content}>
                {/* Time Range Filter */}
                <View style={styles.filterContainer}>
                    {['Weekly', 'Monthly', 'Yearly'].map(range => (
                        <TouchableOpacity
                            key={range}
                            style={[styles.filterBtn, timeRange === range && styles.activeFilterBtn]}
                            onPress={() => setTimeRange(range)}
                        >
                            <Text style={[styles.filterText, timeRange === range && styles.activeFilterText]}>{range}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Key Stats Grid */}
                <View style={styles.statsGrid}>
                    <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.colors.surface }]} activeOpacity={0.9}>
                        <Text style={styles.statLabel}>Total Revenue</Text>
                        <Text style={styles.statValue}>₹{data.stats.revenue}</Text>
                        <Text style={[styles.statGrowth, { color: data.stats.growth?.includes('-') ? theme.colors.error : theme.colors.success }]}>
                            {data.stats.growth && !data.stats.growth.includes('-') ? '+' : ''}{data.stats.growth}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.statCard, { backgroundColor: theme.colors.surface }]} activeOpacity={0.9}>
                        <Text style={styles.statLabel}>Bookings</Text>
                        <Text style={styles.statValue}>{data.stats.bookings}</Text>
                    </TouchableOpacity>
                </View>

                {/* Revenue Chart */}
                <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={styles.cardTitle}>Revenue Trend</Text>
                    {renderBarChart()}
                </View>

                {/* Top Services */}
                <View style={[styles.listCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={styles.cardTitle}>Top Performing Services</Text>
                    {data.topServices.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginVertical: 20 }}>No data available</Text>
                    ) : (
                        data.topServices.map((service, index) => (
                            <View key={index} style={[styles.listItem, { borderBottomColor: theme.colors.divider }]}>
                                <View style={[styles.rankBadge, { backgroundColor: isDarkMode ? '#333' : '#F5F5F5' }]}>
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.serviceName}>{service.name}</Text>
                                    <Text style={styles.serviceCount}>{service.count} bookings</Text>
                                </View>
                                <Text style={styles.serviceRevenue}>₹{service.revenue}</Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = (theme, isDarkMode) => StyleSheet.create({
    content: {
        padding: 16,
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeFilterBtn: {
        backgroundColor: isDarkMode ? '#333' : '#1C2237', // Custom active state for clarity
    },
    filterText: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeFilterText: {
        color: '#FFF',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statCard: {
        width: '48%',
        padding: 16,
        borderRadius: 12,
        // Elevation/Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statGrowth: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: 'bold',
    },
    chartCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
    },
    chartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 150,
        paddingBottom: 8,
    },
    barGroup: {
        alignItems: 'center',
    },
    bar: {
        width: 20,
        borderRadius: 4,
        marginBottom: 8,
    },
    barLabel: {
        fontSize: 12,
    },
    listCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    serviceCount: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    serviceRevenue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.primary,
    }
});

export default ReportsScreen;
