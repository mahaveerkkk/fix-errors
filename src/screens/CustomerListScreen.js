import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    Modal,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Alert,
    Platform,
    Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { getSalonCustomers, saveCustomerNote } from '../services/api';

const FILTERS = [
    { label: 'All', value: 'all', icon: 'people' },
    { label: '⭐ VIP', value: 'vip', icon: 'star' },
    { label: '🌱 New', value: 'new', icon: 'leaf' },
    { label: '🎂 Birthdays', value: 'birthdays', icon: 'gift' },
    { label: '💰 Top Spenders', value: 'top_spenders', icon: 'cash' },
    { label: '⚠️ At Risk', value: 'at_risk', icon: 'warning' },
    { label: '👻 Lost', value: 'lost', icon: 'heart-dislike' },
    { label: '👀 Viewers', value: 'viewers', icon: 'eye' }
];

const CustomerListScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [customers, setCustomers] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [note, setNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    const fetchCustomers = useCallback(async (isRefresh = false) => {
        if (!salon?._id) return;
        if (!isRefresh) setLoading(true);

        try {
            const data = await getSalonCustomers(salon._id, activeFilter);
            setCustomers(data.customers || []);
            setSummary(data.summary || {});
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to load customers');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [salon?._id, activeFilter]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchCustomers(true);
    };

    const handleCall = (phone) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', 'Phone number not available');
        }
    };

    const handleAddNote = (customer) => {
        setSelectedCustomer(customer);
        // Find existing note if present or default empty
        setNote(customer.notes || ''); 
        setModalVisible(true);
    };

    const handleSaveNote = async () => {
        if (!selectedCustomer) return;
        setSavingNote(true);
        try {
            await saveCustomerNote(salon._id, selectedCustomer._id, note.trim());
            // Update locally to avoid full page refresh
            setCustomers(prev => prev.map(c => c._id === selectedCustomer._id ? { ...c, notes: note.trim() } : c));
            setModalVisible(false);
            Alert.alert('Success', 'Notes updated successfully!');
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to save note');
        } finally {
            setSavingNote(false);
        }
    };

    const formatVisitDate = (dateStr) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery)
    );

    const renderCustomerItem = ({ item }) => {
        const avatarUrl = item.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'Client')}&background=0D9488&color=fff`;
        return (
            <Card style={[styles.customerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.row}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    <View style={styles.info}>
                        <Text style={[styles.name, { color: theme.colors.text }]}>{item.name || 'Walk-in Customer'}</Text>
                        
                        {item.phone ? (
                            <TouchableOpacity onPress={() => handleCall(item.phone)} style={styles.phoneRow}>
                                <Ionicons name="call-outline" size={13} color="#0D9488" />
                                <Text style={styles.phoneText}>{item.phone}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.phone, { color: theme.colors.textSecondary }]}>No phone number</Text>
                        )}

                        <View style={styles.statsRow}>
                            {activeFilter === 'viewers' ? (
                                <View style={[styles.statBadge, { backgroundColor: item.didBook ? '#ECFDF5' : '#FEF2F2' }]}>
                                    <Ionicons 
                                        name={item.didBook ? "checkmark-circle-outline" : "eye-outline"} 
                                        size={12} 
                                        color={item.didBook ? '#059669' : '#EF4444'} 
                                    />
                                    <Text style={[styles.statText, { color: item.didBook ? '#059669' : '#EF4444' }]}>
                                        {item.didBook ? 'Booked' : 'Viewed Only'}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.statBadge, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                                        <Ionicons name="calendar-outline" size={12} color={theme.colors.primary} />
                                        <Text style={[styles.statText, { color: theme.colors.text }]}>{item.totalVisits} Visit{item.totalVisits !== 1 ? 's' : ''}</Text>
                                    </View>
                                    {item.lifetimeSpend > 0 && (
                                        <View style={[styles.statBadge, { backgroundColor: isDarkMode ? '#1A2E1A' : '#ECFDF5', marginLeft: 8 }]}>
                                            <Ionicons name="cash-outline" size={12} color="#059669" />
                                            <Text style={[styles.statText, { color: '#059669' }]}>₹{item.lifetimeSpend}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                        
                        <Text style={[styles.lastVisitText, { color: theme.colors.textLight }]}>
                            Last Active: {formatVisitDate(item.lastVisitDate)}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleAddNote(item)} style={styles.noteBtn}>
                        <Ionicons name="document-text-outline" size={24} color={item.notes ? '#0D9488' : theme.colors.textLight} />
                    </TouchableOpacity>
                </View>
                {item.notes ? (
                    <View style={[styles.noteContainer, { backgroundColor: isDarkMode ? '#2D2200' : '#FFFBEB', borderColor: '#FBBF24' }]}>
                        <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>"{item.notes}"</Text>
                    </View>
                ) : null}
            </Card>
        );
    };

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="Customers & CRM" showBack />

            {/* Premium Category Filter Slider */}
            <View style={styles.filterOuter}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.filterScroll}
                >
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.value}
                            style={[
                                styles.filterBadge,
                                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                activeFilter === f.value && [styles.filterBadgeActive, { backgroundColor: '#0D9488', borderColor: '#0D9488' }]
                            ]}
                            onPress={() => setActiveFilter(f.value)}
                        >
                            <Ionicons 
                                name={f.icon} 
                                size={14} 
                                color={activeFilter === f.value ? '#FFF' : theme.colors.textSecondary} 
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[
                                styles.filterBadgeText, 
                                { color: theme.colors.textSecondary },
                                activeFilter === f.value && { color: '#FFF' }
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Quick Stats Summary Card */}
            {!loading && summary.totalCustomers !== undefined && (
                <View style={[styles.summaryCard, { backgroundColor: '#0D948820', borderColor: '#0D948840' }]}>
                    <Ionicons name="stats-chart" size={20} color="#0D9488" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
                            Found <Text style={{ fontWeight: 'bold', color: '#0D9488' }}>{filteredCustomers.length}</Text> Customer{filteredCustomers.length !== 1 ? 's' : ''}
                        </Text>
                        <Text style={[styles.summarySubtitle, { color: theme.colors.textSecondary }]}>
                            {activeFilter === 'viewers' 
                                ? `${summary.viewersNotBooked || 0} unique viewers did not book yet.`
                                : `VIP: ${summary.vipCount || 0} • Birthdays: ${summary.birthdayCount || 0}`}
                        </Text>
                    </View>
                </View>
            )}

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Ionicons name="search" size={20} color={theme.colors.textLight} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search by name or phone..."
                    placeholderTextColor={theme.colors.textLight}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Dynamic FlatList */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#0D9488" />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Analyzing CRM data...</Text>
                </View>
            ) : filteredCustomers.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="people-outline" size={64} color={theme.colors.textLight} />
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Customers Found</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        Try choosing a different filter or search query.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCustomers}
                    renderItem={renderCustomerItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9488']} />
                    }
                />
            )}

            {/* Note Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Customer Notes</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.customerName}>{selectedCustomer?.name}</Text>

                        <TextInput
                            style={[styles.noteInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                            multiline
                            numberOfLines={4}
                            value={note}
                            onChangeText={setNote}
                            placeholder="Add remarks about this customer (preferences, allergies, VIP notes...)"
                            placeholderTextColor={theme.colors.textLight}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancel"
                                variant="outline"
                                onPress={() => setModalVisible(false)}
                                style={{ flex: 1, marginRight: 10 }}
                            />
                            <Button
                                title={savingNote ? "Saving..." : "Save Note"}
                                onPress={handleSaveNote}
                                disabled={savingNote}
                                style={{ flex: 1, marginLeft: 10, backgroundColor: '#0D9488' }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    filterOuter: {
        marginTop: 10,
        marginBottom: 4,
    },
    filterScroll: {
        paddingHorizontal: 16,
        gap: 8,
        height: 40,
        alignItems: 'center',
    },
    filterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterBadgeActive: {
        elevation: 2,
    },
    filterBadgeText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    summarySubtitle: {
        fontSize: 11,
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 1,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        fontSize: 15,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    customerCard: {
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderRadius: 16,
        elevation: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        marginRight: 16,
        backgroundColor: '#E5E7EB',
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 6,
    },
    phoneText: {
        fontSize: 13,
        color: '#0D9488',
        fontWeight: '600',
        marginLeft: 4,
    },
    phone: {
        fontSize: 13,
        marginBottom: 6,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 2,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    statText: {
        fontSize: 11,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    lastVisitText: {
        fontSize: 11,
        marginTop: 6,
    },
    noteBtn: {
        padding: 6,
    },
    noteContainer: {
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        borderLeftWidth: 4,
    },
    noteText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 80,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    // Modal Overlay
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 350,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    customerName: {
        fontSize: 16,
        color: '#0D9488',
        marginBottom: 16,
        fontWeight: '600',
    },
    noteInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        marginBottom: 20,
        height: 120,
    },
    modalActions: {
        flexDirection: 'row',
    }
});

export default CustomerListScreen;
