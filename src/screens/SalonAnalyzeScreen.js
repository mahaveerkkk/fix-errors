import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Image, ActivityIndicator, RefreshControl, TextInput, StatusBar,
    ScrollView, Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getSalonCustomersCRM } from '../services/api';
import CustomerProfileSheet from '../components/salon/CustomerProfileSheet';

const FILTERS = [
    { key: 'all', label: 'All', icon: 'people', color: '#7C4DFF' },
    { key: 'vip', label: 'VIP 👑', icon: 'star', color: '#F59E0B' },
    { key: 'regular', label: 'Regular', icon: 'sync', color: '#22C55E' },
    { key: 'new', label: 'New 🆕', icon: 'person-add', color: '#3B82F6' },
    { key: 'one_time', label: 'One-Time', icon: 'finger-print', color: '#8B5CF6' },
    { key: 'at_risk', label: 'At Risk ⚠️', icon: 'warning', color: '#F59E0B' },
    { key: 'lost', label: 'Lost 🔴', icon: 'close-circle', color: '#EF4444' },
    { key: 'gained', label: 'Gained ✅', icon: 'trending-up', color: '#10B981' },
    { key: 'lost_to_others', label: 'Left 🚶', icon: 'trending-down', color: '#F97316' },
    { key: 'birthdays', label: 'Birthday 🎂', icon: 'gift', color: '#EC4899' },
    { key: 'top_spenders', label: 'Top 💎', icon: 'diamond', color: '#06B6D4' },
    { key: 'viewers', label: 'Viewers 👀', icon: 'eye', color: '#6366F1' },
];

