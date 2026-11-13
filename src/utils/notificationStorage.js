import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@notifications';
const MAX_AGE_DAYS = 7;

/**
 * Save a new notification to AsyncStorage
 */
export const saveNotification = async (title, body, type = 'system') => {
    try {
        const existing = await getNotifications();
        const newNotification = {
            id: Date.now().toString(),
            title,
            message: body,
            time: new Date().toISOString(),
            read: false,
            type, // booking, queue, system, review, etc.
        };
        const updated = [newNotification, ...existing];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return newNotification;
    } catch (e) {
    }
};

/**
 * Get all notifications (auto-cleans old ones > 7 days)
 */
export const getNotifications = async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const all = JSON.parse(raw);

        // Auto-cleanup: remove notifications older than 7 days
        const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        const filtered = all.filter(n => new Date(n.time).getTime() > cutoff);

        // Save cleaned list if anything was removed
        if (filtered.length !== all.length) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }

        return filtered;
    } catch (e) {
        return [];
    }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async () => {
    const notifications = await getNotifications();
    return notifications.filter(n => !n.read).length;
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId) => {
    try {
        const notifications = await getNotifications();
        const updated = notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
    }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async () => {
    try {
        const notifications = await getNotifications();
        const updated = notifications.map(n => ({ ...n, read: true }));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
    }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
};

/**
 * Detect notification type from title
 */
export const detectType = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('booking') || t.includes('accepted') || t.includes('rejected') || t.includes('confirmed')) return 'booking';
    if (t.includes('turn') || t.includes('queue') || t.includes('ready') || t.includes('coming soon') || t.includes('reminder')) return 'queue';
    if (t.includes('review') || t.includes('rate') || t.includes('⭐')) return 'review';
    if (t.includes('cancelled') || t.includes('cancel')) return 'cancel';
    if (t.includes('summary') || t.includes('📊')) return 'summary';
    if (t.includes('on the way') || t.includes('delayed') || t.includes('customer')) return 'customer';
    if (t.includes('break')) return 'break';
    return 'system';
};
