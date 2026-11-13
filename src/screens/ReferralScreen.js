import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Share,
    Linking,
    ToastAndroid,
    Clipboard,
    SafeAreaView,
    Dimensions,
    Vibration,
    Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getMyReferralCode, getReferralStats, getReferralHistory } from '../services/api';

const { width } = Dimensions.get('window');

const ReferralScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const user = route.params?.user || {};
    const userId = user._id || user.id || user.userId;

    const [loading, setLoading] = useState(true);
    const [referralCode, setReferralCode] = useState('');
    const [stats, setStats] = useState({
        totalEarned: 0,
        totalPending: 0,
        totalReferrals: 0,
    });
    const [history, setHistory] = useState([]);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchReferralData();
        } else {
            setLoading(false);
        }
    }, [userId]);

    const fetchReferralData = async () => {
        setLoading(true);
        try {
            const [codeData, statsData, historyData] = await Promise.all([
                getMyReferralCode(userId).catch(() => ({ referralCode: 'STQ' + (userId ? userId.substring(0, 5).toUpperCase() : 'VIP') })),
                getReferralStats(userId).catch(() => ({ totalEarned: 0, totalPending: 0, totalReferrals: 0 })),
                getReferralHistory(userId).catch(() => ({ referrals: [] }))
            ]);

            if (codeData?.referralCode) setReferralCode(codeData.referralCode);
            if (statsData) {
                setStats({
                    totalEarned: statsData.totalEarned || 0,
                    totalPending: statsData.totalPending || 0,
                    totalReferrals: statsData.totalReferrals || 0,
                });
            }
            if (historyData?.referrals) setHistory(historyData.referrals);
        } catch (error) {
            console.error('Referral data fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (!referralCode) return;
        Clipboard.setString(referralCode);
        setCopied(true);
        try {
            Vibration.vibrate(60);
        } catch (e) {}

        if (Platform.OS === 'android') {
            ToastAndroid.show('✨ VIP Referral Code Copied!', ToastAndroid.SHORT);
        }
        setTimeout(() => setCopied(false), 3000);
    };

    const getShareMessage = () => {
        const appLink = 'https://styleq.social';
        return `✂️ *Grow Your Salon with StylQ — India's #1 Salon OS!*\n\n` +
               `✨ Manage Live Queue, Appointments & Online Bookings seamlessly.\n\n` +
               `🎁 *EXCLUSIVE PERK:* Use my VIP code *${referralCode || 'VIP'}* to get *10% OFF* on your first subscription!\n\n` +
               `📲 Download App & Activate Your Salon:\n${appLink}`;
    };

    const handleShareWhatsApp = async () => {
        if (!referralCode) return;
        const msg = getShareMessage();
        const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                await Share.share({ message: msg, title: 'StylQ VIP Invite' });
            }
        } catch (e) {
            await Share.share({ message: msg, title: 'StylQ VIP Invite' });
        }
    };

    const handleNativeShare = async () => {
        if (!referralCode) return;
        const msg = getShareMessage();
        try {
            await Share.share({
                message: msg,
                title: 'Invite Salons to StylQ'
            });
        } catch (e) {}
    };

    const isDark = isDarkMode;
    const activeCount = stats.totalReferrals || 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0A0814' : '#F5F5FA' }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? '#0A0814' : '#F5F5FA'} />

            {/* TOP HEADER */}
            <View style={[styles.header, { backgroundColor: isDark ? '#0A0814' : '#F5F5FA' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? '#FFF' : '#1A1A24'} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#1A1A24' }]}>StylQ Partner Club</Text>
                    <Text style={styles.headerSubtitle}>INVITE & EARN CASH</Text>
                </View>
                <TouchableOpacity onPress={handleNativeShare} style={styles.shareHeaderBtn} activeOpacity={0.7}>
                    <Ionicons name="share-social-outline" size={20} color={isDark ? '#FFD700' : '#7C4DFF'} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 14, fontSize: 13, fontWeight: '600' }}>
                        Loading Partner Dashboard...
                    </Text>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* 1. LUXURY VIP METALLIC MEMBER PASS */}
                    <View style={styles.vipPassCard}>
                        {/* Shimmer Overlay Top Accent */}
                        <View style={styles.passHeaderRow}>
                            <View style={styles.vipBadge}>
                                <Ionicons name="shield-checkmark" size={13} color="#000" />
                                <Text style={styles.vipBadgeText}>OFFICIAL PARTNER PASS</Text>
                            </View>
                            <View style={styles.passLogoBox}>
                                <Text style={styles.passLogoText}>Styl<Text style={{ color: '#FFD700' }}>Q</Text></Text>
                            </View>
                        </View>

                        {/* Pass Middle Proposition */}
                        <View style={styles.passBody}>
                            <Text style={styles.passBigTitle}>Earn ₹200 Cash</Text>
                            <Text style={styles.passSubDesc}>
                                Per salon partner you onboard. Direct instant payout to your Bank / UPI wallet with zero deduction.
                            </Text>
                        </View>

                        {/* Gold Chip & Watermark Decorative */}
                        <View style={styles.passFooterRow}>
                            <View style={styles.passChip}>
                                <View style={styles.passChipLine} />
                                <View style={[styles.passChipLine, { marginTop: 3 }]} />
                            </View>
                            <View style={styles.passPerkPill}>
                                <Ionicons name="flash" size={12} color="#FFD700" />
                                <Text style={styles.passPerkText}>50% Plan Commission</Text>
                            </View>
                        </View>
                    </View>

                    {/* 2. NEON-DASHED VIP CODE CARD WITH 1-TAP COPY */}
                    <View style={[styles.codeCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                        <View style={styles.codeCardHeader}>
                            <Text style={[styles.codeCardLabel, { color: isDark ? '#A1A5B7' : '#6E7191' }]}>YOUR UNIQUE REFERRAL CODE</Text>
                            <Text style={styles.codeCardHint}>Give this code to Salon Owners</Text>
                        </View>

                        <View style={styles.codeBoxContainer}>
                            <View style={[styles.codeBoxInner, { backgroundColor: isDark ? '#1F1B36' : '#F7F5FC' }]}>
                                <Text style={styles.codeText}>{referralCode || 'STQVIP'}</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.copyActionBtn, copied && styles.copyActionBtnActive]}
                                onPress={handleCopyCode}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={copied ? "checkmark-done" : "copy"} size={16} color="#000" />
                                <Text style={styles.copyActionText}>{copied ? 'COPIED' : 'COPY'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Instant Sharing Actions */}
                        <View style={styles.shareButtonsRow}>
                            <TouchableOpacity
                                style={styles.whatsAppShareBtn}
                                onPress={handleShareWhatsApp}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
                                <Text style={styles.whatsAppShareText}>Share on WhatsApp</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.moreShareBtn, { backgroundColor: isDark ? '#221E3B' : '#F0EDFA' }]}
                                onPress={handleNativeShare}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="share-social" size={18} color={isDark ? '#FFF' : '#1A1A24'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 3. REWARD LADDER / MILESTONE PROGRESS TRACKER */}
                    <View style={[styles.ladderCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                        <View style={styles.ladderHeaderRow}>
                            <Text style={[styles.ladderTitle, { color: isDark ? '#FFF' : '#1A1A24' }]}>Partner Milestones</Text>
                            <Text style={styles.ladderBadge}>{activeCount} Joined</Text>
                        </View>

                        {/* Milestone Step 1 */}
                        <View style={styles.milestoneRow}>
                            <View style={[styles.milestoneNode, activeCount >= 1 ? styles.nodeCompleted : styles.nodePending]}>
                                <Ionicons name={activeCount >= 1 ? "checkmark" : "gift-outline"} size={14} color={activeCount >= 1 ? "#000" : "#888"} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.milestoneHeading, { color: isDark ? '#FFF' : '#1A1A24' }]}>1st Salon Onboarded</Text>
                                <Text style={[styles.milestoneSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Get instant ₹200 credited to Wallet</Text>
                            </View>
                            <Text style={styles.milestoneReward}>₹200</Text>
                        </View>

                        <View style={[styles.milestoneLine, { backgroundColor: activeCount >= 3 ? '#FFD700' : (isDark ? '#2E294A' : '#E5E7EB') }]} />

                        {/* Milestone Step 2 */}
                        <View style={styles.milestoneRow}>
                            <View style={[styles.milestoneNode, activeCount >= 3 ? styles.nodeCompleted : styles.nodePending]}>
                                <Ionicons name={activeCount >= 3 ? "checkmark" : "trophy-outline"} size={14} color={activeCount >= 3 ? "#000" : "#888"} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.milestoneHeading, { color: isDark ? '#FFF' : '#1A1A24' }]}>3 Salons (Silver Partner)</Text>
                                <Text style={[styles.milestoneSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Unlock ₹600 Total Cash + Partner Badge</Text>
                            </View>
                            <Text style={styles.milestoneReward}>₹600</Text>
                        </View>

                        <View style={[styles.milestoneLine, { backgroundColor: activeCount >= 5 ? '#FFD700' : (isDark ? '#2E294A' : '#E5E7EB') }]} />

                        {/* Milestone Step 3 */}
                        <View style={styles.milestoneRow}>
                            <View style={[styles.milestoneNode, activeCount >= 5 ? styles.nodeCompleted : styles.nodePending]}>
                                <Ionicons name={activeCount >= 5 ? "checkmark" : "star-outline"} size={14} color={activeCount >= 5 ? "#000" : "#888"} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.milestoneHeading, { color: isDark ? '#FFF' : '#1A1A24' }]}>5+ Salons (Gold VIP)</Text>
                                <Text style={[styles.milestoneSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>₹1,000+ Cash + Priority Payout Clearance</Text>
                            </View>
                            <Text style={styles.milestoneReward}>₹1,000+</Text>
                        </View>
                    </View>

                    {/* 4. EARNINGS VAULT METRICS */}
                    <Text style={[styles.sectionHeading, { color: isDark ? '#FFF' : '#1A1A24' }]}>Earnings Vault</Text>

                    <View style={styles.vaultGrid}>
                        <View style={[styles.vaultCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                            <View style={styles.vaultIconCircleGreen}>
                                <Ionicons name="wallet-outline" size={18} color="#10B981" />
                            </View>
                            <Text style={[styles.vaultAmount, { color: '#10B981' }]}>₹{stats.totalEarned.toLocaleString('en-IN')}</Text>
                            <Text style={[styles.vaultLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Earned Cash</Text>
                        </View>

                        <View style={[styles.vaultCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                            <View style={styles.vaultIconCirclePurple}>
                                <Ionicons name="people-outline" size={18} color="#7C4DFF" />
                            </View>
                            <Text style={[styles.vaultAmount, { color: isDark ? '#FFF' : '#1A1A24' }]}>{stats.totalReferrals}</Text>
                            <Text style={[styles.vaultLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Salons Joined</Text>
                        </View>

                        <View style={[styles.vaultCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                            <View style={styles.vaultIconCircleYellow}>
                                <Ionicons name="time-outline" size={18} color="#F59E0B" />
                            </View>
                            <Text style={[styles.vaultAmount, { color: '#F59E0B' }]}>₹{stats.totalPending.toLocaleString('en-IN')}</Text>
                            <Text style={[styles.vaultLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>In Review</Text>
                        </View>
                    </View>

                    {/* 5. ONBOARDED PARTNERS ACTIVITY */}
                    <Text style={[styles.sectionHeading, { color: isDark ? '#FFF' : '#1A1A24', marginTop: 24 }]}>Partner Activity</Text>

                    {history.length === 0 ? (
                        <View style={[styles.emptyBox, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                            <Ionicons name="storefront-outline" size={36} color={isDark ? '#474169' : '#C4C2D8'} />
                            <Text style={[styles.emptyTitle, { color: isDark ? '#FFF' : '#1A1A24' }]}>No Salons Onboarded Yet</Text>
                            <Text style={[styles.emptySub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                                Share your VIP code with salon owners in your city. You'll see their onboarding status here in real-time.
                            </Text>
                        </View>
                    ) : (
                        history.map((item, index) => {
                            const salonName = item.salonName || item.referredSalonId?.name || 'Partner Salon';
                            const isPaid = item.status === 'completed' || item.status === 'subscribed';
                            return (
                                <View key={item._id || index} style={[styles.historyRowCard, { backgroundColor: isDark ? '#141124' : '#FFFFFF', borderColor: isDark ? '#2A244D' : '#EAE8F5' }]}>
                                    <View style={styles.historyAvatarBox}>
                                        <Text style={{ fontSize: 18 }}>💈</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.historySalonTitle, { color: isDark ? '#FFF' : '#1A1A24' }]}>{salonName}</Text>
                                        <Text style={[styles.historyStatusText, { color: isPaid ? '#10B981' : '#F59E0B' }]}>
                                            {isPaid ? '✅ Reward Credited (₹200)' : '⏳ Plan Activation Pending'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.historyDate, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently'}
                                    </Text>
                                </View>
                            );
                        })
                    )}

                    <View style={{ height: 30 }} />
                </ScrollView>
            )}
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
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFD700',
        letterSpacing: 1.2,
        marginTop: 1,
    },
    shareHeaderBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
    },

    // 1. VIP METALLIC PASS
    vipPassCard: {
        backgroundColor: '#171426',
        borderRadius: 24,
        padding: 22,
        borderWidth: 1.5,
        borderColor: '#D4AF37', // Metallic Gold Trim
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        marginBottom: 16,
    },
    passHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
    },
    vipBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    passLogoBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    passLogoText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    passBody: {
        marginBottom: 18,
    },
    passBigTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 0.2,
    },
    passSubDesc: {
        fontSize: 13,
        color: '#D1D5DB',
        lineHeight: 19,
        marginTop: 6,
        fontWeight: '500',
    },
    passFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 215, 0, 0.15)',
    },
    passChip: {
        width: 32,
        height: 22,
        backgroundColor: 'rgba(255,215,0,0.2)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FFD700',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    passChipLine: {
        height: 1.5,
        backgroundColor: '#FFD700',
        borderRadius: 1,
    },
    passPerkPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    passPerkText: {
        color: '#FFD700',
        fontSize: 11,
        fontWeight: '700',
    },

    // 2. CODE & SHARE CARD
    codeCard: {
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        marginBottom: 16,
    },
    codeCardHeader: {
        marginBottom: 12,
    },
    codeCardLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    codeCardHint: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    codeBoxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    codeBoxInner: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FFD700',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    codeText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFD700',
        letterSpacing: 2,
    },
    copyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 18,
        paddingVertical: 15,
        borderRadius: 14,
        gap: 6,
    },
    copyActionBtnActive: {
        backgroundColor: '#10B981',
    },
    copyActionText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    shareButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    whatsAppShareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    whatsAppShareText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    moreShareBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // 3. MILESTONE PROGRESS LADDER
    ladderCard: {
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        marginBottom: 20,
    },
    ladderHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    ladderTitle: {
        fontSize: 15,
        fontWeight: '800',
    },
    ladderBadge: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFD700',
        backgroundColor: 'rgba(255,215,0,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    milestoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    milestoneNode: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nodeCompleted: {
        backgroundColor: '#FFD700',
    },
    nodePending: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    milestoneHeading: {
        fontSize: 13,
        fontWeight: '700',
    },
    milestoneSub: {
        fontSize: 11,
        marginTop: 1,
    },
    milestoneReward: {
        fontSize: 14,
        fontWeight: '900',
        color: '#10B981',
    },
    milestoneLine: {
        width: 2,
        height: 18,
        marginLeft: 13,
        marginVertical: 2,
    },

    // 4. VAULT METRICS
    sectionHeading: {
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 12,
    },
    vaultGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    vaultCard: {
        flex: 1,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    vaultIconCircleGreen: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    vaultIconCirclePurple: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(124, 77, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    vaultIconCircleYellow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    vaultAmount: {
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 2,
    },
    vaultLabel: {
        fontSize: 10,
        fontWeight: '600',
    },

    // 5. ACTIVITY LIST
    emptyBox: {
        padding: 24,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 17,
    },
    historyRowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
    },
    historyAvatarBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(124, 77, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    historySalonTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    historyStatusText: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    historyDate: {
        fontSize: 11,
        fontWeight: '500',
    },
});

export default ReferralScreen;
