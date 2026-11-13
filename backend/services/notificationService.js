const { admin } = require('../config/firebaseConfig');

const sendNotification = async (fcmToken, title, body) => {
    if (!fcmToken) {
        return;
    }
    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: {
                title: title,
                body: body
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    // Let Android use the default/fallback channel since we can't create one on frontend
                }
            }
        });
    } catch (error) {
    }
};

module.exports = { sendNotification };
