import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    Animated,
    TextInput,
    Modal,
    Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getWallet, scratchCard, addMoneyCreateOrder, addMoneyVerify, getRazorpayKey, setWalletPin } from '../services/api';
import ScratchCardModal from '../components/common/ScratchCardModal';
import WalletPinModal from '../components/common/WalletPinModal';
import CustomAlert from '../components/common/CustomAlert';
import RazorpayCheckout from 'react-native-razorpay';
import WithdrawalModal from '../components/wallet/WithdrawalModal';

const { width } = Dimensions.get('window');

const UserWalletScreen = ({ route, navigation }) => {
    const { user } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [wallet, setWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [showAddMoney, setShowAddMoney] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [addAmount, setAddAmount] = useState('');
    const [addingMoney, setAddingMoney] = useState(false);

    // Scratch card states
    const [selectedCard, setSelectedCard] = useState(null);
    const [scratchModalVisible, setScratchModalVisible] = useState(false);

    // PIN states
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [pinMode, setPinMode] = useState('set'); // 'set', 'verify'

    // Custom Alert
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
    const showAlert = (title, message, type = 'info', buttons = []) => {
        setAlertConfig({ visible: true, title, message, type, buttons });
    };
    const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const userId = user?._id || user?.id;

    // Indian number format: 5000000 → 50,00,000
    const formatIndianNumber = (num) => {
        if (!num) return '0';
        return num.toLocaleString('en-IN');
    };

    useEffect(() => {
        fetchWallet();
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ]).start();
    }, []);

    const fetchWallet = useCallback(async () => {
        try {
            if (!userId) return;
            const data = await getWallet(userId);
            setWallet(data);
        } catch (error) {
            console.log('Wallet fetch error:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchWallet();
    };

    // ========== ADD MONEY ==========
    const handleAddMoney = async () => {
        const amount = parseInt(addAmount);
        if (!amount || amount < 10) {
            Alert.alert('Invalid Amount', 'Minimum ₹10 add kar sakte ho');
            return;
        }
        if (amount > 10000) {
            Alert.alert('Invalid Amount', 'Maximum ₹10,000 ek baar mein');
            return;
        }

        setAddingMoney(true);
        try {
            // Get Razorpay key
            const razorpayKey = await getRazorpayKey();

            // Create order
            const order = await addMoneyCreateOrder(userId, amount);

            // Open Razorpay
            const options = {
                description: 'Add Money to Wallet',
                image: 'https://ui-avatars.com/api/?name=StyleQ&background=3B82F6&color=fff',
                currency: order.currency,
                key: razorpayKey,
                amount: order.amount,
                order_id: order.id,
                name: 'StyleQ Wallet',
                prefill: {
                    email: user?.email || '',
                    contact: user?.phone || '',
                    name: user?.name || ''
                },
                theme: { color: '#3B82F6' }
            };

            const paymentData = await RazorpayCheckout.open(options);

            // Verify payment
            const result = await addMoneyVerify({
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                userId,
                amount
            });

            if (result.success) {
                showAlert('✅ Success!', `₹${amount} added to your wallet`, 'success', [{text: 'OK', onPress: hideAlert}]);
                setShowAddMoney(false);
                setAddAmount('');
                fetchWallet();
            }
        } catch (error) {
            if (error?.code !== 'PAYMENT_CANCELLED') {
                showAlert('Error', error.message || 'Payment failed', 'error', [{text: 'OK', onPress: hideAlert}]);
            }
        } finally {
            setAddingMoney(false);
        }
    };

    // ========== SCRATCH CARD ==========
    const handleScratchCard = (card) => {
        setSelectedCard(card);
        setScratchModalVisible(true);
    };

    const handleScratchReveal = async () => {
        if (!selectedCard) return;
        try {
            const result = await scratchCard(userId, selectedCard._id);
            fetchWallet();
            return result;
        } catch (error) {
            showAlert('Error', error.message, 'error', [{text: 'OK', onPress: hideAlert}]);
        }
    };

    const getFilteredTransactions = () => {
        if (!wallet?.transactions) return [];
        if (activeFilter === 'all') return wallet.transactions;
        if (activeFilter === 'added') return wallet.transactions.filter(t => ['add_money', 'cashback_first', 'cashback_regular', 'credit', 'referral'].includes(t.type));
        if (activeFilter === 'spent') return wallet.transactions.filter(t => ['qr_payment_sent', 'debit', 'booking_payment'].includes(t.type));
        return wallet.transactions;
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'add_money': return { icon: 'add-circle', color: '#3B82F6' };
            case 'qr_payment_sent': return { icon: 'qr-code', color: '#EF4444' };
            case 'booking_payment': return { icon: 'calendar', color: '#F59E0B' };
            case 'cashback_first': case 'cashback_regular': return { icon: 'gift', color: '#10B981' };
            case 'referral': return { icon: 'people', color: '#8B5CF6' };
            case 'debit': return { icon: 'arrow-up-circle', color: '#EF4444' };
            case 'credit': return { icon: 'arrow-down-circle', color: '#10B981' };
            default: return { icon: 'swap-horizontal', color: '#6B7280' };
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 172800000) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading wallet...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const filteredTransactions = getFilteredTransactions();

    const handleSettingsPress = () => {
        if (!wallet) return;
        if (wallet.hasPin) {
            // Already has PIN, mode can be update (we'll implement change PIN as set for now)
            showAlert(
                'Wallet Security',
                'Your wallet is protected with a PIN.',
                'info',
                [
                    { text: 'Cancel', style: 'cancel', onPress: hideAlert },
                    { 
                        text: 'Change PIN', 
                        onPress: () => {
                            hideAlert();
                            setPinMode('set');
                            setPinModalVisible(true);
                        }
                    }
                ]
            );
        } else {
            setPinMode('set');
            setPinModalVisible(true);
        }
    };

    const handlePinSetupComplete = (pin) => {
        setPinModalVisible(false);
        fetchWallet(); // refresh to get updated hasPin status
        showAlert('Success', 'Wallet PIN set successfully.', 'success', [{text: 'OK', onPress: hideAlert}]);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
            >
                {/* Header with Blue Gradient */}
                <LinearGradient
                    colors={isDarkMode ? ['#1E3A8A', '#1E40AF', '#2563EB'] : ['#1D4ED8', '#3B82F6', '#60A5FA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.headerLabel}>My Wallet</Text>
                                <Text style={styles.headerUserName}>{user?.name || 'User'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity 
                                    style={styles.notifBtn} 
                                    onPress={handleSettingsPress}
                                >
                                    <Ionicons name={wallet?.hasPin ? "lock-closed" : "lock-open"} size={20} color={wallet?.hasPin ? "#FFF" : "#FDE68A"} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.notifBtn}>
                                    <Ionicons name="notifications-outline" size={22} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Balance Card */}
                        <View style={styles.balanceCard}>
                            <View style={styles.balanceTop}>
                                <View>
                                    <Text style={styles.balanceLabel}>Available Balance</Text>
                                    <Text style={styles.balanceAmount}>₹{formatIndianNumber(wallet?.balance)}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addMoneyBtn}
                                    onPress={() => setShowAddMoney(true)}
                                >
                                    <Ionicons name="add" size={18} color="#3B82F6" />
                                    <Text style={styles.addMoneyText}>Add Money</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.balanceStats}>
                                <View style={styles.balanceStat}>
                                    <Ionicons name="trending-up" size={14} color="#A7F3D0" />
                                    <Text style={styles.balanceStatText}>₹{formatIndianNumber(wallet?.totalCashbackEarned)} Cashback</Text>
                                </View>
                                <View style={styles.balanceStat}>
                                    <Ionicons name="gift" size={14} color="#FDE68A" />
                                    <Text style={styles.balanceStatText}>{wallet?.totalUnscratchedCount || 0} Cards</Text>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                </LinearGradient>

                <View style={styles.bodyContent}>
                    {/* Quick Actions */}
                    <Animated.View style={[styles.actionsRow, { opacity: fadeAnim }]}>
                        <TouchableOpacity
                            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
                            onPress={() => navigation.navigate('QRScanner', { user })}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.2)' : '#EFF6FF' }]}>
                                <Ionicons name="scan" size={24} color="#3B82F6" />
                            </View>
                            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Scan & Pay</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowAddMoney(true)}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.2)' : '#ECFDF5' }]}>
                                <Ionicons name="wallet" size={24} color="#10B981" />
                            </View>
                            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Add Money</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowWithdrawModal(true)}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.2)' : '#FEF3C7' }]}>
                                <Ionicons name="cash-outline" size={24} color="#F59E0B" />
                            </View>
                            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Withdraw</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setActiveFilter('all')}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.2)' : '#F5F3FF' }]}>
                                <Ionicons name="receipt" size={24} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>History</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Scan & Pay Banner */}
                    <TouchableOpacity
                        style={styles.scanBanner}
                        onPress={() => navigation.navigate('QRScanner', { user })}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#2563EB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.scanBannerGradient}
                        >
                            <View style={styles.scanBannerLeft}>
                                <View style={styles.scanBannerIcon}>
                                    <Ionicons name="qr-code" size={28} color="#FFF" />
                                </View>
                                <View>
                                    <Text style={styles.scanBannerTitle}>Scan & Pay</Text>
                                    <Text style={styles.scanBannerSubtitle}>Salon ka QR scan karo aur pay karo</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Scratch Cards */}
                    {wallet?.unscratchedCards?.length > 0 && (
                        <View style={[styles.scratchSection, { backgroundColor: theme.colors.surface }]}>
                            <View style={styles.scratchHeader}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                    🎉 Scratch Cards ({wallet.unscratchedCards.length})
                                </Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {wallet.unscratchedCards.map((card, index) => (
                                    <TouchableOpacity
                                        key={card._id || index}
                                        style={styles.scratchCardItem}
                                        onPress={() => handleScratchCard(card)}
                                    >
                                        <LinearGradient
                                            colors={['#F59E0B', '#EF4444']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.scratchCardGradient}
                                        >
                                            <Ionicons name="gift" size={28} color="#FFF" />
                                            <Text style={styles.scratchCardText}>Tap to{'\n'}Scratch</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Transaction History */}
                    <View style={[styles.transactionSection, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Transactions</Text>

                        {/* Filter Tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            {[
                                { key: 'all', label: 'All' },
                                { key: 'added', label: 'Added' },
                                { key: 'spent', label: 'Spent' }
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        activeFilter === f.key && styles.filterChipActive,
                                        activeFilter === f.key && { backgroundColor: '#3B82F6' }
                                    ]}
                                    onPress={() => setActiveFilter(f.key)}
                                >
                                    <Text style={[
                                        styles.filterChipText,
                                        activeFilter === f.key && styles.filterChipTextActive
                                    ]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Transaction List */}
                        {filteredTransactions.length === 0 ? (
                            <View style={styles.emptyTransactions}>
                                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                                    <Ionicons name="receipt-outline" size={36} color="#3B82F6" />
                                </View>
                                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                                    No transactions yet
                                </Text>
                                <Text style={[styles.emptySubtext, { color: theme.colors.textLight }]}>
                                    Add money or complete a booking to get started
                                </Text>
                            </View>
                        ) : (
                            filteredTransactions.map((txn, index) => {
                                const txnIcon = getTransactionIcon(txn.type);
                                const isCredit = ['add_money', 'cashback_first', 'cashback_regular', 'credit', 'referral'].includes(txn.type);
                                return (
                                    <View
                                        key={txn._id || index}
                                        style={[styles.txnRow, index < filteredTransactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }]}
                                    >
                                        <View style={[styles.txnIconCircle, { backgroundColor: txnIcon.color + '15' }]}>
                                            <Ionicons name={txnIcon.icon} size={20} color={txnIcon.color} />
                                        </View>
                                        <View style={styles.txnInfo}>
                                            <Text style={[styles.txnDesc, { color: theme.colors.text }]} numberOfLines={1}>
                                                {txn.description || txn.type}
                                            </Text>
                                            <Text style={[styles.txnDate, { color: theme.colors.textLight }]}>
                                                {formatDate(txn.createdAt)}
                                            </Text>
                                        </View>
                                        <Text style={[styles.txnAmount, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                                            {isCredit ? '+' : '-'}₹{txn.amount}
                                        </Text>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            {/* Add Money Modal */}
            <Modal
                visible={showAddMoney}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddMoney(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Money</Text>
                            <TouchableOpacity onPress={() => setShowAddMoney(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            Minimum ₹10 • Maximum ₹10,000
                        </Text>

                        {/* Amount Input */}
                        <View style={[styles.amountInputContainer, { borderColor: theme.colors.border }]}>
                            <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>₹</Text>
                            <TextInput
                                style={[styles.amountInput, { color: theme.colors.text }]}
                                value={addAmount}
                                onChangeText={setAddAmount}
                                keyboardType="numeric"
                                placeholder="Enter amount"
                                placeholderTextColor={theme.colors.textLight}
                                maxLength={5}
                            />
                        </View>

                        {/* Quick Amount Buttons */}
                        <View style={styles.quickAmounts}>
                            {[50, 100, 200, 500, 1000].map(amt => (
                                <TouchableOpacity
                                    key={amt}
                                    style={[
                                        styles.quickAmountBtn,
                                        addAmount === String(amt) && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
                                        { borderColor: theme.colors.border }
                                    ]}
                                    onPress={() => setAddAmount(String(amt))}
                                >
                                    <Text style={[
                                        styles.quickAmountText,
                                        addAmount === String(amt) && { color: '#FFF' },
                                        { color: theme.colors.text }
                                    ]}>
                                        ₹{amt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Pay Button */}
                        <TouchableOpacity
                            style={[styles.payBtn, addingMoney && { opacity: 0.6 }]}
                            onPress={handleAddMoney}
                            disabled={addingMoney}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#1D4ED8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.payBtnGradient}
                            >
                                {addingMoney ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="card" size={20} color="#FFF" />
                                        <Text style={styles.payBtnText}>
                                            {addAmount ? `Add ₹${addAmount}` : 'Add Money'}
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Scratch Card Modal */}
            {scratchModalVisible && selectedCard && (
                <ScratchCardModal
                    visible={scratchModalVisible}
                    onClose={() => {
                        setScratchModalVisible(false);
                        setSelectedCard(null);
                    }}
                    card={selectedCard}
                    onScratch={handleScratchReveal}
                />
            )}

            <WalletPinModal
                visible={pinModalVisible}
                mode={pinMode}
                onClose={() => setPinModalVisible(false)}
                onSuccess={handlePinSetupComplete}
                onPinEnter={async (pin) => {
                    if (pinMode === 'set') {
                        await setWalletPin(userId, pin);
                        return true;
                    }
                    return false;
                }}
            />
            <WithdrawalModal
                visible={showWithdrawModal}
                onClose={() => setShowWithdrawModal(false)}
                walletBalance={wallet?.balance || 0}
                onWithdrawSuccess={() => fetchWallet()}
            />
            <CustomAlert {...alertConfig} onClose={hideAlert} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
    },
    headerGradient: {
        paddingTop: Platform.OS === 'ios' ? 50 : 15,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    headerContent: {},
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    headerLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    headerUserName: {
        fontSize: 22,
        color: '#FFF',
        fontWeight: '700',
        marginTop: 4,
    },
    notifBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    balanceCard: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: 20,
    },
    balanceTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    balanceLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    balanceAmount: {
        fontSize: 38,
        color: '#FFF',
        fontWeight: '800',
        marginTop: 4,
    },
    addMoneyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    addMoneyText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '700',
    },
    balanceStats: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 14,
    },
    balanceStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    balanceStatText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    bodyContent: {
        paddingHorizontal: 16,
        marginTop: -8,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    actionCard: {
        flex: 1,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    scanBanner: {
        marginTop: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    scanBannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
    },
    scanBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    scanBannerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanBannerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
    },
    scanBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 2,
    },
    scratchSection: {
        borderRadius: 20,
        padding: 16,
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    scratchHeader: {
        marginBottom: 12,
    },
    scratchCardItem: {
        marginRight: 12,
    },
    scratchCardGradient: {
        width: 100,
        height: 100,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    scratchCardText: {
        fontSize: 11,
        color: '#FFF',
        fontWeight: '600',
        textAlign: 'center',
    },
    transactionSection: {
        borderRadius: 20,
        padding: 20,
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    filterRow: {
        marginBottom: 16,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#3B82F6',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#FFF',
    },
    emptyTransactions: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 8,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '500',
    },
    emptySubtext: {
        fontSize: 12,
    },
    txnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    txnIconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txnInfo: {
        flex: 1,
        marginLeft: 12,
    },
    txnDesc: {
        fontSize: 14,
        fontWeight: '500',
    },
    txnDate: {
        fontSize: 11,
        marginTop: 3,
    },
    txnAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    // Add Money Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
    },
    modalSubtitle: {
        fontSize: 13,
        marginBottom: 20,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    currencySymbol: {
        fontSize: 28,
        fontWeight: '700',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 28,
        fontWeight: '700',
        paddingVertical: 14,
    },
    quickAmounts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    quickAmountBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    quickAmountText: {
        fontSize: 14,
        fontWeight: '600',
    },
    payBtn: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    payBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    payBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    }
});

export default UserWalletScreen;
