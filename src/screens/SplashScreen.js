import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Dimensions, StatusBar,
    Animated, Easing
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { auth } from '../config/firebase';
import { loginUser } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {

    // Animations
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoRotate = useRef(new Animated.Value(0)).current;
    const brandOpacity = useRef(new Animated.Value(0)).current;
    const brandSlide = useRef(new Animated.Value(30)).current;
    const quoteOpacity = useRef(new Animated.Value(0)).current;
    const quoteSlide = useRef(new Animated.Value(20)).current;
    const lineWidth = useRef(new Animated.Value(0)).current;
    const loaderOpacity = useRef(new Animated.Value(0)).current;
    const footerOpacity = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const shimmerAnim = useRef(new Animated.Value(-width)).current;

    // Helper: Navigate based on user/salon data
    const navigateUser = (user, salon) => {
        if (salon || user.role === 'owner' || user.salonSetupCompleted) {
            if (user.salonSetupCompleted && salon) {
                navigation.replace('SalonTabs', { user, salon });
            } else {
                navigation.replace('SalonSetup', { user, salon });
            }
        } else {
            if (!user.name || !user.phone) {
                navigation.replace('UserProfileSetup', { user });
            } else {
                navigation.replace('UserHome', { user });
            }
        }
    };

    useEffect(() => {
        // ========= ANIMATION SEQUENCE =========
        // 1. Logo scale + rotate in
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 5,
                tension: 60,
                useNativeDriver: true,
            }),
            Animated.timing(logoRotate, {
                toValue: 1,
                duration: 800,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
        ]).start();

        // 2. Brand name slide up + fade in
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(brandOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(brandSlide, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }, 400);

        // 3. Decorative line expand
        setTimeout(() => {
            Animated.timing(lineWidth, {
                toValue: 1,
                duration: 500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();
        }, 800);

        // 4. Quote fade in
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(quoteOpacity, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(quoteSlide, {
                    toValue: 0,
                    duration: 700,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }, 1100);

        // 5. Loader + footer
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(loaderOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(footerOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            // Pulse loop for logo
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }, 1600);

        // Shimmer loop
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: width,
                duration: 2500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // ========= AUTH LOGIC WITH FIREBASE STATE LISTENER =========
        const init = async () => {
            let unsubscribe = null;
            let resolved = false;

            try {
                // Ensure the minimum splash animation duration (3 seconds) completes
                await new Promise(resolve => setTimeout(resolve, 3000));

                const checkAuthState = () => {
                    return new Promise((resolve) => {
                        // 1. Listen for active Firebase Auth state sync
                        unsubscribe = auth().onAuthStateChanged((user) => {
                            resolve(user);
                        });

                        // 2. Safeguard timeout: If Firebase state takes too long, fall back to current status
                        setTimeout(() => {
                            if (!resolved) {
                                resolve(auth().currentUser);
                            }
                        }, 2000);
                    });
                };

                const firebaseUser = await checkAuthState();
                resolved = true;
                if (unsubscribe) unsubscribe();

                if (firebaseUser) {
                    const idToken = await firebaseUser.getIdToken();
                    try {
                        const response = await Promise.race([
                            loginUser(idToken),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('API_TIMEOUT')), 10000)
                            )
                        ]);
                        navigateUser(response.user, response.salon);
                    } catch (apiError) {
                        // Network error or timeout: fall back to secure offline storage
                        const cachedUserStr = await AsyncStorage.getItem('cachedUser');
                        const cachedSalonStr = await AsyncStorage.getItem('cachedSalon');

                        if (cachedUserStr) {
                            const cachedUser = JSON.parse(cachedUserStr);
                            const cachedSalon = cachedSalonStr ? JSON.parse(cachedSalonStr) : null;
                            navigateUser(cachedUser, cachedSalon);
                        } else {
                            navigation.replace('UserHome', { user: null });
                        }
                    }
                } else {
                    // No user session: Check cached user or redirect to landing
                    const cachedUserStr = await AsyncStorage.getItem('cachedUser');
                    if (cachedUserStr) {
                        const cachedUser = JSON.parse(cachedUserStr);
                        const cachedSalonStr = await AsyncStorage.getItem('cachedSalon');
                        const cachedSalon = cachedSalonStr ? JSON.parse(cachedSalonStr) : null;
                        navigateUser(cachedUser, cachedSalon);
                    } else {
                        navigation.replace('UserHome', { user: null });
                    }
                }
            } catch (error) {
                if (unsubscribe) unsubscribe();
                try {
                    const cachedUserStr = await AsyncStorage.getItem('cachedUser');
                    if (cachedUserStr) {
                        const cachedUser = JSON.parse(cachedUserStr);
                        const cachedSalonStr = await AsyncStorage.getItem('cachedSalon');
                        const cachedSalon = cachedSalonStr ? JSON.parse(cachedSalonStr) : null;
                        navigateUser(cachedUser, cachedSalon);
                        return;
                    }
                } catch (cacheErr) { /* ignore */ }
                navigation.replace('UserHome', { user: null });
            }
        };

        init();
    }, []);

    const logoRotateInterpolate = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['-45deg', '0deg'],
    });

    const lineWidthInterpolate = lineWidth.interpolate({
        inputRange: [0, 1],
        outputRange: [0, width * 0.3],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

            {/* Subtle background pattern */}
            <View style={styles.bgPattern}>
                <View style={[styles.bgCircle, styles.bgCircle1]} />
                <View style={[styles.bgCircle, styles.bgCircle2]} />
                <View style={[styles.bgCircle, styles.bgCircle3]} />
            </View>

            <View style={styles.content}>
                {/* Animated Logo */}
                <Animated.View style={[
                    styles.logoContainer,
                    {
                        transform: [
                            { scale: Animated.multiply(logoScale, pulseAnim) },
                            { rotate: logoRotateInterpolate },
                        ],
                    }
                ]}>
                    <View style={styles.outerRing}>
                        <LinearGradient
                            colors={['#D4AF37', '#F5E7A3', '#D4AF37']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.innerCircle}
                        >
                            <Ionicons name="cut" size={38} color="#1A1A1A" />
                        </LinearGradient>
                    </View>
                    {/* Shimmer on logo */}
                    <Animated.View
                        style={[styles.logoShimmer, { transform: [{ translateX: shimmerAnim }] }]}
                    />
                </Animated.View>

                {/* Brand Name */}
                <Animated.View style={{
                    opacity: brandOpacity,
                    transform: [{ translateY: brandSlide }],
                    alignItems: 'center',
                    marginTop: 20,
                }}>
                    <Text style={styles.brandName}>
                        Styl<Text style={styles.brandAccent}>Q</Text>
                    </Text>
                    <Text style={styles.tagline}>SMART SALON BOOKING</Text>
                </Animated.View>

                {/* Decorative Lines */}
                <View style={styles.lineContainer}>
                    <Animated.View style={[styles.decorLine, { width: lineWidthInterpolate }]} />
                    <View style={styles.diamondDot}>
                        <View style={styles.diamondInner} />
                    </View>
                    <Animated.View style={[styles.decorLine, { width: lineWidthInterpolate }]} />
                </View>

                {/* Quote */}
                <Animated.View style={{
                    opacity: quoteOpacity,
                    transform: [{ translateY: quoteSlide }],
                    marginTop: 28,
                    paddingHorizontal: 30,
                }}>
                    <Text style={styles.quoteOpen}>"</Text>
                    <Text style={styles.quoteText}>
                        I can't change the world,{"\n"}
                        but I can change your{" "}
                        <Text style={styles.quoteHighlight}>look</Text>.
                    </Text>
                    <Text style={styles.quoteClose}>"</Text>
                </Animated.View>

                {/* Loading Indicator */}
                <Animated.View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
                    <View style={styles.customLoader}>
                        <View style={styles.loaderDot} />
                        <View style={[styles.loaderDot, styles.loaderDot2]} />
                        <View style={[styles.loaderDot, styles.loaderDot3]} />
                    </View>
                </Animated.View>
            </View>

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
                <View style={styles.footerLine} />
                <Text style={styles.footerText}>STYLQ PREMIUM • v1.0.0</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bgPattern: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    bgCircle: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.06)',
    },
    bgCircle1: {
        width: 400,
        height: 400,
        top: -100,
        right: -100,
    },
    bgCircle2: {
        width: 300,
        height: 300,
        bottom: -50,
        left: -80,
    },
    bgCircle3: {
        width: 200,
        height: 200,
        top: height * 0.3,
        left: width * 0.6,
    },
    content: {
        alignItems: 'center',
        width: '100%',
    },
    // Logo
    logoContainer: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 100,
    },
    outerRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        borderWidth: 2,
        borderColor: '#D4AF37',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        elevation: 10,
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    innerCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoShimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 30,
        backgroundColor: 'rgba(255,255,255,0.3)',
        transform: [{ skewX: '-20deg' }],
    },
    // Brand
    brandName: {
        fontSize: 52,
        fontWeight: '800',
        color: '#1A1A1A',
        letterSpacing: 2,
    },
    brandAccent: {
        color: '#D4AF37',
        fontWeight: '900',
    },
    tagline: {
        fontSize: 11,
        color: '#999',
        letterSpacing: 4,
        fontWeight: '600',
        marginTop: 4,
    },
    // Decorative Line
    lineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
    },
    decorLine: {
        height: 1,
        backgroundColor: '#D4AF37',
        opacity: 0.4,
    },
    diamondDot: {
        width: 10,
        height: 10,
        transform: [{ rotate: '45deg' }],
        backgroundColor: '#D4AF37',
        marginHorizontal: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    diamondInner: {
        width: 4,
        height: 4,
        backgroundColor: '#FAFAFA',
        transform: [{ rotate: '0deg' }],
    },
    // Quote
    quoteOpen: {
        fontSize: 40,
        color: '#D4AF37',
        fontWeight: '300',
        lineHeight: 40,
        opacity: 0.4,
        marginLeft: 10,
    },
    quoteText: {
        fontSize: 19,
        color: '#555',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 30,
        fontWeight: '400',
        letterSpacing: 0.3,
        marginTop: -8,
    },
    quoteHighlight: {
        color: '#D4AF37',
        fontWeight: '700',
        fontStyle: 'italic',
    },
    quoteClose: {
        fontSize: 40,
        color: '#D4AF37',
        fontWeight: '300',
        lineHeight: 40,
        opacity: 0.4,
        textAlign: 'right',
        marginRight: 10,
        marginTop: -4,
    },
    // Loader
    loaderContainer: {
        marginTop: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customLoader: {
        flexDirection: 'row',
        gap: 8,
    },
    loaderDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D4AF37',
        opacity: 0.3,
    },
    loaderDot2: {
        opacity: 0.6,
    },
    loaderDot3: {
        opacity: 1,
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        alignItems: 'center',
    },
    footerLine: {
        width: 40,
        height: 1,
        backgroundColor: '#D4AF37',
        opacity: 0.3,
        marginBottom: 10,
    },
    footerText: {
        color: '#BBB',
        fontSize: 10,
        letterSpacing: 2.5,
        fontWeight: '600',
    },
});

export default SplashScreen;
