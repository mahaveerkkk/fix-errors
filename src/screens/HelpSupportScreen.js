import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, FlatList
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import { submitSupportTicket, getUserTickets } from '../services/api';

const CATEGORIES = [
    { label: 'Booking Issue', value: 'booking', icon: 'calendar-outline', color: '#4CAF50' },
    { label: 'Payment Issue', value: 'payment', icon: 'card-outline', color: '#FF9800' },
    { label: 'Account Issue', value: 'account', icon: 'person-outline', color: '#2196F3' },
    { label: 'Salon Issue', value: 'salon', icon: 'cut-outline', color: '#9C27B0' },
    { label: 'App Bug', value: 'app_bug', icon: 'bug-outline', color: '#F44336' },
    { label: 'Other', value: 'other', icon: 'help-circle-outline', color: '#607D8B' },
];

const HelpSupportScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const user = route.params?.user;

    const [activeTab, setActiveTab] = useState('submit'); // submit | history
    const [category, setCategory] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    useEffect(() => {
        if (activeTab === 'history' && user?._id) {
            fetchTickets();
        }
    }, [activeTab]);

    const fetchTickets = async () => {
        setLoadingTickets(true);
        try {
            const data = await getUserTickets(user._id);
            setTickets(data);
        } catch (error) {
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleSubmit = async () => {
        if (!category) return Alert.alert('Error', 'Please select a category');
        if (!subject.trim()) return Alert.alert('Error', 'Please enter a subject');
        if (!description.trim()) return Alert.alert('Error', 'Please describe your issue');

        setSubmitting(true);
        try {
            await submitSupportTicket({
                userId: user?._id,
                userName: user?.name,
                userEmail: user?.email,
                userPhone: user?.phone,
                category,
                subject: subject.trim(),
                description: description.trim(),
            });
            Alert.alert(
                '✅ Ticket Submitted!',
                'We have received your issue. Our team will look into it and get back to you soon.',
                [{ text: 'OK', onPress: () => { setCategory(''); setSubject(''); setDescription(''); } }]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit ticket. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#FF9800';
            case 'in_progress': return '#2196F3';
            case 'resolved': return '#4CAF50';
            case 'closed': return '#9E9E9E';
            default: return '#FF9800';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'open': return 'Open';
            case 'in_progress': return 'In Progress';
            case 'resolved': return 'Resolved';
            case 'closed': return 'Closed';
            default: return status;
        }
    };

    const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const renderSubmitForm = () => (
        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* Category Selection */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Select Category</Text>
            <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                        key={cat.value}
                        style={[
                            styles.categoryItem,
                            { backgroundColor: theme.colors.surface, borderColor: category === cat.value ? cat.color : theme.colors.border }
                        ]}
                        onPress={() => setCategory(cat.value)}
                    >
                        <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                            <Ionicons name={cat.icon} size={22} color={cat.color} />
                        </View>
                        <Text style={[styles.categoryLabel, { color: category === cat.value ? cat.color : theme.colors.text }]}>
                            {cat.label}
                        </Text>
                        {category === cat.value && (
                            <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
                                <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Subject */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Subject</Text>
            <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Brief summary of your issue"
                placeholderTextColor={theme.colors.textLight}
                value={subject}
                onChangeText={setSubject}
                maxLength={100}
            />

            {/* Description */}
            <Text style={[styles.label, { color: theme.colors.text }]}>Describe Your Issue</Text>
            <TextInput
                style={[styles.textArea, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Tell us what happened in detail..."
                placeholderTextColor={theme.colors.textLight}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
            />
            <Text style={[styles.charCount, { color: theme.colors.textLight }]}>
                {description.length}/1000
            </Text>

            {/* Submit Button */}
            <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <Ionicons name="send-outline" size={18} color="#FFF" />
                        <Text style={styles.submitBtnText}>Submit Ticket</Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Contact Info */}
            <View style={[styles.contactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.contactTitle, { color: theme.colors.text }]}>Other Ways to Reach Us</Text>
                <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>support@styleq.app</Text>
                </View>
                <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>+91 98765 43210</Text>
                </View>
                <View style={styles.contactRow}>
                    <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>Mon-Sat, 9 AM - 6 PM IST</Text>
                </View>
            </View>
        </ScrollView>
    );

    const renderTicketItem = ({ item }) => (
        <View style={[styles.ticketCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.ticketHeader}>
                <View style={styles.ticketCategory}>
                    <Ionicons
                        name={CATEGORIES.find(c => c.value === item.category)?.icon || 'help-circle-outline'}
                        size={16}
                        color={CATEGORIES.find(c => c.value === item.category)?.color || '#607D8B'}
                    />
                    <Text style={[styles.ticketCategoryText, { color: theme.colors.textSecondary }]}>
                        {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>
            <Text style={[styles.ticketSubject, { color: theme.colors.text }]}>{item.subject}</Text>
            <Text style={[styles.ticketDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {item.description}
            </Text>
            <Text style={[styles.ticketDate, { color: theme.colors.textLight }]}>
                {formatDate(item.createdAt)}
            </Text>
        </View>
    );

    const renderHistory = () => (
        <View style={{ flex: 1 }}>
            {loadingTickets ? (
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            ) : tickets.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="ticket-outline" size={50} color={theme.colors.textLight} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No tickets yet</Text>
                    <Text style={[styles.emptySubText, { color: theme.colors.textLight }]}>
                        Your submitted issues will appear here
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    renderItem={renderTicketItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );

    return (
        <ScreenWrapper>
            <Header title="Help & Support" showBack />

            {/* Tab Switch */}
            <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'submit' && styles.activeTab]}
                    onPress={() => setActiveTab('submit')}
                >
                    <Ionicons name="create-outline" size={18} color={activeTab === 'submit' ? theme.colors.primary : theme.colors.textLight} />
                    <Text style={[styles.tabText, { color: activeTab === 'submit' ? theme.colors.primary : theme.colors.textLight }]}>
                        Report Issue
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                    onPress={() => setActiveTab('history')}
                >
                    <Ionicons name="time-outline" size={18} color={activeTab === 'history' ? theme.colors.primary : theme.colors.textLight} />
                    <Text style={[styles.tabText, { color: activeTab === 'history' ? theme.colors.primary : theme.colors.textLight }]}>
                        My Tickets
                    </Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'submit' ? renderSubmitForm() : renderHistory()}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#F59E0B',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    formContent: {
        padding: 20,
        paddingBottom: 40,
    },
    label: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 10,
        marginTop: 8,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    categoryItem: {
        width: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        position: 'relative',
    },
    categoryIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    categoryLabel: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    checkBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        marginBottom: 16,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        minHeight: 140,
    },
    charCount: {
        fontSize: 11,
        textAlign: 'right',
        marginTop: 4,
        marginBottom: 20,
    },
    submitBtn: {
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
        marginBottom: 24,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    contactCard: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    contactTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 12,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    contactText: {
        fontSize: 14,
    },
    ticketCard: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    ticketCategory: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ticketCategoryText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    ticketSubject: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    ticketDesc: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    ticketDate: {
        fontSize: 11,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubText: {
        fontSize: 13,
        marginTop: 4,
    },
});

export default HelpSupportScreen;
