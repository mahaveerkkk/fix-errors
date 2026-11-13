import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Vibration
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const { width } = Dimensions.get('window');

/**
 * WalletPinModal Props:
 * visible: boolean
 * mode: 'set' | 'verify'
 * onClose: () => void
 * onSuccess: (pin) => void - called when verify is successful or pin is successfully set
 * onPinEnter: (pin) => Promise<boolean> - function to verify or set pin via API
 */
const WalletPinModal = ({ visible, mode = 'verify', onClose, onSuccess, onPinEnter }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(mode === 'set' ? 'enter' : 'verify'); // 'enter', 'confirm', 'verify'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [shakeAnimation] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            setPin('');
            setConfirmPin('');
            setStep(mode === 'set' ? 'enter' : 'verify');
            setError('');
            setLoading(false);
        }
    }, [visible, mode]);

    const shake = () => {
        Vibration.vibrate(100);
        Animated.sequence([
            Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
        ]).start();
    };

    const handlePress = async (val) => {
        if (loading) return;
        Vibration.vibrate(30); // light haptic
        setError('');

        const currentPin = step === 'confirm' ? confirmPin : pin;
        const setCurrentPin = step === 'confirm' ? setConfirmPin : setPin;

        if (val === 'back') {
            setCurrentPin(prev => prev.slice(0, -1));
        } else if (currentPin.length < 4) {
            const newPin = currentPin + val;
            setCurrentPin(newPin);

            if (newPin.length === 4) {
                await processPinCompleted(newPin);
            }
        }
    };

    const processPinCompleted = async (enteredPin) => {
        if (step === 'enter') {
            // Move to confirm step
            setTimeout(() => {
                setStep('confirm');
            }, 300);
        } else if (step === 'confirm') {
            if (enteredPin !== pin) {
                setError('PINs do not match. Try again.');
                shake();
                setConfirmPin('');
            } else {
                // Call API to set PIN
                setLoading(true);
                try {
                    const success = await onPinEnter(enteredPin);
                    if (success) {
                        onSuccess(enteredPin);
                    } else {
                        setError('Failed to set PIN');
                        shake();
                        setPin('');
                        setConfirmPin('');
                        setStep('enter');
                    }
                } catch (err) {
                    setError(err.message || 'Error occurred');
                    shake();
                    setPin('');
                    setConfirmPin('');
                    setStep('enter');
                } finally {
                    setLoading(false);
                }
            }
        } else if (step === 'verify') {
            setLoading(true);
            try {
                const success = await onPinEnter(enteredPin);
                if (success) {
                    onSuccess(enteredPin);
                } else {
                    setError('Incorrect PIN');
                    shake();
                    setPin('');
                }
            } catch (err) {
                setError(err.message || 'Verification failed');
                shake();
                setPin('');
            } finally {
                setLoading(false);
            }
        }
    };

    const renderDots = () => {
        const currentPin = step === 'confirm' ? confirmPin : pin;
        const dots = [];
        for (let i = 0; i < 4; i++) {
            const isFilled = i < currentPin.length;
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.dot,
                        isFilled ? [styles.dotFilled, { backgroundColor: theme.colors.primary }] : [styles.dotEmpty, { borderColor: theme.colors.border }]
                    ]}
                />
            );
        }
        return <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnimation }] }]}>{dots}</Animated.View>;
    };

    const renderPadButton = (val) => {
        return (
            <TouchableOpacity
                key={val}
                style={[styles.padButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
                onPress={() => handlePress(val)}
                disabled={loading}
            >
                {val === 'back' ? (
                    <Ionicons name="backspace-outline" size={28} color={theme.colors.text} />
                ) : (
                    <Text style={[styles.padButtonText, { color: theme.colors.text }]}>{val}</Text>
                )}
            </TouchableOpacity>
        );
    };

    const getTitle = () => {
        if (step === 'enter') return 'Set 4-Digit PIN';
        if (step === 'confirm') return 'Confirm New PIN';
        return 'Enter Wallet PIN';
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
                        <Ionicons name="close" size={28} color={theme.colors.text} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '20' }]}>
                            <Ionicons name="lock-closed" size={32} color={theme.colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: theme.colors.text }]}>{getTitle()}</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            {step === 'verify' ? 'Secure your payment' : 'For secure wallet payments'}
                        </Text>
                    </View>

                    {renderDots()}

                    <Text style={[styles.errorText, { color: theme.colors.error, opacity: error ? 1 : 0 }]}>
                        {error || 'Error'}
                    </Text>

                    <View style={styles.keypad}>
                        <View style={styles.padRow}>
                            {['1', '2', '3'].map(renderPadButton)}
                        </View>
                        <View style={styles.padRow}>
                            {['4', '5', '6'].map(renderPadButton)}
                        </View>
                        <View style={styles.padRow}>
                            {['7', '8', '9'].map(renderPadButton)}
                        </View>
                        <View style={styles.padRow}>
                            <View style={styles.padButtonEmpty} />
                            {renderPadButton('0')}
                            {renderPadButton('back')}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 16,
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    dotEmpty: {
        borderWidth: 2,
    },
    dotFilled: {},
    errorText: {
        fontSize: 14,
        marginBottom: 20,
        fontWeight: '500',
    },
    keypad: {
        width: '100%',
        maxWidth: 340,
        gap: 16,
    },
    padRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    padButton: {
        width: (width - 48 - 32) / 3 > 80 ? 80 : (width - 48 - 32) / 3,
        maxWidth: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    padButtonEmpty: {
        width: (width - 48 - 32) / 3 > 80 ? 80 : (width - 48 - 32) / 3,
        maxWidth: 80,
    },
    padButtonText: {
        fontSize: 28,
        fontWeight: '600',
    }
});

export default WalletPinModal;
