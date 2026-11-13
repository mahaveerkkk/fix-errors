import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, Image, TouchableOpacity, ScrollView,
    StyleSheet, TextInput, Alert, ActivityIndicator, Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCustomerProfile, saveCustomerNote } from '../../services/api';

const CustomerProfileSheet = ({ visible, onClose, salonId, userId, customerImage, customerName }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteEditing, setNoteEditing] = useState(false);

    useEffect(() => {
        if (visible && salonId && userId) {
            fetchProfile();
        }
    }, [visible, salonId, userId]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const data = await getCustomerProfile(salonId, userId);
            setProfile(data);
            setNoteText(data.customerNote || '');
        } catch (error) {
        }
        setLoading(false);
    };

    const handleSaveNote = async () => {
        setNoteSaving(true);
        try {
            await saveCustomerNote(salonId, userId, noteText);
            setNoteEditing(false);
            Alert.alert('✅ Saved', 'Note saved successfully!');
        } catch (error) {
            Alert.alert('❌ Error', 'Failed to save note');
        }
        setNoteSaving(false);
    };

    const getLoyaltyConfig = (status) => {
        switch (status) {
            case 'vip': return { label: 'VIP Customer', icon: 'diamond', color: '#F59E0B', bg: '#FFFBEB', emoji: '👑' };
            case 'loyal': return { label: 'Loyal Customer', icon: 'heart', color: '#22C55E', bg: '#F0FDF4', emoji: '🟢' };
            case 'regular': return { label: 'Regular', icon: 'person', color: '#3B82F6', bg: '#EFF6FF', emoji: '🔵' };
            case 'at_risk': return { label: 'At Risk', icon: 'warning', color: '#F59E0B', bg: '#FFFBEB', emoji: '🟡' };
            case 'lost': return { label: 'Lost Customer', icon: 'sad', color: '#EF4444', bg: '#FEF2F2', emoji: '🔴' };
            default: return { label: 'New Customer', icon: 'sparkles', color: '#8B5CF6', bg: '#F5F3FF', emoji: '🆕' };
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#22C55E';
            case 'cancelled': return '#EF4444';
            case 'pending': return '#F59E0B';
            case 'accepted': return '#3B82F6';
            default: return '#94A3B8';
        }
    };

    if (!visible) return null;

    const loyalty = profile ? getLoyaltyConfig(profile.loyaltyStatus) : getLoyaltyConfig('new');
    const photo = profile?.customer?.profilePhoto || customerImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName || 'U')}&background=7C4DFF&color=fff&bold=true&size=128`;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.overlay}>
                <View style={s.sheet}>
                    <View style={s.dragHandle} />
                    <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={22} color="#94A3B8" />
                    </TouchableOpacity>

                    {loading ? (
                        <View style={s.loadingBox}>
                            <ActivityIndicator size="large" color="#7C4DFF" />
                            <Text style={s.loadingText}>Loading analytics...</Text>
                        </View>
                    ) : profile ? (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

                            {/* ===== 1. PROFILE HEADER ===== */}
                            <View style={s.profileHeader}>
                                <View style={s.avatarRing}>
                                    <Image source={{ uri: photo }} style={s.avatar} />
                                </View>
                                <Text style={s.customerName}>{profile.customer.name}</Text>
                                <View style={[s.loyaltyPill, { backgroundColor: loyalty.bg }]}>
                                    <Text style={{ fontSize: 12 }}>{loyalty.emoji}</Text>
                                    <Text style={[s.loyaltyText, { color: loyalty.color }]}>{loyalty.label}</Text>
                                </View>
                                <Text style={s.memberSince}>
                                    Member since {formatDate(profile.customer.memberSince)}
                                </Text>
                            </View>

                            {/* ===== PHONE ===== */}
                            {profile.customer.phone && (
                                <View style={s.phoneBar}>
                                    <View style={s.phoneInfo}>
                                        <Ionicons name="call-outline" size={16} color="#64748B" />
                                        <Text style={s.phoneText}>{profile.customer.phone}</Text>
                                    </View>
                                    <View style={s.phoneActions}>
                                        <TouchableOpacity style={[s.phoneBtn, { backgroundColor: '#E8F5E9' }]}
                                            onPress={() => Linking.openURL(`tel:${profile.customer.phone}`)}>
                                            <Ionicons name="call" size={14} color="#4CAF50" />
                                            <Text style={[s.phoneBtnText, { color: '#4CAF50' }]}>Call</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[s.phoneBtn, { backgroundColor: '#E3F2FD' }]}
                                            onPress={() => Linking.openURL(`sms:${profile.customer.phone}`)}>
                                            <Ionicons name="chatbubble" size={14} color="#2196F3" />
                                            <Text style={[s.phoneBtnText, { color: '#2196F3' }]}>Message</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* ===== 2. VISIT STATS ===== */}
                            <Text style={s.sectionTitle}>📊 Visit History</Text>
                            <View style={s.statsGrid}>
                                <View style={s.statCard}>
                                    <Ionicons name="calendar" size={20} color="#7C4DFF" />
                                    <Text style={s.statValue}>{profile.visitStats.totalVisits}</Text>
                                    <Text style={s.statLabel}>Total Visits</Text>
                                </View>
                                <View style={s.statCard}>
                                    <Ionicons name="time" size={20} color="#F59E0B" />
                                    <Text style={s.statValue}>
                                        {profile.visitStats.daysSinceLastVisit !== null
                                            ? `${profile.visitStats.daysSinceLastVisit}d`
                                            : 'N/A'}
                                    </Text>
                                    <Text style={s.statLabel}>Days Ago</Text>
                                </View>
                                <View style={s.statCard}>
                                    <Ionicons name="swap-horizontal" size={20} color="#3B82F6" />
                                    <Text style={s.statValue}>{profile.visitStats.avgVisitGap || 0}d</Text>
                                    <Text style={s.statLabel}>Avg Gap</Text>
                                </View>
                            </View>

                            <View style={s.visitDatesRow}>
                                <View style={s.visitDateItem}>
                                    <Ionicons name="flag" size={14} color="#22C55E" />
                                    <Text style={s.visitDateLabel}>First Visit</Text>
                                    <Text style={s.visitDateValue}>{formatDate(profile.visitStats.firstVisit)}</Text>
                                </View>
                                <View style={s.visitDateItem}>
                                    <Ionicons name="refresh" size={14} color="#7C4DFF" />
                                    <Text style={s.visitDateLabel}>Last Visit</Text>
                                    <Text style={s.visitDateValue}>{formatDate(profile.visitStats.lastVisit)}</Text>
                                </View>
                            </View>

                            {/* ===== 3. SPENDING ===== */}
                            <Text style={s.sectionTitle}>💰 Spending</Text>
                            <View style={s.spendingCard}>
                                <View style={s.spendingMain}>
                                    <Text style={s.spendingBigLabel}>Lifetime Spend</Text>
                                    <Text style={s.spendingBigValue}>₹{profile.spendingStats.totalSpent.toLocaleString()}</Text>
                                </View>
                                <View style={s.spendingRow}>
                                    <View style={s.spendingItem}>
                                        <Text style={s.spendSmallLabel}>Avg/Visit</Text>
                                        <Text style={s.spendSmallValue}>₹{profile.spendingStats.avgPerVisit}</Text>
                                    </View>
                                    <View style={s.spendDivider} />
                                    <View style={s.spendingItem}>
                                        <Text style={s.spendSmallLabel}>Highest</Text>
                                        <Text style={[s.spendSmallValue, { color: '#22C55E' }]}>₹{profile.spendingStats.highestSpent}</Text>
                                    </View>
                                    <View style={s.spendDivider} />
                                    <View style={s.spendingItem}>
                                        <Text style={s.spendSmallLabel}>Lowest</Text>
                                        <Text style={[s.spendSmallValue, { color: '#F59E0B' }]}>₹{profile.spendingStats.lowestSpent}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* ===== 4. FAVORITE SERVICES ===== */}
                            {profile.favoriteServices.length > 0 && (
                                <>
                                    <Text style={s.sectionTitle}>✂️ Favorite Services</Text>
                                    {profile.favoriteServices.map((svc, idx) => (
                                        <View key={idx} style={s.serviceItem}>
                                            <View style={s.serviceInfo}>
                                                <Text style={s.serviceName}>
                                                    {idx === 0 ? '⭐ ' : ''}{svc.name}
                                                </Text>
                                                <Text style={s.serviceCount}>{svc.count}x booked • ₹{svc.totalSpent}</Text>
                                            </View>
                                            <View style={s.percentBarBg}>
                                                <View style={[s.percentBarFill, { width: `${svc.percentage}%` }]} />
                                            </View>
                                            <Text style={s.percentText}>{svc.percentage}%</Text>
                                        </View>
                                    ))}
                                </>
                            )}

                            {/* ===== 5. REVIEW ===== */}
                            {profile.review && (
                                <>
                                    <Text style={s.sectionTitle}>⭐ Review</Text>
                                    <View style={s.reviewCard}>
                                        <View style={s.reviewStars}>
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Ionicons
                                                    key={star}
                                                    name={star <= profile.review.rating ? 'star' : 'star-outline'}
                                                    size={18}
                                                    color="#F59E0B"
                                                />
                                            ))}
                                            <Text style={s.reviewRating}>{profile.review.rating}/5</Text>
                                        </View>
                                        {profile.review.comment && (
                                            <Text style={s.reviewComment}>"{profile.review.comment}"</Text>
                                        )}
                                        <Text style={s.reviewDate}>{formatDate(profile.review.date)}</Text>
                                    </View>
                                </>
                            )}

                            {/* ===== 6. LOYALTY INDICATOR ===== */}
                            <Text style={s.sectionTitle}>🏷️ Loyalty Status</Text>
                            <View style={[s.loyaltyCard, { borderLeftColor: loyalty.color }]}>
                                <Ionicons name={loyalty.icon} size={28} color={loyalty.color} />
                                <View style={{ marginLeft: 14, flex: 1 }}>
                                    <Text style={[s.loyaltyCardTitle, { color: loyalty.color }]}>{loyalty.label}</Text>
                                    <Text style={s.loyaltyCardDesc}>
                                        {profile.loyaltyStatus === 'vip' && `Premium customer — ${profile.visitStats.totalVisits} visits, ₹${profile.spendingStats.totalSpent} spent`}
                                        {profile.loyaltyStatus === 'loyal' && `Consistent visitor — comes every ~${profile.visitStats.avgVisitGap} days`}
                                        {profile.loyaltyStatus === 'regular' && `Visited ${profile.visitStats.totalVisits} times — building loyalty`}
                                        {profile.loyaltyStatus === 'at_risk' && `Haven't visited in ${profile.visitStats.daysSinceLastVisit} days — send a reminder!`}
                                        {profile.loyaltyStatus === 'lost' && `Not seen in ${profile.visitStats.daysSinceLastVisit} days — consider a special offer`}
                                        {profile.loyaltyStatus === 'new' && 'First time visitor — make a great impression!'}
                                    </Text>
                                </View>
                            </View>

                            {/* ===== 7. QUICK NOTES ===== */}
                            <Text style={s.sectionTitle}>📝 Quick Notes</Text>
                            <View style={s.noteCard}>
                                {noteEditing ? (
                                    <>
                                        <TextInput
                                            style={s.noteInput}
                                            value={noteText}
                                            onChangeText={setNoteText}
                                            placeholder="e.g. Beard chhota pasand hai, Allergy hai xyz se..."
                                            placeholderTextColor="#94A3B8"
                                            multiline
                                            numberOfLines={3}
                                        />
                                        <View style={s.noteActions}>
                                            <TouchableOpacity style={s.noteCancelBtn} onPress={() => setNoteEditing(false)}>
                                                <Text style={s.noteCancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={s.noteSaveBtn} onPress={handleSaveNote} disabled={noteSaving}>
                                                {noteSaving ? (
                                                    <ActivityIndicator size="small" color="#FFF" />
                                                ) : (
                                                    <Text style={s.noteSaveText}>Save Note</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                ) : (
                                    <TouchableOpacity onPress={() => setNoteEditing(true)} style={s.noteDisplay}>
                                        <Text style={noteText ? s.noteDisplayText : s.noteDisplayPlaceholder}>
                                            {noteText || 'Tap to add a note about this customer...'}
                                        </Text>
                                        <Ionicons name="create-outline" size={18} color="#7C4DFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* ===== 8. RECENT BOOKINGS ===== */}
                            {profile.recentBookings.length > 0 && (
                                <>
                                    <Text style={s.sectionTitle}>📋 Recent Bookings</Text>
                                    {profile.recentBookings.map((bk, idx) => (
                                        <View key={idx} style={s.bookingRow}>
                                            <View style={[s.bookingDot, { backgroundColor: getStatusColor(bk.status) }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.bookingServices}>{bk.services.join(', ')}</Text>
                                                <Text style={s.bookingDate}>{formatDate(bk.date)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={s.bookingAmount}>₹{bk.amount}</Text>
                                                <Text style={[s.bookingStatus, { color: getStatusColor(bk.status) }]}>
                                                    {bk.status.charAt(0).toUpperCase() + bk.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </>
                            )}

                        </ScrollView>
                    ) : (
                        <View style={s.loadingBox}>
                            <Ionicons name="alert-circle" size={40} color="#EF4444" />
                            <Text style={s.loadingText}>Failed to load profile</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, maxHeight: '92%' },
    dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    closeBtn: { position: 'absolute', top: 16, right: 20, backgroundColor: '#F1F5F9', padding: 6, borderRadius: 16, zIndex: 10 },
    loadingBox: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, color: '#94A3B8', fontSize: 13 },

    // Profile Header
    profileHeader: { alignItems: 'center', paddingTop: 8, marginBottom: 16 },
    avatarRing: { padding: 3, borderRadius: 50, borderWidth: 3, borderColor: '#7C4DFF', marginBottom: 10 },
    avatar: { width: 72, height: 72, borderRadius: 36 },
    customerName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
    loyaltyPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6 },
    loyaltyText: { fontSize: 12, fontWeight: '700' },
    memberSince: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

    // Phone Bar
    phoneBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 16 },
    phoneInfo: { flexDirection: 'row', alignItems: 'center' },
    phoneText: { fontSize: 13, color: '#475569', marginLeft: 6, fontWeight: '500' },
    phoneActions: { flexDirection: 'row', gap: 6 },
    phoneBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 4 },
    phoneBtnText: { fontSize: 11, fontWeight: '700' },

    // Section Title
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 10, marginTop: 6 },

    // Stats Grid
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginTop: 6 },
    statLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2 },

    // Visit Dates
    visitDatesRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    visitDateItem: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, gap: 6 },
    visitDateLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    visitDateValue: { fontSize: 11, fontWeight: 'bold', color: '#1E293B' },

    // Spending
    spendingCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 18, marginBottom: 16 },
    spendingMain: { alignItems: 'center', marginBottom: 16 },
    spendingBigLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 },
    spendingBigValue: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
    spendingRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 },
    spendingItem: { alignItems: 'center' },
    spendSmallLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
    spendSmallValue: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
    spendDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

    // Services
    serviceItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    serviceInfo: { flex: 1 },
    serviceName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
    serviceCount: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
    percentBarBg: { width: 60, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
    percentBarFill: { height: '100%', backgroundColor: '#7C4DFF', borderRadius: 3 },
    percentText: { fontSize: 11, fontWeight: 'bold', color: '#7C4DFF', width: 32, textAlign: 'right' },

    // Review
    reviewCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginBottom: 16 },
    reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
    reviewRating: { fontSize: 13, fontWeight: 'bold', color: '#F59E0B', marginLeft: 6 },
    reviewComment: { fontSize: 13, color: '#475569', fontStyle: 'italic', marginBottom: 6 },
    reviewDate: { fontSize: 10, color: '#94A3B8' },

    // Loyalty Card
    loyaltyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16, borderLeftWidth: 4 },
    loyaltyCardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    loyaltyCardDesc: { fontSize: 11, color: '#64748B', lineHeight: 16 },

    // Notes
    noteCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16 },
    noteInput: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 13, color: '#1E293B', textAlignVertical: 'top', minHeight: 70, marginBottom: 10 },
    noteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    noteCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
    noteCancelText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    noteSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#7C4DFF' },
    noteSaveText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    noteDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteDisplayText: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 18 },
    noteDisplayPlaceholder: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', flex: 1 },

    // Recent Bookings
    bookingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    bookingDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    bookingServices: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
    bookingDate: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
    bookingAmount: { fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
    bookingStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});

export default CustomerProfileSheet;
