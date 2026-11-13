import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, Dimensions, RefreshControl, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import ScratchCardModal from '../components/common/ScratchCardModal';
import { getWallet, scratchCard } from '../services/api';

const { width } = Dimensions.get('window');

const WalletScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { user } = route.params || {};

    const [balance, setBalance] = useState(0);
    const [cashback, setCashback] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [unscratchedCards, setUnscratchedCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Scratch Card Modal
    const [scratchModalVisible, setScratchModalVisible] = useState(false);
    const [activeScratchCard, setActiveScratchCard] = useState(null);

    const userId = user?._id || user?.id;

    const fetchWallet = async () => {
        if (!userId) return;
        try {
            const data = await getWallet(userId);
            setBalance(data.balance || 0);
            setCashback(data.totalCashbackEarned || 0);
            setTransactions(data.transactions || []);
            setUnscratchedCards(data.unscratchedCards || []);
        } catch (error) {
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch on screen focus
    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchWallet();
        }, [userId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchWallet();
    };

    const handleOpenScratchCard = (card) => {
        setActiveScratchCard(card);
        setScratchModalVisible(true);
    };

    const handleScratch = async (card) => {
        if (!userId || !card?._id) return;
        try {
            const result = await scratchCard(userId, card._id);
            // Update wallet data
            setBalance(result.newBalance || balance + card.amount);
            setCashback(result.totalCashbackEarned || cashback + card.amount);
            // Remove from unscratched list
            setUnscratchedCards(prev => prev.filter(c => c._id !== card._id));
        } catch (error) {
        }
    };

    const handleScratchClose = () => {
        setScratchModalVisible(false);
        setActiveScratchCard(null);
        // Refresh wallet after scratching
        fetchWallet();
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'cashback_first': return { name: 'star', color: '#FFD700' };
            case 'cashback_regular': return { name: 'gift', color: '#4CAF50' };
            case 'referral': return { name: 'people', color: '#9C27B0' };
            case 'debit': return { name: 'arrow-up', color: '#EF4444' };
            default: return { name: 'arrow-down', color: '#4CAF50' };
        }
    };

    const renderTransaction = ({ item }) => {
        const icon = getTransactionIcon(item.type);
        const isCredit = item.type !== 'debit';
        return (
            <View style={[styles.txnCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.txnIcon, { backgroundColor: icon.color + '18' }]}>
                    <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.txnTitle, { color: theme.colors.text }]}>{item.description || 'Cashback Reward'}</Text>
                    <Text style={[styles.txnDate, { color: theme.colors.textLight }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: isCredit ? '#4CAF50' : '#EF4444' }]}>
                    {isCredit ? '+' : '-'}₹{item.amount}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <Header title="Wallet" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <Header title="Wallet" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
            >

                {/* Wallet Balance Card */}
                <LinearGradient
                    colors={['#F59E0B', '#E88D00', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.balanceCard}
                >
                    <View style={styles.balanceHeader}>
                        <View>
                            <Text style={styles.balanceLabel}>Total Balance</Text>
                            <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
                        </View>
                        <View style={styles.walletIconCircle}>
                            <Ionicons name="wallet" size={28} color="#FFF" />
                        </View>
                    </View>

                    <View style={styles.balanceDivider} />

                    <View style={styles.balanceFooter}>
                        <View style={styles.cashbackBox}>
                            <Ionicons name="gift" size={16} color="#FFF" />
                            <Text style={styles.cashbackLabel}>Cashback Earned</Text>
                        </View>
                        <Text style={styles.cashbackAmount}>₹{cashback.toFixed(2)}</Text>
                    </View>
                </LinearGradient>

                {/* Unscratched Scratch Cards */}
                {unscratchedCards.length > 0 && (
                    <>
                        <View style={styles.scratchHeader}>
                            <Ionicons name="gift" size={20} color="#FFD700" />
                            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0, marginLeft: 8 }]}>
                                Scratch Cards ({unscratchedCards.length})
                            </Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scratchScroll}>
                            {unscratchedCards.map((card) => (
                                <TouchableOpacity
                                    key={card._id}
                                    activeOpacity={0.85}
                                    onPress={() => handleOpenScratchCard(card)}
                                >
                                    <LinearGradient
                                        colors={['#1a1a2e', '#16213e', '#0f3460']}
                                        style={styles.scratchCardMini}
                                    >
                                        <View style={styles.scratchGoldStrip}>
                                            <LinearGradient
                                                colors={['#C9A961', '#E8D5A3', '#C9A961']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.goldStripGradient}
                                            >
                                                <Ionicons name="finger-print" size={18} color="rgba(255,255,255,0.7)" />
                                                <Text style={styles.scratchMiniText}>SCRATCH</Text>
                                            </LinearGradient>
                                        </View>
                                        <View style={styles.scratchCardBottom}>
                                            <Ionicons name="gift" size={16} color="#FFD700" />
                                            <Text style={styles.scratchCardLabel}>Tap to Reveal</Text>
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                )}

                {/* Quick Actions */}
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    {[
                        { id: '1', label: 'Cashback', icon: 'gift-outline', color: '#9C27B0' },
                        { id: '2', label: 'History', icon: 'time-outline', color: '#2196F3' },
                        { id: '3', label: 'Rewards', icon: 'trophy-outline', color: '#FF9800' },
                        { id: '4', label: 'Refer', icon: 'people-outline', color: '#4CAF50' },
                    ].map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={[styles.actionItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                                <Ionicons name={action.icon} size={24} color={action.color} />
                            </View>
                            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Offers Section */}
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Offers & Rewards</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offersScroll}>
                    {[
                        { id: '1', title: 'Booking Cashback', desc: 'Earn cashback on every booking! Scratch to reveal.', color: '#4CAF50', icon: 'flash-outline' },
                        { id: '2', title: 'Scratch & Win', desc: 'Complete bookings & win exciting cashback rewards!', color: '#FF9800', icon: 'star-outline' },
                        { id: '3', title: 'Refer & Earn', desc: 'Coming soon! Invite friends & earn', color: '#9C27B0', icon: 'people-outline' },
                    ].map((offer) => (
                        <TouchableOpacity key={offer.id} activeOpacity={0.8}>
                            <LinearGradient
                                colors={[offer.color, offer.color + 'DD']}
                                style={styles.offerCard}
                            >
                                <View style={styles.offerIconCircle}>
                                    <Ionicons name={offer.icon} size={22} color="#FFF" />
                                </View>
                                <Text style={styles.offerTitle}>{offer.title}</Text>
                                <Text style={styles.offerDesc}>{offer.desc}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Recent Transactions */}
                <View style={styles.txnHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                        Recent Transactions
                    </Text>
                </View>

                {transactions.length === 0 ? (
                    <View style={[styles.emptyTxn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5' }]}>
                            <Ionicons name="receipt-outline" size={40} color={theme.colors.textLight} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No transactions yet</Text>
                        <Text style={[styles.emptySubtext, { color: theme.colors.textLight }]}>
                            Complete a booking to earn your first scratch card! 🎉
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={transactions}
                        renderItem={renderTransaction}
                        keyExtractor={(item, index) => item._id || index.toString()}
                        scrollEnabled={false}
                        style={{ marginTop: 12 }}
                    />
                )}

                {/* Info Banner */}
                <View style={[styles.infoBanner, { backgroundColor: isDarkMode ? '#1E3A5F' : '#EBF5FF', borderColor: isDarkMode ? '#2563EB' : '#93C5FD' }]}>
                    <Ionicons name="information-circle" size={20} color="#2563EB" />
                    <Text style={[styles.infoText, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
                        Earn cashback on every completed booking! Scratch your reward card to reveal the surprise amount.
                    </Text>
                </View>

            </ScrollView>

            {/* Scratch Card Modal */}
            <ScratchCardModal
                visible={scratchModalVisible}
                card={activeScratchCard}
                onScratch={handleScratch}
                onClose={handleScratchClose}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    balanceCard: {
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        elevation: 6,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    balanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: '800',
        marginTop: 4,
    },
    walletIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 16,
    },
    balanceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cashbackBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cashbackLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '500',
    },
    cashbackAmount: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    // Scratch Cards Section
    scratchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    scratchScroll: {
        marginBottom: 24,
    },
    scratchCardMini: {
        width: width * 0.38,
        borderRadius: 16,
        marginRight: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(201,169,97,0.3)',
        elevation: 4,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    scratchGoldStrip: {
        overflow: 'hidden',
    },
    goldStripGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 18,
    },
    scratchMiniText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    scratchCardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
    },
    scratchCardLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '600',
    },
    // Section title
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 14,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    actionItem: {
        width: (width - 56) / 4,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    offersScroll: {
        marginBottom: 24,
    },
    offerCard: {
        width: width * 0.45,
        padding: 18,
        borderRadius: 16,
        marginRight: 12,
    },
    offerIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    offerTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    offerDesc: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        lineHeight: 16,
    },
    txnHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    txnCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    txnIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txnTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    txnDate: {
        fontSize: 11,
        marginTop: 2,
    },
    txnAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptyTxn: {
        alignItems: 'center',
        padding: 30,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    emptyIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
    },
});

export default WalletScreen;
