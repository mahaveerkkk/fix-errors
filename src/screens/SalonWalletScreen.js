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
    Share as RNShare,
    Platform,
    Clipboard,
    Modal
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getSalonWallet, setWalletPin } from '../services/api';
import WalletPinModal from '../components/common/WalletPinModal';
import CustomAlert from '../components/common/CustomAlert';
import WithdrawalModal from '../components/wallet/WithdrawalModal';

const { width } = Dimensions.get('window');

const SalonWalletScreen = ({ route, navigation }) => {
    const { user, salon } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [wallet, setWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showQRFull, setShowQRFull] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    // PIN states
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [pinMode, setPinMode] = useState('set'); // 'set', 'verify'

    // Custom Alert
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
    const showAlert = (title, message, type = 'info', buttons = []) => {
        setAlertConfig({ visible: true, title, message, type, buttons });
    };
    const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

    const qrRef = useRef();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const salonId = salon?._id || salon?.id;
    const shortCode = salonId?.slice(-8)?.toUpperCase() || 'UNKNOWN';
    const qrValue = `styleq://pay/${shortCode}`;

    // Indian number format: 50000 → 50,000
    const formatIndianNumber = (num) => {
        if (!num) return '0';
        return num.toLocaleString('en-IN');
    };

    const handleCopyId = () => {
        Clipboard.setString(shortCode);
        Alert.alert('✅ Copied!', `Salon ID: ${shortCode} copied`);
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
            if (!salonId) return;
            const data = await getSalonWallet(salonId);
            setWallet(data);
        } catch (error) {
            console.log('Wallet fetch error:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [salonId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchWallet();
    };

    const handleShareQR = async () => {
        try {
            if (qrRef.current) {
                const uri = await qrRef.current.capture();
                await Share.open({
                    title: `${salon?.name || 'Salon'} QR Code`,
                    message: `Scan this QR to pay at ${salon?.name || 'our salon'}!`,
                    url: uri,
                    type: 'image/png'
                });
            }
        } catch (error) {
            // User cancelled or error
            if (error?.message !== 'User did not share') {
                Alert.alert('Error', 'Could not share QR code');
            }
        }
    };

    const handleDownloadQR = async () => {
        try {
            if (qrRef.current) {
                await qrRef.current.capture();
                Alert.alert('✅ Saved!', 'QR Code saved to your gallery');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not save QR code');
        }
    };

    const getFilteredTransactions = () => {
        if (!wallet?.transactions) return [];
        if (activeFilter === 'all') return wallet.transactions;
        if (activeFilter === 'received') return wallet.transactions.filter(t => t.type === 'qr_payment_received');
        if (activeFilter === 'spent') return wallet.transactions.filter(t => ['subscription_payment', 'debit'].includes(t.type));
        return wallet.transactions;
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'qr_payment_received': return { icon: 'arrow-down-circle', color: '#10B981' };
            case 'subscription_payment': return { icon: 'diamond', color: '#8B5CF6' };
            case 'cashback_first': case 'cashback_regular': return { icon: 'gift', color: '#F59E0B' };
            case 'debit': return { icon: 'arrow-up-circle', color: '#EF4444' };
            case 'credit': case 'add_money': return { icon: 'add-circle', color: '#10B981' };
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

    const getSubscriptionStatus = () => {
        if (!wallet) return null;
        if (wallet.subscriptionActive) {
            const endDate = new Date(wallet.subscriptionEndDate);
            const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            return {
                active: true,
                text: daysLeft > 365 ? 'Lifetime' : `${daysLeft} days left`,
                endDate: endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            };
        }
        return { active: false, text: 'Not Active', endDate: null };
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading wallet...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const subscriptionStatus = getSubscriptionStatus();
    const filteredTransactions = getFilteredTransactions();

    const handleSettingsPress = () => {
        if (!wallet) return;
        if (wallet.hasPin) {
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
        fetchWallet(); // refresh hasPin
        showAlert('Success', 'Wallet PIN set successfully.', 'success', [{text: 'OK', onPress: hideAlert}]);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="#059669" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />}
            >
                {/* Header with gradient */}
                <LinearGradient
                    colors={isDarkMode ? ['#064E3B', '#065F46', '#047857'] : ['#059669', '#10B981', '#34D399']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.headerTop}>
                            <View>
                                <Text style={styles.headerLabel}>Business Wallet</Text>
                                <Text style={styles.headerSalonName}>{salon?.name || 'My Salon'}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.subscriptionBadge}
                                onPress={() => navigation.navigate('Subscription', { salon })}
                            >
                                <Ionicons name="diamond" size={14} color="#FFF" />
                                <Text style={styles.subscriptionBadgeText}>
                                    {subscriptionStatus?.active ? 'Active' : 'Upgrade'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Balance Card */}
                        <View style={styles.balanceCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={styles.balanceLabel}>Available Balance</Text>
                                    <Text style={styles.balanceAmount}>₹{formatIndianNumber(wallet?.balance)}</Text>
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                    onPress={() => setShowWithdrawModal(true)}
                                >
                                    <Ionicons name="cash-outline" size={16} color="#059669" />
                                    <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 13 }}>Withdraw</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.balanceStats}>
                                <View style={styles.balanceStat}>
                                    <Ionicons name="arrow-down-circle" size={16} color="#A7F3D0" />
                                    <Text style={styles.balanceStatText}>₹{formatIndianNumber(wallet?.totalAdded)} Received</Text>
                                </View>
                                <View style={styles.balanceStat}>
                                    <Ionicons name="arrow-up-circle" size={16} color="#FCA5A5" />
                                    <Text style={styles.balanceStatText}>₹{formatIndianNumber(wallet?.totalSpent)} Used</Text>
                                </View>
                            </View>
                        </View>

                        {/* Subscription Status */}
                        {subscriptionStatus && (
                            <TouchableOpacity
                                style={[styles.subscriptionBar, { backgroundColor: subscriptionStatus.active ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)' }]}
                                onPress={() => navigation.navigate('Subscription', { salon })}
                            >
                                <View style={styles.subscriptionLeft}>
                                    <Ionicons
                                        name={subscriptionStatus.active ? 'checkmark-circle' : 'alert-circle'}
                                        size={18}
                                        color={subscriptionStatus.active ? '#A7F3D0' : '#FCA5A5'}
                                    />
                                    <Text style={styles.subscriptionText}>
                                        Subscription: {subscriptionStatus.text}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </LinearGradient>

                <View style={styles.bodyContent}>
                    {/* QR Code Section */}
                    <Animated.View style={[styles.qrSection, { backgroundColor: theme.colors.surface, opacity: fadeAnim }]}>
                        <View style={styles.qrHeader}>
                            <View>
                                <Text style={[styles.qrTitle, { color: theme.colors.text }]}>My QR Code</Text>
                                <Text style={[styles.qrSubtitle, { color: theme.colors.textSecondary }]}>
                                    Customer ko scan karne bolo
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.expandBtn, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.2)' : '#ECFDF5' }]}
                                onPress={() => setShowQRFull(!showQRFull)}
                            >
                                <Ionicons name={showQRFull ? 'contract' : 'expand'} size={18} color="#10B981" />
                            </TouchableOpacity>
                        </View>

                        <ViewShot ref={qrRef} options={{ format: 'png', quality: 0.9, result: 'tmpfile' }}>
                            <View style={[styles.qrContainer, { backgroundColor: '#FFF' }]}>
                                <QRCode
                                    value={qrValue}
                                    size={showQRFull ? width * 0.6 : width * 0.4}
                                    color="#1F2937"
                                    backgroundColor="#FFF"
                                    logo={undefined}
                                    logoSize={30}
                                    logoBackgroundColor="#FFF"
                                />
                                <Text style={styles.qrSalonName}>{salon?.name || 'My Salon'}</Text>
                                <Text style={styles.qrIdText}>ID: {shortCode}</Text>
                            </View>
                        </ViewShot>

                        {/* QR Actions */}
                        <View style={styles.qrActions}>
                            <TouchableOpacity
                                style={[styles.qrActionBtn, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }]}
                                onPress={handleDownloadQR}
                            >
                                <Ionicons name="download-outline" size={20} color="#10B981" />
                                <Text style={[styles.qrActionText, { color: '#10B981' }]}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.qrActionBtn, { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}
                                onPress={handleShareQR}
                            >
                                <Ionicons name="share-social-outline" size={20} color="#3B82F6" />
                                <Text style={[styles.qrActionText, { color: '#3B82F6' }]}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.qrActionBtn, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.15)' : '#FFFBEB' }]}
                                onPress={handleCopyId}
                            >
                                <Ionicons name="copy-outline" size={20} color="#F59E0B" />
                                <Text style={[styles.qrActionText, { color: '#F59E0B' }]}>Copy ID</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.qrActionBtn, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : '#F5F3FF' }]}
                                onPress={() => navigation.navigate('Subscription', { salon })}
                            >
                                <Ionicons name="diamond-outline" size={20} color="#8B5CF6" />
                                <Text style={[styles.qrActionText, { color: '#8B5CF6' }]}>Plans</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* Quick Stats */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                            <View style={[styles.statIcon, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.2)' : '#ECFDF5' }]}>
                                <Ionicons name="arrow-down-circle" size={22} color="#10B981" />
                            </View>
                            <Text style={[styles.statValue, { color: theme.colors.text }]}>
                                {wallet?.transactions?.filter(t => t.type === 'qr_payment_received').length || 0}
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Payments</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                            <View style={[styles.statIcon, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.2)' : '#FFFBEB' }]}>
                                <Ionicons name="cash-outline" size={22} color="#F59E0B" />
                            </View>
                            <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{formatIndianNumber(wallet?.totalAdded)}</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Earned</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                            <View style={[styles.statIcon, { backgroundColor: isDarkMode ? 'rgba(139,92,246,0.2)' : '#F5F3FF' }]}>
                                <Ionicons name="diamond" size={22} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.statValue, { color: theme.colors.text }]}>₹{formatIndianNumber(wallet?.totalSpent)}</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Used</Text>
                        </View>
                    </View>

                    {/* Transaction History */}
                    <View style={[styles.transactionSection, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Transactions</Text>

                        {/* Filter Tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                            {[
                                { key: 'all', label: 'All' },
                                { key: 'received', label: 'Received' },
                                { key: 'spent', label: 'Spent' }
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        activeFilter === f.key && styles.filterChipActive,
                                        activeFilter === f.key && { backgroundColor: '#10B981' }
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
                                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }]}>
                                    <Ionicons name="receipt-outline" size={36} color="#10B981" />
                                </View>
                                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                                    No transactions yet
                                </Text>
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                    QR se payment aane par yahan dikhega
                                </Text>
                            </View>
                        ) : (
                            filteredTransactions.map((txn, index) => {
                                const txnIcon = getTransactionIcon(txn.type);
                                const isCredit = ['qr_payment_received', 'credit', 'add_money', 'cashback_first', 'cashback_regular'].includes(txn.type);
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

            {/* QR Full Screen Modal (Existing) */}
            <Modal
                visible={showQRFull}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowQRFull(false)}
            >
                <View style={styles.qrFullOverlay}>
                    <View style={styles.qrFullContainer}>
                        <QRCode
                            value={qrValue}
                            size={width * 0.8}
                            color="#000"
                            backgroundColor="#FFF"
                        />
                        <TouchableOpacity style={styles.closeFullQRBtn} onPress={() => setShowQRFull(false)}>
                            <Ionicons name="close-circle" size={40} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* PIN Settings Modal */}
            <WalletPinModal
                visible={pinModalVisible}
                mode={pinMode}
                onClose={() => setPinModalVisible(false)}
                onSuccess={handlePinSetupComplete}
                onPinEnter={async (pin) => {
                    const userId = user?._id || user?.id;
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
    headerSalonName: {
        fontSize: 22,
        color: '#FFF',
        fontWeight: '700',
        marginTop: 4,
    },
    subscriptionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 5,
    },
    subscriptionBadgeText: {
        fontSize: 12,
        color: '#FFF',
        fontWeight: '600',
    },
    balanceCard: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 12,
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
        marginVertical: 6,
    },
    balanceStats: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 4,
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
    subscriptionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    subscriptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    subscriptionText: {
        fontSize: 13,
        color: '#FFF',
        fontWeight: '500',
    },
    bodyContent: {
        paddingHorizontal: 16,
        marginTop: -8,
    },
    qrSection: {
        borderRadius: 20,
        padding: 20,
        marginTop: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    qrHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    qrTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    qrSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    expandBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrContainer: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
        alignSelf: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    qrSalonName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 12,
    },
    qrIdText: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 4,
        letterSpacing: 1,
    },
    qrActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 10,
    },
    qrActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
    },
    qrActionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 10,
        marginTop: 3,
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
        backgroundColor: '#10B981',
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
        gap: 10,
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
        fontSize: 13,
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
    }
});

export default SalonWalletScreen;