const SalonAnalyzeScreen = ({ route, navigation }) => {
    const { salonId, salon } = route.params || {};

    const [activeFilter, setActiveFilter] = useState('all');
    const [customers, setCustomers] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const fetchCustomers = useCallback(async (filter = activeFilter) => {
        try {
            const data = await getSalonCustomersCRM(salonId, filter);
            setCustomers(data.customers || []);
            setSummary(data.summary || null);
        } catch (e) {
            console.log('CRM fetch error:', e);
            setCustomers([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [salonId, activeFilter]);

    useEffect(() => {
        if (salonId) {
            setLoading(true);
            fetchCustomers(activeFilter);
        }
    }, [activeFilter, salonId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchCustomers(activeFilter);
    };

    const handleFilterChange = (key) => {
        setActiveFilter(key);
        setSearchText('');
    };

    const openProfile = (customer) => {
        setSelectedCustomer(customer);
        setSheetVisible(true);
    };

    const getDaysSince = (dateStr) => {
        if (!dateStr) return null;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const getTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const days = getDaysSince(dateStr);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
    };

    const getLoyaltyInfo = (item) => {
        const days = getDaysSince(item.lastVisitDate);
        const visits = item.totalVisits || 0;
        const spend = item.lifetimeSpend || 0;

        // For viewers filter
        if (activeFilter === 'viewers') {
            if (item.didBook) return { label: '✅ Booked', color: '#22C55E', bg: '#F0FDF4' };
            return { label: '👀 Viewed Only', color: '#6366F1', bg: '#EEF2FF' };
        }

        if (visits >= 10 || spend >= 5000) return { label: '👑 VIP', color: '#F59E0B', bg: '#FFFBEB' };
        if (visits >= 3 && days < 30) return { label: '🟢 Regular', color: '#22C55E', bg: '#F0FDF4' };
        if (days > 60) return { label: '🔴 Lost', color: '#EF4444', bg: '#FEF2F2' };
        if (days > 30) return { label: '⚠️ At Risk', color: '#F59E0B', bg: '#FFFBEB' };
        if (visits === 1) return { label: '☝️ One-Time', color: '#8B5CF6', bg: '#F5F3FF' };
        return { label: '🔵 Active', color: '#3B82F6', bg: '#EFF6FF' };
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        c.phone?.includes(searchText)
    );

    // ====== RENDER: Salon Insights Header ======
    const renderInsights = () => {
        if (!summary) return null;
        return (
            <View style={s.insightsContainer}>
                {/* Top Row: Key metrics */}
                <View style={s.insightsRow}>
                    <View style={[s.insightCard, { backgroundColor: '#EEF2FF', borderColor: '#7C4DFF22' }]}>
                        <Text style={[s.insightValue, { color: '#7C4DFF' }]}>{summary.totalCustomers || 0}</Text>
                        <Text style={s.insightLabel}>Total</Text>
                    </View>
                    <View style={[s.insightCard, { backgroundColor: '#FFFBEB', borderColor: '#F59E0B22' }]}>
                        <Text style={[s.insightValue, { color: '#F59E0B' }]}>{summary.atRiskCount || 0}</Text>
                        <Text style={s.insightLabel}>At Risk</Text>
                    </View>
                    <View style={[s.insightCard, { backgroundColor: '#FEF2F2', borderColor: '#EF444422' }]}>
                        <Text style={[s.insightValue, { color: '#EF4444' }]}>{summary.lostCount || 0}</Text>
                        <Text style={s.insightLabel}>Lost</Text>
                    </View>
                    <View style={[s.insightCard, { backgroundColor: '#FDF2F8', borderColor: '#EC489922' }]}>
                        <Text style={[s.insightValue, { color: '#EC4899' }]}>{summary.birthdayCount || 0}</Text>
                        <Text style={s.insightLabel}>🎂</Text>
                    </View>
                </View>

                {/* Salon View Stats */}
                {(summary.totalViews > 0 || summary.uniqueViewers > 0) && (
                    <View style={s.viewStatsBar}>
                        <Ionicons name="eye-outline" size={16} color="#6366F1" />
                        <Text style={s.viewStatsText}>
                            <Text style={{ fontWeight: '800', color: '#6366F1' }}>{summary.totalViews || 0}</Text> views
                            {' · '}
                            <Text style={{ fontWeight: '800', color: '#6366F1' }}>{summary.uniqueViewers || 0}</Text> unique
                            {summary.viewersNotBooked > 0 && (
                                <Text>
                                    {' · '}
                                    <Text style={{ fontWeight: '800', color: '#EF4444' }}>{summary.viewersNotBooked}</Text> didn't book
                                </Text>
                            )}
                        </Text>
                    </View>
                )}

                {/* Quick Segment Row */}
                <View style={s.segmentRow}>
                    <View style={s.segmentItem}>
                        <Text style={[s.segmentValue, { color: '#F59E0B' }]}>{summary.vipCount || 0}</Text>
                        <Text style={s.segmentLabel}>👑 VIP</Text>
                    </View>
                    <View style={s.segmentDivider} />
                    <View style={s.segmentItem}>
                        <Text style={[s.segmentValue, { color: '#22C55E' }]}>{summary.regularCount || 0}</Text>
                        <Text style={s.segmentLabel}>🟢 Regular</Text>
                    </View>
                    <View style={s.segmentDivider} />
                    <View style={s.segmentItem}>
                        <Text style={[s.segmentValue, { color: '#3B82F6' }]}>{summary.newCount || 0}</Text>
                        <Text style={s.segmentLabel}>🆕 New</Text>
                    </View>
                    <View style={s.segmentDivider} />
                    <View style={s.segmentItem}>
                        <Text style={[s.segmentValue, { color: '#8B5CF6' }]}>{summary.oneTimeCount || 0}</Text>
                        <Text style={s.segmentLabel}>☝️ Once</Text>
                    </View>
                </View>
            </View>
        );
    };

    // ====== RENDER: Customer Card ======
    const renderCustomerCard = ({ item }) => {
        const days = getDaysSince(item.lastVisitDate);
        const loyalty = getLoyaltyInfo(item);
        const avatar = item.profilePhoto ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'U')}&background=7C4DFF&color=fff&bold=true&size=80`;

        const isBirthday = activeFilter === 'birthdays' && item.dob;
        const dobDate = item.dob ? new Date(item.dob) : null;
        const isViewer = activeFilter === 'viewers';

        return (
            <TouchableOpacity style={s.card} onPress={() => openProfile(item)} activeOpacity={0.85}>
                <Image source={{ uri: avatar }} style={s.avatar} />
                <View style={s.cardInfo}>
                    <View style={s.cardTopRow}>
                        <Text style={s.customerName} numberOfLines={1}>{item.name || 'Customer'}</Text>
                        <View style={[s.loyaltyBadge, { backgroundColor: loyalty.bg }]}>
                            <Text style={[s.loyaltyText, { color: loyalty.color }]}>{loyalty.label}</Text>
                        </View>
                    </View>
                    {item.phone && (
                        <Text style={s.phone}>📞 {item.phone}</Text>
                    )}
                    <View style={s.cardStatsRow}>
                        {!isViewer ? (
                            <>
                                <View style={s.statChip}>
                                    <Ionicons name="calendar-outline" size={11} color="#7C4DFF" />
                                    <Text style={s.statChipText}>{item.totalVisits || 0} visits</Text>
                                </View>
                                <View style={s.statChip}>
                                    <Ionicons name="cash-outline" size={11} color="#22C55E" />
                                    <Text style={s.statChipText}>₹{(item.lifetimeSpend || 0).toLocaleString()}</Text>
                                </View>
                                {days !== null && (
                                    <View style={[s.statChip, days > 30 ? s.chipWarning : {}]}>
                                        <Ionicons name="time-outline" size={11} color={days > 30 ? '#F59E0B' : '#64748B'} />
                                        <Text style={[s.statChipText, days > 30 ? { color: '#F59E0B' } : {}]}>{getTimeAgo(item.lastVisitDate)}</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                <View style={s.statChip}>
                                    <Ionicons name="eye-outline" size={11} color="#6366F1" />
                                    <Text style={s.statChipText}>{item.viewCount || 1}x viewed</Text>
                                </View>
                                <View style={s.statChip}>
                                    <Ionicons name="time-outline" size={11} color="#64748B" />
                                    <Text style={s.statChipText}>{getTimeAgo(item.lastViewed)}</Text>
                                </View>
                            </>
                        )}
                    </View>
                    {isBirthday && dobDate && (
                        <View style={s.birthdayTag}>
                            <Text style={s.birthdayTagText}>🎂 {dobDate.getDate()} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dobDate.getMonth()]}</Text>
                        </View>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
        );
    };

    // ====== RENDER: Empty State ======
    const getEmptyState = () => {
        const states = {
            all: { emoji: '👥', title: 'No Customers Yet', sub: 'Customers will appear after their first booking' },
            vip: { emoji: '👑', title: 'No VIP Customers', sub: '10+ visits or ₹5000+ spend = VIP status' },
            regular: { emoji: '🟢', title: 'No Regulars', sub: 'Customers with 3+ visits in the last 30 days' },
            new: { emoji: '🆕', title: 'No New Customers', sub: 'First-time visitors from the last 30 days' },
            one_time: { emoji: '☝️', title: 'No One-Timers', sub: 'Great! All your customers came back' },
            at_risk: { emoji: '⚠️', title: 'No At-Risk Customers', sub: 'Great! Everyone visited within 30 days' },
            lost: { emoji: '🔴', title: 'No Lost Customers', sub: 'Awesome! Nobody has been gone 45+ days' },
            birthdays: { emoji: '🎂', title: 'No Birthdays', sub: 'No customer birthdays this month' },
            top_spenders: { emoji: '💎', title: 'No Spenders Yet', sub: 'Top paying customers will show here' },
            viewers: { emoji: '👀', title: 'No Viewers Yet', sub: 'People who view your salon profile will appear here' },
        };
        return states[activeFilter] || states.all;
    };

    return (
        <View style={s.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Customer CRM</Text>
                    <Text style={s.headerSub}>Analyze · Segment · Retain</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
                    <Ionicons name="refresh" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredCustomers}
                keyExtractor={(item, index) => item._id?.toString() || index.toString()}
                renderItem={renderCustomerCard}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C4DFF']} />}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                ListHeaderComponent={
                    <View>
                        {/* Insights Dashboard */}
                        {renderInsights()}

                        {/* Filter Chips — Horizontal Scroll */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.filterScroll}
                            style={{ marginBottom: 12 }}
                        >
                            {FILTERS.map(f => {
                                const isActive = activeFilter === f.key;
                                const count = summary ? (
                                    f.key === 'all' ? summary.totalCustomers :
                                    f.key === 'vip' ? summary.vipCount :
                                    f.key === 'regular' ? summary.regularCount :
                                    f.key === 'new' ? summary.newCount :
                                    f.key === 'one_time' ? summary.oneTimeCount :
                                    f.key === 'at_risk' ? summary.atRiskCount :
                                    f.key === 'lost' ? summary.lostCount :
                                    f.key === 'birthdays' ? summary.birthdayCount :
                                    f.key === 'viewers' ? (summary.uniqueViewers || 0) :
                                    null
                                ) : null;

                                return (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={[s.filterChip, isActive && { backgroundColor: f.color, borderColor: f.color }]}
                                        onPress={() => handleFilterChange(f.key)}
                                    >
                                        <Ionicons name={f.icon} size={13} color={isActive ? '#FFF' : f.color} />
                                        <Text style={[s.filterChipText, isActive ? { color: '#FFF' } : { color: f.color }]}>
                                            {f.label}
                                        </Text>
                                        {count !== null && count !== undefined && (
                                            <View style={[s.filterCount, isActive && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                                <Text style={[s.filterCountText, isActive && { color: '#FFF' }]}>{count}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Search */}
                        <View style={s.searchBar}>
                            <Ionicons name="search-outline" size={16} color="#94A3B8" />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Search by name or phone..."
                                placeholderTextColor="#94A3B8"
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                            {searchText.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchText('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Result Count */}
                        <View style={s.resultBar}>
                            <Text style={s.resultText}>
                                {loading ? 'Loading...' : `${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? 's' : ''}`}
                            </Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={s.centerBox}>
                            <ActivityIndicator size="large" color="#7C4DFF" />
                            <Text style={s.loadingText}>Analyzing customers...</Text>
                        </View>
                    ) : (
                        <View style={s.centerBox}>
                            <Text style={{ fontSize: 48 }}>{getEmptyState().emoji}</Text>
                            <Text style={s.emptyTitle}>{getEmptyState().title}</Text>
                            <Text style={s.emptySubtitle}>{getEmptyState().sub}</Text>
                        </View>
                    )
                }
            />

            {/* Customer Profile Bottom Sheet */}
            {selectedCustomer && (
                <CustomerProfileSheet
                    visible={sheetVisible}
                    onClose={() => { setSheetVisible(false); setSelectedCustomer(null); }}
                    salonId={salonId}
                    userId={selectedCustomer._id}
                    customerImage={selectedCustomer.profilePhoto}
                    customerName={selectedCustomer.name}
                />
            )}
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F2F8' },

    // Header — Dark Gradient Feel
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 48 : 24, paddingBottom: 18,
        backgroundColor: '#1E1B4B', gap: 14,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        elevation: 8, shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3, shadowRadius: 12,
    },
    backBtn: { padding: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
    headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontWeight: '500', letterSpacing: 0.5 },
    refreshBtn: { padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },

    // Insights Dashboard
    insightsContainer: { marginTop: 18, marginBottom: 14 },
    insightsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    insightCard: {
        flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center',
        borderWidth: 0, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 8,
    },
    insightValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    insightLabel: { fontSize: 10, color: '#64748B', marginTop: 3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

    // View Stats Bar
    viewStatsBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginBottom: 12, gap: 10,
        elevation: 3, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 6, borderLeftWidth: 3, borderLeftColor: '#6366F1',
    },
    viewStatsText: { fontSize: 12, color: '#475569', flex: 1 },

    // Segment Row
    segmentRow: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20,
        padding: 14, alignItems: 'center', elevation: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8,
    },
    segmentItem: { flex: 1, alignItems: 'center' },
    segmentValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
    segmentLabel: { fontSize: 10, color: '#64748B', marginTop: 3, fontWeight: '600' },
    segmentDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0', borderRadius: 1 },

    // Filter Chips
    filterScroll: { paddingVertical: 6, gap: 8 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 24, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF',
        gap: 6, marginRight: 8, elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    },
    filterChipText: { fontSize: 12, fontWeight: '700' },
    filterCount: {
        backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2,
        marginLeft: 3,
    },
    filterCountText: { fontSize: 10, fontWeight: '800', color: '#64748B' },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
        marginBottom: 10, gap: 10, elevation: 3, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#1E293B', padding: 0, fontWeight: '500' },

    // Result Bar
    resultBar: { marginBottom: 10, paddingHorizontal: 4 },
    resultText: { fontSize: 13, color: '#7C4DFF', fontWeight: '700' },

    // Customer Card
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        borderRadius: 20, padding: 16, gap: 14, elevation: 4,
        shadowColor: '#7C4DFF', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08, shadowRadius: 10,
    },
    avatar: {
        width: 54, height: 54, borderRadius: 27, backgroundColor: '#EEF2FF',
        borderWidth: 2.5, borderColor: '#E0E7FF',
    },
    cardInfo: { flex: 1 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    customerName: { fontSize: 15, fontWeight: '800', color: '#1E293B', flex: 1 },
    loyaltyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 6 },
    loyaltyText: { fontSize: 10, fontWeight: '800' },
    phone: { fontSize: 12, color: '#64748B', marginBottom: 7 },
    cardStatsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    statChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9',
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, gap: 4,
    },
    statChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    chipWarning: { backgroundColor: '#FFFBEB' },
    birthdayTag: {
        backgroundColor: '#FDF2F8', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 10, marginTop: 7, alignSelf: 'flex-start',
    },
    birthdayTagText: { fontSize: 11, color: '#EC4899', fontWeight: '800' },

    // Empty / Loading
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 },
    loadingText: { marginTop: 14, color: '#7C4DFF', fontSize: 14, fontWeight: '600' },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginTop: 14, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 22 },
});

export default SalonAnalyzeScreen;
