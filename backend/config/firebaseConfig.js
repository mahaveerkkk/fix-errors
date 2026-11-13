const adminSdk = require('firebase-admin');
require('dotenv').config();

let db = null;
let auth = null;
let adminExport = null;

try {
    // Read Firebase credentials from environment variables only
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error('Missing Firebase credentials in .env file. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }

    const credential = adminSdk.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    console.log('✅ Firebase Admin Initialized using Environment Variables');

    adminSdk.initializeApp({
        credential,
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });

    adminExport = adminSdk;
    db = adminSdk.firestore();
    auth = adminSdk.auth();

} catch (error) {
    console.error('❌ Firebase Init Error:', error.message);
    if (error.code === 'app/invalid-credential' || error.message.includes('private key')) {
        console.error('❌ Invalid Firebase Credentials. Check your .env variables.');
    } else {
        console.error('❌ Firebase Initialization Failed. Details:', error);
    }
}

// Ensure we always export something to avoid backend crashes
module.exports = {
    admin: adminExport || { auth: () => ({ verifyIdToken: () => { throw new Error('Firebase not initialized'); } }) },
    db,
    auth: auth || { verifyIdToken: () => { throw new Error('Firebase not initialized'); } }
};
