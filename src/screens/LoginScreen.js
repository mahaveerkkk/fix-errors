import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator,
    ImageBackground,
    Dimensions,
    Image,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { signInWithGoogle, auth } from '../config/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { loginUser, signupUser, updateUserProfile } from '../services/api';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { requestUserPermission, getFCMToken } from '../services/notificationService';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('user'); // 'user' or 'owner'
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup' (for Email Auth)

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    // Toggle for Email Auth
    const [showEmailAuth, setShowEmailAuth] = useState(false);

    // Premium Background Image
    const bgImage = "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?q=80&w=2574&auto=format&fit=crop";

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: '653960396592-sk154vimkf31emp1t0ic5csvdk9g1ia5.apps.googleusercontent.com',
            offlineAccess: true,
        });
    }, []);

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const userCredential = await signInWithGoogle();
            const idToken = await userCredential.user.getIdToken();

            // Get FCM Token FIRST (before login)
            const permissionGranted = await requestUserPermission();
            let fcmToken = await getFCMToken();

            // Retry loops if token is missing
            if (!fcmToken && permissionGranted) {
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
                    fcmToken = await getFCMToken();
                    if (fcmToken) break;
                }
            }
            // Pass the selected role AND fcmToken to backend
            const response = await loginUser(idToken, selectedRole, fcmToken);
            handleNavigation(response);

        } catch (error) {
            if (error.code !== 'STATUS_CANCELLED') {
                Alert.alert('Login Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async () => {
        if (!email || !password) {
            Alert.alert('Validation', 'Please enter Email and Password');
            return;
        }
        if (authMode === 'signup' && (!name || !phone)) {
            Alert.alert('Validation', 'Please enter Name and Phone');
            return;
        }

        setLoading(true);
        try {
            let idToken;

            if (authMode === 'signup') {
                // SignUp Flow
                const userCredential = await auth().createUserWithEmailAndPassword(email, password);
                idToken = await userCredential.user.getIdToken();

                // Backend Signup
                const response = await signupUser({
                    idToken,
                    role: selectedRole,
                    name,
                    phone
                });

                // For new signup, always treat as setup needed if Owner
                // But handleNavigation checks fields too.
                handleNavigation({
                    user: { ...response.user, role: selectedRole },
                    salon: null
                });

            } else {
                // Login Flow
                const userCredential = await auth().signInWithEmailAndPassword(email, password);
                idToken = await userCredential.user.getIdToken();

                // Get FCM Token for push notifications
                await requestUserPermission();
                const fcmToken = await getFCMToken();

                const response = await loginUser(idToken, null, fcmToken);
                handleNavigation(response);
            }
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigation = async (response) => {
        const { user, salon } = response;

        // Use the ACTUAL role from DB, not the selected role on login screen
        const actualRole = user.role;

        // ---------- ROLE CONVERSION LOCKOUT GATES ----------
        // TODO: Baad mein accha flow banayenge — abhi commented out
        // If user selected 'owner' but DB role is 'user', prompt them to upgrade or continue as user
        /*
        if (selectedRole === 'owner' && actualRole === 'user') {
            Alert.alert(
                'Upgrade Account 🚀',
                'Aapka account pehle se Customer ke roop me register hai. Kya aap is account ko Salon Owner me upgrade karke apna Salon register karna chahte hain?',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'UserHome', params: { user } }],
                            });
                        }
                    },
                    {
                        text: 'Upgrade & Continue',
                        onPress: async () => {
                            setLoading(true);
                            try {
                                const upgradeRes = await updateUserProfile(user.id || user._id, { role: 'owner' });
                                const updatedUser = { ...user, role: 'owner' };
                                await AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
                                navigation.replace('SalonSetup', { user: updatedUser, salon: null });
                            } catch (err) {
                                Alert.alert('Upgrade Failed', err.message);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
            return;
        }
        */

        // Cache user & salon data for offline/slow-network auto-login
        try {
            await AsyncStorage.setItem('cachedUser', JSON.stringify(user));
            if (salon) await AsyncStorage.setItem('cachedSalon', JSON.stringify(salon));
            else await AsyncStorage.removeItem('cachedSalon');
        } catch (cacheErr) {
        }

        // ---------- EXISTING SALON OWNER ----------
        // If user has a salon, they are an owner, send to dashboard
        if (salon) {
            if (user.salonSetupCompleted) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'SalonTabs', params: { user, salon } }],
                });
            } else {
                navigation.replace('SalonSetup', { user, salon });
            }
            return;
        }

        // ---------- EXISTING USER (No Salon) ----------
        // If DB role is 'owner' OR salonSetupCompleted but no salon => send to SalonSetup
        if ((actualRole === 'owner' || user.salonSetupCompleted) && !salon) {
            navigation.replace('SalonSetup', { user, salon: null });
            return;
        }

        // If DB role is 'user', go to UserHome (or UserProfileSetup if profile is incomplete)
        if (actualRole === 'user' || (user.name && user.phone)) {
            if (!user.name || !user.phone) {
                navigation.replace('UserProfileSetup', { user });
            } else {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'UserHome', params: { user } }],
                });
            }
            return;
        }

        // ---------- FALLBACK FOR NEW USER (From Signup) ----------
        // If selected role was 'owner' but they don't have a salon yet
        if (selectedRole === 'owner') {
            navigation.replace('SalonSetup', { user, salon: null });
        } else {
            // Default: Go to User profile setup or home
            if (!user.name || !user.phone) {
                navigation.replace('UserProfileSetup', { user });
            } else {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'UserHome', params: { user } }],
                });
            }
        }
    };

    return (
        <ImageBackground source={{ uri: bgImage }} style={styles.backgroundImage} blurRadius={5}>
            <View style={styles.overlay} />
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                        {/* Header Section */}
                        <View style={styles.header}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="cut" size={40} color="#fff" />
                            </View>
                            <Text style={styles.appTitle}>StylQ</Text>
                            <Text style={styles.appTagline}>Style, Scheduled.</Text>
                        </View>

                        {/* Role Selection */}
                        <View style={styles.roleContainer}>
                            <View style={styles.toggleWrapper}>
                                <TouchableOpacity
                                    style={[styles.roleOption, selectedRole === 'user' && styles.activeRole]}
                                    onPress={() => setSelectedRole('user')}
                                >
                                    <Ionicons name="person" size={18} color={selectedRole === 'user' ? '#000' : '#ccc'} />
                                    <Text style={[styles.roleText, selectedRole === 'user' && styles.activeRoleText]}>Customer</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleOption, selectedRole === 'owner' && styles.activeRole]}
                                    onPress={() => setSelectedRole('owner')}
                                >
                                    <Ionicons name="storefront" size={18} color={selectedRole === 'owner' ? '#000' : '#ccc'} />
                                    <Text style={[styles.roleText, selectedRole === 'owner' && styles.activeRoleText]}>Salon Owner</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Auth Form Container */}
                        <View style={styles.authCard}>

                            {/* Google Login (Primary) */}
                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <>
                                        <Image
                                            source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
                                            style={styles.googleIcon}
                                        />
                                        <Text style={styles.googleButtonText}>Continue with Google</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                        </View>

                        <Text style={styles.footerText}>
                            By continuing, you agree to our Terms & Privacy Policy.
                        </Text>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)', // Darker overlay for premium feel
    },
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    appTagline: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 5,
        letterSpacing: 0.5,
    },
    roleContainer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    toggleWrapper: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 4,
        width: '80%',
    },
    roleOption: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },
    activeRole: {
        backgroundColor: '#fff',
    },
    roleText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    activeRoleText: {
        color: '#000',
    },
    authCard: {
        width: '100%',
    },
    googleButton: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    googleIcon: {
        width: 24,
        height: 24,
        marginRight: 10,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    orText: {
        color: 'rgba(255,255,255,0.5)',
        marginHorizontal: 10,
        fontSize: 12,
    },
    emailButton: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    emailButtonText: {
        color: '#fff',
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '600',
    },
    emailForm: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        padding: 5,
        marginRight: 10
    },
    formTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    submitButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchModeBtn: {
        marginTop: 20,
        alignItems: 'center',
    },
    switchModeText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    footerText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 40,
    }
});

export default LoginScreen;
