import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator,
    Image,
    TextInput,
    Modal,
    Dimensions,
    Animated,
    Platform,
    PermissionsAndroid
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getSalonForQR, paySalon, getWallet, verifyWalletPin } from '../services/api';
import WalletPinModal from '../components/common/WalletPinModal';
import CustomAlert from '../components/common/CustomAlert';

const { width, height } = Dimensions.get('window');

// Fallback manual entry when camera not available
const QRScannerScreen = ({ route, navigation }) => {
    const { user } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [scanning, setScanning] = useState(true);
    const [salonData, setSalonData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [paySuccess, setPaySuccess] = useState(false);
    const [manualId, setManualId] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [torchOn, setTorchOn] = useState(false);

    // Try to dynamically import camera-kit
    const [CameraKit, setCameraKit] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);

    // PIN Verification
    const [userWallet, setUserWallet] = useState(null);
    const [pinModalVisible, setPinModalVisible] = useState(false);
    const [pinMode, setPinMode] = useState('verify'); // 'set' or 'verify'

    // Custom Alert
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
    const showAlert = (title, message, type = 'info', buttons = []) => {
        setAlertConfig({ visible: true, title, message, type, buttons });
    };
    const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

    // Animations
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const cornerPulse = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.4)).current;
    const fadeIn = useRef(new Animated.Value(0)).current;

    const SCAN_FRAME_SIZE = width * 0.68;

    useEffect(() => {
        loadCamera();
        fetchUserWallet();

        // Smooth entrance fade
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();

        // Scan line — smooth continuous sweep
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
                Animated.timing(scanLineAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
            ])
        ).start();

        // Corner pulse — gentle breathing scale
        Animated.loop(
            Animated.sequence([
                Animated.timing(cornerPulse, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
                Animated.timing(cornerPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        ).start();

        // Glow — border opacity breathing
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
            ])
        ).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchUserWallet = async () => {
        try {
            const id = user?._id || user?.id;
            if (id) {
                const walletData = await getWallet(id);
                setUserWallet(walletData);
            }
        } catch (error) {
            console.log('Error fetching user wallet', error);
        }
    };

    const loadCamera = async () => {
        try {
            // Request camera permission on Android
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: 'Camera Permission',
                        message: 'QR Scanner needs camera access',
                        buttonPositive: 'Allow',
                        buttonNegative: 'Cancel'
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    setShowManual(true);
                    return;
                }
            }

            // Try to import camera kit
            try {
                const kit = require('react-native-camera-kit');
                // v17: Camera is a named export, CameraScreen is removed
                if (kit.Camera) {
                    setCameraKit(kit);
                    setCameraReady(true);
                } else {
                    setShowManual(true);
                }
            } catch (e) {
                // Camera kit not installed, use manual entry
                setShowManual(true);
            }
        } catch (error) {
            setShowManual(true);
        }
    };

    const handleQRRead = async (event) => {
        if (!scanning) return;
        setScanning(false);

        const qrData = event.nativeEvent?.codeStringValue || event?.nativeEvent?.codeValue || '';
        await processQRData(qrData);
    };

    const processQRData = async (qrData) => {
        setLoading(true);
        try {
            // Extract salonId from QR value
            // New format: styleq://pay/BFDCFF67 (8-char short code)
            // Legacy format: styleq://salon/{fullMongoId}
            let salonId = qrData.trim();
            if (qrData.includes('styleq://pay/')) {
                salonId = qrData.replace('styleq://pay/', '').trim();
            } else if (qrData.includes('styleq://salon/')) {
                salonId = qrData.replace('styleq://salon/', '').trim();
            } else if (qrData.includes('/salon/')) {
                salonId = qrData.split('/salon/').pop().trim();
            }

            if (!salonId || salonId.length < 6) {
                showAlert('Invalid QR', 'Yeh valid salon QR code nahi hai', 'error', [
                    { text: 'Try Again', onPress: () => { hideAlert(); setScanning(true); setLoading(false); } }
                ]);
                return;
            }

            const data = await getSalonForQR(salonId);
            setSalonData(data);
        } catch (error) {
            showAlert('Error', error.message || 'Salon not found', 'error', [
                { text: 'Try Again', onPress: () => { hideAlert(); setScanning(true); } }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleManualEntry = () => {
        if (!manualId.trim()) {
            showAlert('Error', 'Please enter salon ID', 'error', [{ text: 'OK', onPress: hideAlert }]);
            return;
        }
        setShowManual(false);
        processQRData(manualId.trim());
    };

    const handlePay = async () => {
        const amount = parseInt(payAmount);
        if (!amount || amount <= 0) {
            showAlert('Invalid', 'Please enter a valid amount', 'warning', [{ text: 'OK', onPress: hideAlert }]);
            return;
        }

        const userId = user?._id || user?.id;
        if (!userId) {
            showAlert('Error', 'User not found', 'error', [{ text: 'OK', onPress: hideAlert }]);
            return;
        }

        setPaying(true);

        if (userWallet?.hasPin) {
            // Need PIN verification
            setPaying(false);
            setPinMode('verify');
            setPinModalVisible(true);
        } else {
            setPaying(false);
            showAlert(
                'Setup Wallet PIN',
                'Please set up a 4-digit security PIN before making a payment.',
                'info',
                [
                    { text: 'Cancel', style: 'cancel', onPress: hideAlert },
                    {
                        text: 'Setup PIN',
                        onPress: () => {
                            hideAlert();
                            setPinMode('set');
                            setPinModalVisible(true);
                        }
                    }
                ]
            );
        }
    };

    const executePayment = async () => {
        const amount = parseInt(payAmount);
        const userId = user?._id || user?.id;
        setPaying(true);
        try {
            const result = await paySalon(userId, salonData.salonId, amount);
            if (result.success) {
                setPaySuccess(true);
            }
        } catch (error) {
            showAlert('Payment Failed', error.message || 'Please try again', 'error', [{ text: 'OK', onPress: hideAlert }]);
        } finally {
            setPaying(false);
        }
    };

    // ========== SUCCESS SCREEN ==========
    if (paySuccess) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
                <View style={styles.successContainer}>
                    <View style={styles.successIconCircle}>
                        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                    </View>
                    <Text style={[styles.successTitle, { color: theme.colors.text }]}>Payment Successful!</Text>
                    <Text style={[styles.successAmount, { color: '#10B981' }]}>₹{payAmount}</Text>
                    <Text style={[styles.successSalon, { color: theme.colors.textSecondary }]}>
                        Paid to {salonData?.salonName}
                    </Text>
                    <TouchableOpacity
                        style={styles.successBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#1D4ED8']}
                            style={styles.successBtnGradient}
                        >
                            <Text style={styles.successBtnText}>Back to Wallet</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ========== SALON RESULT SCREEN ==========
    if (salonData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

                {/* Header */}
                <View style={[styles.resultHeader, { backgroundColor: theme.colors.surface }]}>
                    <TouchableOpacity onPress={() => { setSalonData(null); setScanning(true); }} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.resultHeaderTitle, { color: theme.colors.text }]}>Pay to Salon</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.resultContent}>
                    {/* Salon Card */}
                    <View style={[styles.salonCard, { backgroundColor: theme.colors.surface }]}>
                        <Image
                            source={{
                                uri: salonData.ownerPhoto || salonData.salonImage ||
                                    `https://ui-avatars.com/api/?name=${salonData.ownerName}&background=3B82F6&color=fff&size=128`
                            }}
                            style={styles.salonPhoto}
                        />
                        <View style={styles.salonNameRow}>
                            <Text style={[styles.salonOwnerName, { color: theme.colors.text }]}>
                                {salonData.ownerName}
                            </Text>
                            <View style={styles.verifiedBadge}>
                                <MaterialIcons name="verified" size={20} color="#1D9BF0" />
                            </View>
                        </View>
                        <Text style={[styles.salonName, { color: theme.colors.textSecondary }]}>
                            {salonData.salonName}
                        </Text>
                        {salonData.rating > 0 && (
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>
                                    {salonData.rating.toFixed(1)}
                                </Text>
                            </View>
                        )}
                        {salonData.address ? (
                            <Text style={[styles.salonAddress, { color: theme.colors.textLight }]} numberOfLines={2}>
                                📍 {salonData.address}
                            </Text>
                        ) : null}

                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: salonData.isOpen !== false ? '#ECFDF5' : '#FEE2E2' }]}>
                            <View style={[styles.statusDot, { backgroundColor: salonData.isOpen !== false ? '#10B981' : '#EF4444' }]} />
                            <Text style={[styles.statusText, { color: salonData.isOpen !== false ? '#059669' : '#DC2626' }]}>
                                {salonData.isOpen !== false ? 'Open Now' : 'Closed'}
                            </Text>
                        </View>
                    </View>

                    {/* Amount Input */}
                    <View style={[styles.paySection, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.payLabel, { color: theme.colors.text }]}>Enter Amount</Text>
                        <View style={[styles.payInputContainer, { borderColor: '#3B82F6' }]}>
                            <Text style={[styles.payCurrency, { color: theme.colors.text }]}>₹</Text>
                            <TextInput
                                style={[styles.payInput, { color: theme.colors.text }]}
                                value={payAmount}
                                onChangeText={setPayAmount}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={theme.colors.textLight}
                                maxLength={6}
                                autoFocus
                            />
                        </View>

                        {/* Quick Amounts */}
                        <View style={styles.quickPayRow}>
                            {[50, 100, 200, 500].map(amt => (
                                <TouchableOpacity
                                    key={amt}
                                    style={[
                                        styles.quickPayBtn,
                                        payAmount === String(amt) && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
                                        { borderColor: theme.colors.border }
                                    ]}
                                    onPress={() => setPayAmount(String(amt))}
                                >
                                    <Text style={[
                                        styles.quickPayText,
                                        payAmount === String(amt) ? { color: '#FFF' } : { color: theme.colors.text }
                                    ]}>
                                        ₹{amt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Pay Button */}
                        <TouchableOpacity
                            style={[styles.bigPayBtn, paying && { opacity: 0.6 }]}
                            onPress={handlePay}
                            disabled={paying || !payAmount}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#1D4ED8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.bigPayBtnGradient}
                            >
                                {paying ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="wallet" size={22} color="#FFF" />
                                        <Text style={styles.bigPayBtnText}>
                                            {payAmount ? `Pay ₹${payAmount}` : 'Enter Amount'}
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* PIN Verification / Setup Modal */}
                <WalletPinModal
                    visible={pinModalVisible}
                    mode={pinMode}
                    onClose={() => setPinModalVisible(false)}
                    onSuccess={async (pin) => {
                        setPinModalVisible(false);
                        if (pinMode === 'set') {
                            // Automatically fetch wallet again to update hasPin status
                            await fetchUserWallet();
                            showAlert('Success', 'PIN set successfully. Setup complete, you can now pay!', 'success', [{ text: 'OK', onPress: hideAlert }]);
                        } else {
                            executePayment();
                        }
                    }}
                    onPinEnter={async (pin) => {
                        const userId = user?._id || user?.id;
                        if (pinMode === 'set') {
                            const { setWalletPin } = require('../services/api');
                            await setWalletPin(userId, pin);
                            return true;
                        } else {
                            const { verifyWalletPin } = require('../services/api');
                            await verifyWalletPin(userId, pin);
                            return true;
                        }
                    }}
                />
                <CustomAlert {...alertConfig} onClose={hideAlert} />
            </SafeAreaView>
        );
    }

    // ========== SCANNER SCREEN ==========
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Full-screen Camera */}
            <View style={styles.cameraContainer}>
                {cameraReady && CameraKit ? (
                    <CameraKit.Camera
                        style={StyleSheet.absoluteFill}
                        scanBarcode={true}
                        onReadCode={handleQRRead}
                        showFrame={false}
                        codeTypes={['qr']}
                        laserColor="transparent"
                        frameColor="transparent"
                        torchMode={torchOn ? 'on' : 'off'}
                    />
                ) : (
                    <View style={styles.noCameraContainer}>
                        <View style={styles.noCameraIconWrap}>
                            <Ionicons name="qr-code-outline" size={56} color="#7C3AED" />
                        </View>
                        <Text style={styles.noCameraText}>Camera not available</Text>
                        <Text style={styles.noCameraSubtext}>You can enter the salon code manually below</Text>
                        <TouchableOpacity style={styles.enterManualBtn} onPress={() => setShowManual(true)}>
                            <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.enterManualBtnGradient}>
                                <Ionicons name="keypad-outline" size={18} color="#FFF" />
                                <Text style={styles.enterManualBtnText}>Enter Code Manually</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Loading overlay */}
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingCard}>
                            <ActivityIndicator size="large" color="#7C3AED" />
                            <Text style={styles.loadingText}>Finding salon...</Text>
                        </View>
                    </View>
                )}

                {/* ===== PREMIUM OVERLAY ===== */}
                {cameraReady && !loading && (
                    <Animated.View style={[styles.scannerOverlay, { opacity: fadeIn }]}>

                        {/* Top mask */}
                        <View style={styles.maskTop}>
                            {/* Floating Header */}
                            <View style={styles.floatingHeader}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                                </TouchableOpacity>
                                <View style={styles.headerCenter}>
                                    <View style={styles.headerDot} />
                                    <Text style={styles.scanTitle}>Scan & Pay</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowManual(true)} style={styles.headerBtn}>
                                    <Ionicons name="keypad-outline" size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Center row: side masks + scan frame */}
                        <View style={styles.maskCenterRow}>
                            <View style={styles.maskSide} />

                            <View style={[styles.scanFrame, { width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE }]}>
                                {/* Animated glowing border */}
                                <Animated.View style={[styles.glowBorder, { width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE, opacity: glowAnim }]} />

                                {/* Pulsing corner brackets */}
                                <Animated.View style={[styles.corner, styles.cornerTL, { transform: [{ scale: cornerPulse }] }]} />
                                <Animated.View style={[styles.corner, styles.cornerTR, { transform: [{ scale: cornerPulse }] }]} />
                                <Animated.View style={[styles.corner, styles.cornerBL, { transform: [{ scale: cornerPulse }] }]} />
                                <Animated.View style={[styles.corner, styles.cornerBR, { transform: [{ scale: cornerPulse }] }]} />

                                {/* Scan line */}
                                <Animated.View style={[
                                    styles.scanLine,
                                    {
                                        transform: [{
                                            translateY: scanLineAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [4, SCAN_FRAME_SIZE - 8],
                                            })
                                        }]
                                    }
                                ]}>
                                    <LinearGradient
                                        colors={['transparent', '#7C3AED', '#A78BFA', '#7C3AED', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.scanLineGradient}
                                    />
                                </Animated.View>
                            </View>

                            <View style={styles.maskSide} />
                        </View>

                        {/* Bottom mask */}
                        <View style={styles.maskBottom}>
                            {/* Hint pill */}
                            <View style={styles.hintPill}>
                                <View style={styles.hintDot} />
                                <Text style={styles.scanHint}>Point camera at salon QR code</Text>
                            </View>

                            {/* Floating Action Buttons */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, torchOn && styles.actionBtnActive]}
                                    onPress={() => setTorchOn(prev => !prev)}
                                >
                                    <View style={[styles.actionIconWrap, torchOn && styles.actionIconWrapActive]}>
                                        <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={24} color={torchOn ? '#FFC107' : '#FFF'} />
                                    </View>
                                    <Text style={[styles.actionLabel, torchOn && styles.actionLabelActive]}>
                                        {torchOn ? 'ON' : 'Flash'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowManual(true)}>
                                    <View style={styles.actionIconWrap}>
                                        <Ionicons name="create-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.actionLabel}>Enter ID</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionBtn} onPress={() => { setScanning(true); }}>
                                    <View style={styles.actionIconWrap}>
                                        <Ionicons name="refresh-outline" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.actionLabel}>Reset</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </View>

            {/* Manual Entry Modal */}
            <Modal visible={showManual} animationType="slide" transparent onRequestClose={() => setShowManual(false)}>
                <View style={styles.manualOverlay}>
                    <View style={[styles.manualContent, { backgroundColor: theme.colors.surface }]}>
                        <View style={styles.manualHeader}>
                            <Text style={[styles.manualTitle, { color: theme.colors.text }]}>Enter Salon ID</Text>
                            <TouchableOpacity onPress={() => setShowManual(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.colors.textLight} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.manualSubtitle, { color: theme.colors.textSecondary }]}>
                            Salon owner se ID pucho aur yahan enter karo
                        </Text>
                        <TextInput
                            style={[styles.manualInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={manualId}
                            onChangeText={setManualId}
                            placeholder="Salon ID paste karo"
                            placeholderTextColor={theme.colors.textLight}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualEntry}>
                            <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.manualSubmitGradient}>
                                <Text style={styles.manualSubmitText}>Find Salon</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <CustomAlert {...alertConfig} onClose={hideAlert} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },

    // ===== CAMERA =====
    cameraContainer: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 20,
    },
    loadingCard: {
        backgroundColor: 'rgba(30,30,40,0.95)',
        borderRadius: 20,
        paddingHorizontal: 36,
        paddingVertical: 28,
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
    },
    loadingText: {
        color: '#D1D5DB',
        fontSize: 15,
        fontWeight: '500',
    },
    noCameraContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A0A0F',
        gap: 14,
        paddingHorizontal: 40,
    },
    noCameraIconWrap: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(124,58,237,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(124,58,237,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    noCameraText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    noCameraSubtext: {
        color: '#6B7280',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    enterManualBtn: {
        marginTop: 24,
        borderRadius: 16,
        overflow: 'hidden',
    },
    enterManualBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 16,
        gap: 10,
    },
    enterManualBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },

    // ===== OVERLAY MASK =====
    scannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'column',
    },
    maskTop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
        paddingBottom: 20,
    },
    maskCenterRow: {
        flexDirection: 'row',
    },
    maskSide: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    maskBottom: {
        flex: 1.3,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        paddingTop: 24,
    },

    // ===== FLOATING HEADER =====
    floatingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        width: '100%',
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    scanTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        letterSpacing: 0.3,
    },

    // ===== SCAN FRAME =====
    scanFrame: {
        position: 'relative',
    },
    glowBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderWidth: 1.5,
        borderColor: 'rgba(124,58,237,0.35)',
        borderRadius: 20,
    },
    corner: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderColor: '#A78BFA',
    },
    cornerTL: {
        top: -2, left: -2,
        borderTopWidth: 4, borderLeftWidth: 4,
        borderTopLeftRadius: 14,
    },
    cornerTR: {
        top: -2, right: -2,
        borderTopWidth: 4, borderRightWidth: 4,
        borderTopRightRadius: 14,
    },
    cornerBL: {
        bottom: -2, left: -2,
        borderBottomWidth: 4, borderLeftWidth: 4,
        borderBottomLeftRadius: 14,
    },
    cornerBR: {
        bottom: -2, right: -2,
        borderBottomWidth: 4, borderRightWidth: 4,
        borderBottomRightRadius: 14,
    },
    scanLine: {
        position: 'absolute',
        left: 6,
        right: 6,
        height: 3,
        overflow: 'hidden',
    },
    scanLineGradient: {
        flex: 1,
        borderRadius: 2,
    },

    // ===== HINT PILL =====
    hintPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
    },
    hintDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#7C3AED',
    },
    scanHint: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '600',
    },

    // ===== BOTTOM ACTIONS =====
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        marginTop: 30,
        width: '100%',
    },
    actionBtn: {
        alignItems: 'center',
        gap: 6,
    },
    actionBtnActive: {},
    actionIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionIconWrapActive: {
        backgroundColor: 'rgba(124,58,237,0.25)',
        borderColor: '#7C3AED',
    },
    actionLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        fontWeight: '600',
    },
    actionLabelActive: {
        color: '#FFC107',
    },

    // Manual Entry Modal
    manualOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    manualContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    manualHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    manualTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    manualSubtitle: {
        fontSize: 13,
        marginBottom: 20,
    },
    manualInput: {
        borderWidth: 2,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 16,
    },
    manualSubmitBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    manualSubmitGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    manualSubmitText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // Result Screen
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        elevation: 2,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    resultContent: {
        flex: 1,
        padding: 20,
    },
    salonCard: {
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        marginBottom: 16,
    },
    salonPhoto: {
        width: 90,
        height: 90,
        borderRadius: 45,
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#3B82F6',
    },
    salonNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    salonOwnerName: {
        fontSize: 22,
        fontWeight: '700',
    },
    verifiedBadge: {
        marginLeft: 2,
    },
    salonName: {
        fontSize: 14,
        marginTop: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '500',
    },
    salonAddress: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 12,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    paySection: {
        borderRadius: 24,
        padding: 24,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    payLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    payInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    payCurrency: {
        fontSize: 32,
        fontWeight: '800',
        marginRight: 8,
    },
    payInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '800',
        paddingVertical: 14,
    },
    quickPayRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    quickPayBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    quickPayText: {
        fontSize: 14,
        fontWeight: '600',
    },
    bigPayBtn: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    bigPayBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 10,
    },
    bigPayBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },

    // Success Screen
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    successIconCircle: {
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
    },
    successAmount: {
        fontSize: 44,
        fontWeight: '800',
        marginTop: 10,
    },
    successSalon: {
        fontSize: 16,
        marginTop: 8,
    },
    successBtn: {
        marginTop: 40,
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
    },
    successBtnGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    successBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    }
});

export default QRScannerScreen;
