import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

/**
 * CustomAlert Props:
 * visible: boolean
 * title: string
 * message: string
 * type: 'success' | 'error' | 'warning' | 'info'
 * buttons: array of {text, style, onPress} - matching Alert.alert
 * onClose: () => void
 */
const CustomAlert = ({ visible, title, message, type = 'info', buttons = [], onClose }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.9));

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 6,
                    tension: 40,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.9);
        }
    }, [visible]);

    const getIconInfo = () => {
        switch (type) {
            case 'success':
                return { icon: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
            case 'error':
                return { icon: 'close-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
            case 'warning':
                return { icon: 'warning', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
            case 'info':
            default:
                return { icon: 'information-circle', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
        }
    };

    if (!visible) return null;

    const iconInfo = getIconInfo();
    const renderedButtons = buttons.length > 0 ? buttons : [{ text: 'OK', onPress: onClose }];

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View 
                    style={[
                        styles.alertBox, 
                        { backgroundColor: theme.colors.surface, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
                    ]}
                >
                    <View style={[styles.iconCircle, { backgroundColor: iconInfo.bg }]}>
                        <Ionicons name={iconInfo.icon} size={36} color={iconInfo.color} />
                    </View>
                    
                    <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                    {message ? (
                        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
                    ) : null}

                    <View style={styles.buttonsContainer}>
                        {renderedButtons.map((btn, index) => {
                            const isCancel = btn.style === 'cancel';
                            const isPrimary = !isCancel && index === renderedButtons.length - 1;
                            
                            if (isPrimary) {
                                return (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={[styles.button, styles.primaryButton, renderedButtons.length === 1 && { flex: 0, paddingHorizontal: 40 }]} 
                                        onPress={() => {
                                            if (btn.onPress) btn.onPress();
                                            else onClose();
                                        }}
                                    >
                                        <LinearGradient
                                            colors={['#3B82F6', '#1D4ED8']}
                                            style={styles.primaryGradient}
                                            start={{x: 0, y: 0}}
                                            end={{x: 1, y: 0}}
                                        >
                                            <Text style={styles.primaryButtonText}>{btn.text}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            }

                            return (
                                <TouchableOpacity 
                                    key={index} 
                                    style={[styles.button, styles.secondaryButton, { backgroundColor: theme.colors.border + '30' }]} 
                                    onPress={() => {
                                        if (btn.onPress) btn.onPress();
                                        else onClose();
                                    }}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{btn.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    alertBox: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'center',
    },
    button: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    primaryButton: {
    },
    primaryGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    secondaryButton: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
    }
});

export default CustomAlert;
