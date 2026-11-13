import { messaging } from '../config/firebase';
import { Platform, Alert } from 'react-native';
import { playNotificationSound, loadNotificationSound } from './soundService';
import { saveNotification, detectType } from '../utils/notificationStorage';

export const requestUserPermission = async () => {
    try {
        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
            // Load sound after permission granted
            loadNotificationSound();
            return true;
        }
    } catch (error) {
    }
    return false;
};

export const getFCMToken = async () => {
    try {
        const token = await messaging().getToken();
        if (token) {
            return token;
        }
    } catch (error) {
    }
    return null;
};

export const notificationListener = () => {
    // Load sound on listener init
    loadNotificationSound();

    messaging().onNotificationOpenedApp(remoteMessage => {
        /* removed */
        if (remoteMessage.notification) {
            const { title, body } = remoteMessage.notification;
            saveNotification(title, body, detectType(title));
        }
    });

    // Handle foreground messages - Play sound + Save to local storage
    messaging().onMessage(async remoteMessage => {
        const { notification } = remoteMessage;
        if (notification && notification.title) {
            // Save notification to AsyncStorage
            await saveNotification(notification.title, notification.body, detectType(notification.title));

            const title = notification.title.toLowerCase();

            // Play sound for these events:
            if (title.includes('accepted') ||
                title.includes('rejected') ||
                title.includes('new booking') ||
                title.includes('booking request') ||
                title.includes('appointment reminder') ||
                title.includes('your turn') ||
                title.includes('get ready') ||
                title.includes('coming soon') ||
                title.includes('today\'s summary') ||
                title.includes('upcoming customer')) {
                playNotificationSound();
            }
        }
    });

    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                /* removed */
                if (remoteMessage.notification) {
                    const { title, body } = remoteMessage.notification;
                    saveNotification(title, body, detectType(title));
                }
            }
        });
};
