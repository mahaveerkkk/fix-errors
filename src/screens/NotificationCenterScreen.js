import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import { useFocusEffect } from '@react-navigation/native';
import { getNotifications, markAsRead, markAllAsRead, clearAllNotifications } from '../utils/notificationStorage';

const NotificationCenterScreen = ({ navigation }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [notifications, setNotifications] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = async () => {
        const data = await getNotifications();
        setNotifications(data);
    };

    // Reload every time screen gets focus
    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        await loadNotifications();
    };

    const handleTapNotification = async (id) => {
        await markAsRead(id);
        await loadNotifications();
    };

    const handleClearAll = async () => {
        await clearAllNotifications();
        setNotifications([]);
    };

    // Relative time formatter
    const getRelativeTime = (isoString) => {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };

    const getIconConfig = (type) => {
        const opacity = isDarkMode ? 0.2 : 0.1;
        switch (type) {
            case 'booking': return { icon: 'calendar', color: '#4CAF50', bg: `rgba(76, 175, 80, ${opacity})` };
            case 'queue': return { icon: 'time', color: '#2196F3', bg: `rgba(33, 150, 243, ${opacity})` };
            case 'review': return { icon: 'star', color: '#FF9800', bg: `rgba(255, 152, 0, ${opacity})` };
            case 'cancel': return { icon: 'close-circle', color: '#F44336', bg: `rgba(244, 67, 54, ${opacity})` };
            case 'summary': return { icon: 'bar-chart', color: '#9C27B0', bg: `rgba(156, 39, 176, ${opacity})` };
            case 'customer': return { icon: 'walk', color: '#00BCD4', bg: `rgba(0, 188, 212, ${opacity})` };
            case 'break': return { icon: 'cafe', color: '#795548', bg: `rgba(121, 85, 72, ${opacity})` };
            default: return { icon: 'notifications', color: theme.colors.text, bg: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' };
        }
    };

    const styles = getStyles(theme, isDarkMode);
    const unreadCount = notifications.filter(n => !n.read).length;

    const renderItem = ({ item }) => {
        const config = getIconConfig(item.type);
        return (
            <TouchableOpacity
                style={[styles.card, !item.read && styles.unreadCard]}
                onPress={() => handleTapNotification(item.id)}
                activeOpacity={0.7}
            >
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                        <Ionicons name={config.icon} size={20} color={config.color} />
                    </View>
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.title, !item.read && styles.unreadTitle]} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.time}>{getRelativeTime(item.time)}</Text>
                        </View>
                        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                    </View>
                </View>
                {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper backgroundColor={theme.colors.background}>
            <Header title="Notifications" showBack />

            {/* Action bar */}
            {notifications.length > 0 && (
                <View style={styles.actionBar}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={handleMarkAllRead} style={styles.actionBtn}>
                            <Ionicons name="checkmark-done" size={16} color={theme.colors.primary} />
                            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Mark all read</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                        <Text style={[styles.actionText, { color: theme.colors.error }]}>Clear all</Text>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off-outline" size={64} color={theme.colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptyText}>Push notifications will appear here</Text>
                    </View>
                }
            />
        </ScreenWrapper>
    );
};

const getStyles = (theme, isDarkMode) => StyleSheet.create({
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 16,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    card: {
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    unreadCard: {
        backgroundColor: isDarkMode ? 'rgba(124, 77, 255, 0.08)' : '#F5F3FF',
        borderColor: theme.colors.primary,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        alignItems: 'center'
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
        marginRight: 8,
    },
    unreadTitle: {
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    time: {
        fontSize: 11,
        color: theme.colors.textSecondary,
    },
    message: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
        marginLeft: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    emptyText: {
        marginTop: 8,
        fontSize: 14,
        color: theme.colors.textSecondary,
    }
});

export default NotificationCenterScreen;

