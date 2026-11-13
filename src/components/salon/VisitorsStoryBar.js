import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Modal,
    ActivityIndicator,
    Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';
import { getTodayVisitors } from '../../services/api';

const VisitorsStoryBar = ({ salonId }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [visitors, setVisitors] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        if (salonId) {
            fetchVisitors();
        }
    }, [salonId]);

    const fetchVisitors = async () => {
        try {
            const data = await getTodayVisitors(salonId);
            if (data?.visitors) {
                setVisitors(data.visitors);
                setTotalCount(data.totalVisitorsToday || data.visitors.length);
            }
        } catch (error) {
            console.log('Fetch visitors error:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return 'Recently';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMins = Math.floor((now - d) / (1000 * 60));
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return 'Yesterday';
    };

    if (loading) return null;
    if (visitors.length === 0) return null;

    return (
        <View style={styles.container}>
            {/* SECTION HEADER */}
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>👀</Text>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Today's Profile Visitors</Text>
                    <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{totalCount}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.7}>
                    <Text style={{ color: '#7C4DFF', fontSize: 12, fontWeight: 'bold' }}>See All ({totalCount})</Text>
                </TouchableOpacity>
            </View>

            {/* HORIZONTAL INSTAGRAM STORY AVATARS STRIP */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
                {visitors.map((item, index) => {
                    const user = item.user || {};
                    const avatarUrl = user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=7C4DFF&color=fff&bold=true`;
                    const timeText = formatTimeAgo(item.viewedAt);

                    return (
                        <TouchableOpacity
                            key={item._id || index}
                            style={styles.avatarItem}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            {/* GRADIENT STORY RING */}
                            <View style={styles.storyRingGradient}>
                                <View style={[styles.avatarInnerBg, { backgroundColor: theme.colors.background }]}>
                                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                                </View>
                            </View>

                            <Text style={[styles.visitorName, { color: theme.colors.text }]} numberOfLines={1}>
                                {user.name ? user.name.split(' ')[0] : 'Visitor'}
                            </Text>
                            <Text style={[styles.visitorTime, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                {timeText}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* FULL VISITORS MODAL */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="eye-outline" size={22} color="#7C4DFF" />
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Profile Visitors Today</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 16 }}>
                            {visitors.map((item, index) => {
                                const user = item.user || {};
                                const avatarUrl = user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=7C4DFF&color=fff&bold=true`;
                                const phone = user.phone || user.phoneNumber;

                                return (
                                    <View key={item._id || index} style={[styles.visitorListRow, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F9F9FC', borderColor: isDarkMode ? '#333' : '#EEE' }]}>
                                        <Image source={{ uri: avatarUrl }} style={styles.modalAvatar} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.modalVisitorName, { color: theme.colors.text }]}>{user.name || 'Anonymous Visitor'}</Text>
                                            <Text style={[styles.modalVisitorTime, { color: theme.colors.textSecondary }]}>
                                                Viewed profile {formatTimeAgo(item.viewedAt)}
                                            </Text>
                                        </View>

                                        {phone && (
                                            <TouchableOpacity
                                                style={styles.callBtn}
                                                onPress={() => Linking.openURL(`tel:${phone}`)}
                                            >
                                                <Ionicons name="call" size={16} color="#4CAF50" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    badgePill: {
        backgroundColor: 'rgba(124, 77, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#7C4DFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    avatarItem: {
        alignItems: 'center',
        marginRight: 14,
        width: 64,
    },
    storyRingGradient: {
        width: 58,
        height: 58,
        borderRadius: 29,
        padding: 2.5,
        backgroundColor: '#7C4DFF', // Glowing story ring
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    avatarInnerBg: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: 49,
        height: 49,
        borderRadius: 24.5,
    },
    visitorName: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    visitorTime: {
        fontSize: 9,
        textAlign: 'center',
        marginTop: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    visitorListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    modalAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    modalVisitorName: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    modalVisitorTime: {
        fontSize: 11,
        marginTop: 2,
    },
    callBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default VisitorsStoryBar;
