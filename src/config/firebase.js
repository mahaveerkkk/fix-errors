import app from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { ENV } from './env';

// Check if firebase app is initialized
if (!app.apps.length) {
    const firebaseConfig = {
        apiKey: ENV.FIREBASE_API_KEY,
        authDomain: ENV.FIREBASE_AUTH_DOMAIN,
        projectId: ENV.FIREBASE_PROJECT_ID,
        storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
        appId: ENV.FIREBASE_APP_ID,
        databaseURL: ENV.FIREBASE_DATABASE_URL
    };
    try {
        app.initializeApp(firebaseConfig);
    } catch (e) {
    }
}

// Ensure messaging is supported
try {
    messaging();
} catch (e) {
}

// Configure Google Sign-In
const configureGoogleSignIn = () => {
    GoogleSignin.configure({
        webClientId: '653960396592-sk154vimkf31emp1t0ic5csvdk9g1ia5.apps.googleusercontent.com',
        offlineAccess: true,
    });
};

export const signInWithGoogle = async () => {
    try {
        configureGoogleSignIn();

        await GoogleSignin.hasPlayServices();
        const signInResult = await GoogleSignin.signIn();
        let idToken = signInResult.idToken;
        if (!idToken && signInResult.data) {
            idToken = signInResult.data.idToken;
        }

        if (!idToken) {
            throw new Error('No ID token found');
        }

        const googleCredential = auth.GoogleAuthProvider.credential(idToken);
        return auth().signInWithCredential(googleCredential);
    } catch (error) {
        throw error;
    }
};

export const signOut = async () => {
    try {
        configureGoogleSignIn(); // Fix: Configure before sign out
        await GoogleSignin.signOut();
        await auth().signOut();
    } catch (error) {
    }
};

export { auth, messaging };
