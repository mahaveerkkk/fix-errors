import Sound from 'react-native-sound';

// Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

let notificationSound = null;

// Load sound on app start
export const loadNotificationSound = () => {
    notificationSound = new Sound('notification_sound.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
            return;
        }
    });
};

// Play notification sound
export const playNotificationSound = () => {
    if (notificationSound) {
        notificationSound.stop(() => {
            notificationSound.play((success) => {
                if (success) {
                } else {
                }
            });
        });
    } else {
        loadNotificationSound();
    }
};

// Release sound when app closes
export const releaseSound = () => {
    if (notificationSound) {
        notificationSound.release();
        notificationSound = null;
    }
};
