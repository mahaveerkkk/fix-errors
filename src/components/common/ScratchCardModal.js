import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    Animated, Dimensions, PanResponder
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const SCRATCH_THRESHOLD = 4; // Number of touch moves to reveal

const ScratchCardModal = ({ visible, card, onScratch, onClose }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [isScratched, setIsScratched] = useState(false);
    const [revealedAmount, setRevealedAmount] = useState(null);

    // Use refs for PanResponder access (avoids stale closure)
    const isScratchedRef = useRef(false);
    const scratchCountRef = useRef(0);

    // Animations
    const overlayOpacity = useRef(new Animated.Value(1)).current;
    const cardScale = useRef(new Animated.Value(0.8)).current;
    const amountScale = useRef(new Animated.Value(0)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const sparkleOpacity = useRef(new Animated.Value(0)).current;
    const dotAnims = useRef([
        new Animated.Value(0.2),
        new Animated.Value(0.2),
        new Animated.Value(0.2),
        new Animated.Value(0.2),
        new Animated.Value(0.2),
    ]).current;
    const confettiAnims = useRef(
        Array.from({ length: 12 }, () => ({
            translateY: new Animated.Value(0),
            translateX: new Animated.Value(0),
            opacity: new Animated.Value(0),
            rotate: new Animated.Value(0),
        }))
    ).current;

    // Reset state when card changes
    useEffect(() => {
        if (visible && card) {
            setIsScratched(false);
            setRevealedAmount(null);
            isScratchedRef.current = false;
            scratchCountRef.current = 0;
            overlayOpacity.setValue(1);
            cardScale.setValue(0.8);
            amountScale.setValue(0);
            sparkleOpacity.setValue(0);
            dotAnims.forEach(d => d.setValue(0.2));

            // Reset confetti
            confettiAnims.forEach(anim => {
                anim.translateX.setValue(0);
                anim.translateY.setValue(0);
                anim.opacity.setValue(0);
                anim.rotate.setValue(0);
            });

            // Entry animation
            Animated.spring(cardScale, {
                toValue: 1,
                friction: 6,
                tension: 80,
                useNativeDriver: true,
            }).start();

            // Shimmer loop
            shimmerAnim.setValue(0);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerAnim, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [visible, card]);

    const triggerReveal = useCallback((amount) => {
        if (isScratchedRef.current) return;
        isScratchedRef.current = true;

        setRevealedAmount(amount);
        setIsScratched(true);

        // Fade scratch overlay
        Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
        }).start();

        // Pop amount
        Animated.sequence([
            Animated.spring(amountScale, {
                toValue: 1.2,
                friction: 4,
                tension: 100,
                useNativeDriver: true,
            }),
            Animated.spring(amountScale, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();

        // Sparkle
        Animated.loop(
            Animated.sequence([
                Animated.timing(sparkleOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(sparkleOpacity, {
                    toValue: 0.3,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]),
            { iterations: 5 }
        ).start();

        // Confetti burst
        confettiAnims.forEach((anim, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const distance = 80 + Math.random() * 60;
            const targetX = Math.cos(angle) * distance;
            const targetY = Math.sin(angle) * distance - 40;

            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateX, {
                    toValue: targetX,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateY, {
                    toValue: targetY,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.rotate, {
                    toValue: Math.random() * 4,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                Animated.timing(anim.opacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }).start();
            });
        });

        // Call onScratch callback
        if (onScratch && card) {
            onScratch(card);
        }
    }, [card, onScratch]);

    // Animate dots on scratch progress
    const animateDot = useCallback((index) => {
        Animated.timing(dotAnims[index], {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [dotAnims]);

    // PanResponder for scratch gesture — using refs to avoid stale closure
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Respond to any movement
                return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
            },
            onPanResponderGrant: () => {
                // Touch started on scratch area
                if (isScratchedRef.current) return;
                scratchCountRef.current += 1;
            },
            onPanResponderMove: () => {
                if (isScratchedRef.current) return;
                scratchCountRef.current += 1;
            },
            onPanResponderRelease: () => {
                // Check on release too
            },
        })
    ).current;

    // Use a separate effect + interval to check scratch progress
    // This avoids the stale closure problem entirely
    useEffect(() => {
        if (!visible || !card) return;

        const interval = setInterval(() => {
            if (isScratchedRef.current) {
                clearInterval(interval);
                return;
            }

            const count = scratchCountRef.current;

            // Animate dots based on progress
            if (count >= 1 && count < SCRATCH_THRESHOLD) {
                const dotIndex = Math.min(Math.floor(count / (SCRATCH_THRESHOLD / 5)), 4);
                for (let i = 0; i <= dotIndex; i++) {
                    animateDot(i);
                }
            }

            // Check threshold
            if (count >= SCRATCH_THRESHOLD && card) {
                triggerReveal(card.amount);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [visible, card, triggerReveal, animateDot]);

    const handleCollect = () => {
        Animated.timing(cardScale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            if (onClose) onClose();
        });
    };

    const handleDismiss = () => {
        if (onClose) onClose();
    };

    if (!card) return null;

    const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9FF3', '#54A0FF', '#5F27CD', '#01A0B0', '#FFC312'];

    const shimmerTranslateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-CARD_WIDTH, CARD_WIDTH],
    });

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleDismiss}>
            <View style={styles.backdrop}>
                {/* Close / Back button — ALWAYS visible */}
                <TouchableOpacity style={styles.backBtn} onPress={handleDismiss} activeOpacity={0.7}>
                    <View style={styles.backBtnCircle}>
                        <Ionicons name="close" size={24} color="#FFF" />
                    </View>
                </TouchableOpacity>

                <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cardScale }] }]}>

                    {/* Confetti */}
                    {confettiAnims.map((anim, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.confetti,
                                {
                                    backgroundColor: confettiColors[i],
                                    opacity: anim.opacity,
                                    transform: [
                                        { translateX: anim.translateX },
                                        { translateY: anim.translateY },
                                        { rotate: anim.rotate.interpolate({ inputRange: [0, 4], outputRange: ['0deg', '1440deg'] }) },
                                    ],
                                },
                            ]}
                        />
                    ))}

                    {/* Main Card */}
                    <LinearGradient
                        colors={['#1a1a2e', '#16213e', '#0f3460']}
                        style={styles.card}
                    >
                        {/* Header */}
                        <View style={styles.cardHeader}>
                            <View style={styles.headerLeft}>
                                <View style={styles.giftCircle}>
                                    <Ionicons name="gift" size={20} color="#FFD700" />
                                </View>
                                <View>
                                    <Text style={styles.headerTitle}>Scratch & Win!</Text>
                                    <Text style={styles.headerSub}>Cashback Reward</Text>
                                </View>
                            </View>
                            <View style={styles.starBadge}>
                                <Ionicons name="star" size={12} color="#FFD700" />
                                <Text style={styles.starText}>REWARD</Text>
                            </View>
                        </View>

                        {/* Scratch Area */}
                        <View style={styles.scratchArea} {...panResponder.panHandlers}>
                            {/* Hidden amount (behind scratch) */}
                            <View style={styles.amountContainer}>
                                <Animated.View style={{ transform: [{ scale: isScratched ? amountScale : new Animated.Value(0.5) }], opacity: isScratched ? 1 : 0.15 }}>
                                    <Animated.View style={{ opacity: sparkleOpacity, position: 'absolute', top: -10, right: -10 }}>
                                        <Ionicons name="sparkles" size={24} color="#FFD700" />
                                    </Animated.View>
                                    <Text style={styles.rupeeSymbol}>₹</Text>
                                    <Text style={styles.amountText}>{card.amount}</Text>
                                    <Text style={styles.cashbackLabel}>CASHBACK</Text>
                                </Animated.View>
                            </View>

                            {/* Scratch overlay */}
                            <Animated.View
                                style={[styles.scratchOverlay, { opacity: overlayOpacity }]}
                                pointerEvents={isScratched ? 'none' : 'auto'}
                            >
                                <LinearGradient
                                    colors={['#C9A961', '#E8D5A3', '#C9A961', '#B8943D']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.goldOverlay}
                                >
                                    {/* Shimmer effect */}
                                    <Animated.View
                                        style={[
                                            styles.shimmer,
                                            { transform: [{ translateX: shimmerTranslateX }] },
                                        ]}
                                    />

                                    <View style={styles.scratchContent}>
                                        <Ionicons name="finger-print" size={36} color="rgba(255,255,255,0.6)" />
                                        <Text style={styles.scratchText}>Swipe to Scratch</Text>
                                        <View style={styles.scratchDots}>
                                            {dotAnims.map((dotAnim, i) => (
                                                <Animated.View
                                                    key={i}
                                                    style={[
                                                        styles.dot,
                                                        { opacity: dotAnim, backgroundColor: '#FFD700' },
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                </LinearGradient>
                            </Animated.View>
                        </View>

                        {/* Footer */}
                        <View style={styles.cardFooter}>
                            {isScratched ? (
                                <TouchableOpacity style={styles.collectBtn} onPress={handleCollect} activeOpacity={0.8}>
                                    <LinearGradient
                                        colors={['#FFD700', '#F9A825', '#FF8F00']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.collectGradient}
                                    >
                                        <Ionicons name="wallet" size={18} color="#1a1a2e" />
                                        <Text style={styles.collectText}>Collect ₹{revealedAmount}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.footerHint}>
                                    <Ionicons name="hand-left" size={14} color="rgba(255,255,255,0.5)" />
                                    {'  '}Scratch the golden area above
                                </Text>
                            )}
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    backBtnCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    cardWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: CARD_WIDTH,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(201,169,97,0.3)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    giftCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,215,0,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerSub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
    },
    starBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,215,0,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    starText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    scratchArea: {
        marginHorizontal: 20,
        height: 140,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    amountContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a1628',
        borderRadius: 16,
    },
    rupeeSymbol: {
        color: '#FFD700',
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center',
        opacity: 0.7,
    },
    amountText: {
        color: '#FFD700',
        fontSize: 56,
        fontWeight: '900',
        textAlign: 'center',
        textShadowColor: 'rgba(255,215,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    cashbackLabel: {
        color: '#4ECDC4',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 3,
        marginTop: 2,
    },
    scratchOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        overflow: 'hidden',
    },
    goldOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 60,
        backgroundColor: 'rgba(255,255,255,0.15)',
        transform: [{ skewX: '-20deg' }],
    },
    scratchContent: {
        alignItems: 'center',
        gap: 8,
    },
    scratchText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    scratchDots: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    cardFooter: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        alignItems: 'center',
    },
    footerHint: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontWeight: '500',
    },
    collectBtn: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    collectGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    collectText: {
        color: '#1a1a2e',
        fontSize: 16,
        fontWeight: '800',
    },
    confetti: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 2,
    },
});

export default ScratchCardModal;
