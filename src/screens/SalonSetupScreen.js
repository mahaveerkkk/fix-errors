import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
    StatusBar,
    Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { registerSalon, uploadImage, updateSalon, getSalonById, getPlans, createOrder, verifyPayment } from '../services/api';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Geolocation from '@react-native-community/geolocation';
import RazorpayCheckout from 'react-native-razorpay'; // Import Razorpay
import { getTheme } from '../theme/theme'; // For theming
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const SalonSetupScreen = ({ route, navigation }) => {
    // User passed from Login/Register
    const { user, salon } = route.params;

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [salonId, setSalonId] = useState(salon?._id || null);

    // --- STEP 1: OWNER PROFILE ---
    const [ownerName, setOwnerName] = useState(user.name || '');
    const [ownerPhone, setOwnerPhone] = useState(user.phone || '');
    // const [ownerPhoto, setOwnerPhoto] = useState(user.profilePhoto || null); // Optional

    // --- STEP 2: SALON INFO ---
    const [salonName, setSalonName] = useState(salon?.name || '');
    const [salonAbout, setSalonAbout] = useState(salon?.description || '');
    const [salonImage, setSalonImage] = useState(salon?.images?.[0] ? { uri: salon.images[0] } : null); // Handle existing image URL

    // --- STEP 3: LOCATION ---
    const [address, setAddress] = useState((salon && salon.address && salon.address !== 'Pending') ? salon.address.split(',')[0] : '');
    const [city, setCity] = useState((salon && salon.address && salon.address !== 'Pending') ? salon.address.split(',')[1]?.trim() : '');
    const [pincode, setPincode] = useState((salon && salon.address && salon.address !== 'Pending') ? salon.address.split('-')[1]?.trim() : '');
    const [coordinates, setCoordinates] = useState(salon?.location?.lat ? salon.location : null);
    const [locationFetching, setLocationFetching] = useState(false);
    const [isLiveLocation, setIsLiveLocation] = useState(true);

    // --- REFERRAL CODE STATE ---
    const [referralCodeInput, setReferralCodeInput] = useState('');
    const [referralValidating, setReferralValidating] = useState(false);
    const [referralApplied, setReferralApplied] = useState(false);
    const [referralError, setReferralError] = useState('');

    // --- STEP 4: REVIEW (No State, just display) ---
    // --- STEP 5: PAYMENT (Handled in handlePayment) ---

    // -----------------------------------------------------------
    // FUNCTIONS
    // -----------------------------------------------------------

    const handlePhotoUpload = async () => {
        const { launchImageLibrary } = require('react-native-image-picker');
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            setSalonImage(result.assets[0]); // Store full asset object
        }
    };

    const handleGetLocation = () => {
        setLocationFetching(true);
        Geolocation.getCurrentPosition(
            (position) => {
                setCoordinates({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLocationFetching(false);
                Alert.alert('Location Fetched', 'Coordinates captured successfully!');
            },
            (error) => {
                Alert.alert('Error', 'Could not fetch location. Try again.');
                setLocationFetching(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    // --- NAVIGATION HANDLERS ---

    const handleStep1Next = async () => {
        // Validation
        const nameRegex = /^[a-zA-Z\s]+$/;
        const phoneRegex = /^[0-9]{10}$/;

        if (!ownerName || ownerName.trim().length < 3 || !nameRegex.test(ownerName)) {
            Alert.alert('Validation Error', 'Owner Name must be at least 3 characters and contain only alphabets.');
            return;
        }
        if (!ownerPhone || !phoneRegex.test(ownerPhone)) {
            Alert.alert('Validation Error', 'Please enter a valid 10-digit Phone Number (Numbers only).');
            return;
        }

        // In a real app, we would update the USER profile here.
        // await updateUserProfile(user.id, { name: ownerName, phone: ownerPhone });

        setCurrentStep(2);
    };

    const handleStep2Next = () => {
        // PURE VALIDATION — Zero server calls, zero uploads
        if (!salonName || salonName.length < 3) {
            Alert.alert('Validation Error', 'Salon Name must be at least 3 characters.');
            return;
        }
        if (!salonImage) {
            Alert.alert('Validation Error', 'Please upload at least one Salon Photo.');
            return;
        }

        // Image file object stays in local React state
        // Upload will happen ONLY at Step 4 "Activate Salon"
        setCurrentStep(3);
    };

    const handleStep3Next = async () => {
        // Validation only — NO DB CALL
        if (!address || !city || !pincode) {
            Alert.alert('Validation Error', 'Please complete the address fields.');
            return;
        }
        if (!coordinates) {
            Alert.alert('Validation Error', 'Please enable Live Location to pin your shop.');
            return;
        }

        // Null Island (0,0) rejection
        if (coordinates.lat === 0 && coordinates.lng === 0) {
            Alert.alert('Location Error', 'Invalid GPS coordinates detected. Please re-detect your location.');
            return;
        }

        // All data stays in local React state — move to Review step
        setCurrentStep(4);
    };

    // ============================================================
    // SINGLE ATOMIC SALON CREATION — "Activate Salon 🚀"
    // All Steps 1-3 data is in local React state.
    // This function does everything in ONE shot:
    //   1. Upload image (if not already uploaded)
    //   2. Create Salon document in MongoDB with ALL validated fields
    //   3. Mark user.salonSetupCompleted = true
    //   4. Navigate to Salon Dashboard
    // ============================================================
    const handleActivate = async () => {
        setLoading(true);
        try {
            // --- STEP 1: Upload image NOW (not before) ---
            let imageUrl = null;
            if (salonImage) {
                const uploadRes = await uploadImage(salonImage, 'salons');
                imageUrl = uploadRes;
            }

            const fullAddress = `${address}, ${city} - ${pincode}`;

            // --- ONE ATOMIC DB CALL: Create Salon with FULL data ---
            const payload = {
                ownerId: user._id || user.userId || user.id,
                name: salonName,
                description: salonAbout,
                phone: ownerPhone,
                email: user.email,
                images: imageUrl ? [imageUrl] : [],
                address: fullAddress,
                location: coordinates,
                latitude: coordinates.lat,
                longitude: coordinates.lng,
                status: 'active',             // Directly ACTIVE — not draft
                isPaymentActive: true,        // Free activation for now
            };

            let newSalonId = salonId;

            if (salonId) {
                // Edge case: If a draft salon already exists (from older flow), update it
                await updateSalon(salonId, payload);
            } else {
                // FRESH ATOMIC CREATION — No draft, no junk
                const res = await registerSalon(payload);
                newSalonId = res.salonId;
                setSalonId(newSalonId);
            }

            // --- Apply referral code if entered ---
            if (referralApplied && referralCodeInput) {
                try {
                    const { applyReferralCode } = require('../services/api');
                    const userId = user._id || user.userId || user.id;
                    await applyReferralCode(referralCodeInput.trim().toUpperCase(), newSalonId, userId);
                } catch (refErr) {
                    // Non-blocking: referral apply failure should not block activation
                    console.log('Referral apply error (non-blocking):', refErr.message);
                }
            }

            // --- Cache updated user + salon data for offline login ---
            const updatedUser = { ...user, salonSetupCompleted: true };
            const updatedSalon = {
                _id: newSalonId,
                name: salonName,
                address: fullAddress,
                images: imageUrl ? [imageUrl] : [],
                isPaymentActive: true,
                status: 'active'
            };
            try {
                await AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
                await AsyncStorage.setItem('cachedSalon', JSON.stringify(updatedSalon));
            } catch (cacheErr) { /* ignore cache errors */ }

            Alert.alert('🎉 Congratulations!', 'Your Salon is now LIVE!\nCustomers can discover and book with you.');
            navigation.replace('SalonTabs', { user: updatedUser, salon: updatedSalon });

        } catch (error) {
            Alert.alert('Activation Failed', error.message || 'Please check all details and try again.');
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------------------------
    // RENDER STEPS
    // -----------------------------------------------------------

    const renderStepIndicator = () => (
        <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((step) => (
                <View key={step} style={[styles.progressDot, currentStep >= step && styles.activeDot]} />
            ))}
        </View>
    );

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Complete Profile</Text>
            <Text style={styles.stepSubtitle}>Step 1: confirm your identity</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Owner Name</Text>
                <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Your Full Name" />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    value={ownerPhone}
                    onChangeText={setOwnerPhone}
                    placeholder="10-digit Mobile Number"
                    keyboardType="phone-pad"
                    maxLength={10}
                />
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleStep1Next}>
                <Text style={styles.nextButtonText}>Next: Salon Details</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Salon Details</Text>
            <Text style={styles.stepSubtitle}>Step 2: Tell us about your shop</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Salon Name</Text>
                <TextInput style={styles.input} value={salonName} onChangeText={setSalonName} placeholder="e.g. Luxe Studio" />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>About (Optional)</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={salonAbout}
                    onChangeText={setSalonAbout}
                    placeholder="Short description..."
                    multiline
                />
            </View>

            <Text style={styles.label}>Cover Photo (Required)</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={handlePhotoUpload}>
                {salonImage ? (
                    <Image source={{ uri: salonImage.uri }} style={styles.previewImage} />
                ) : (
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="camera-outline" size={30} color={colors.primary} />
                        <Text style={styles.uploadText}>Tap to Upload</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={handleStep2Next}>
                <Text style={styles.nextButtonText}>Next: Location</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Location</Text>
            <Text style={styles.stepSubtitle}>Step 3: Help customers find you</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Shop Address</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Shop No, Street, Landmark"
                    multiline
                />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>City</Text>
                    <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
                </View>
                <View style={[styles.inputGroup, { width: '48%' }]}>
                    <Text style={styles.label}>Pincode</Text>
                    <TextInput style={styles.input} value={pincode} onChangeText={setPincode} placeholder="110001" keyboardType="numeric" maxLength={6} />
                </View>
            </View>

            <Text style={styles.label}>Map Location (Required)</Text>
            <View style={styles.gpsBox}>
                <TouchableOpacity style={styles.gpsButton} onPress={handleGetLocation}>
                    <Ionicons name="locate" size={20} color="#fff" />
                    <Text style={styles.gpsButtonText}>Detect My Location</Text>
                </TouchableOpacity>
                {locationFetching && <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />}
                {coordinates && (
                    <Text style={styles.coordText}>Lat: {coordinates.lat.toFixed(4)}, Lng: {coordinates.lng.toFixed(4)} ✅</Text>
                )}
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleStep3Next} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                        <Text style={styles.nextButtonText}>Next: Review</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    const handleApplyReferralCode = async () => {
        if (!referralCodeInput || referralCodeInput.trim() === '') {
            setReferralError('Please enter a referral code');
            return;
        }

        setReferralValidating(true);
        setReferralError('');

        try {
            const { validateReferralCode } = require('../services/api');
            const codeToValidate = referralCodeInput.trim().toUpperCase();
            const validation = await validateReferralCode(codeToValidate);

            if (validation.valid) {
                setReferralApplied(true);
                setReferralError('');
                // NOTE: Do NOT call applyReferralCode here — salon doesn't exist yet!
                // Referral will be applied in handleActivate after salon is created.
                Alert.alert('✅ Code Validated!', 'Discount will be applied when you activate your salon!');
            } else {
                setReferralError('Invalid or expired referral code.');
            }
        } catch (err) {
            setReferralError(err.message || 'Invalid referral code');
        } finally {
            setReferralValidating(false);
        }
    };

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review Details</Text>
            <Text style={styles.stepSubtitle}>Step 4: Everything looks correct?</Text>

            <View style={styles.reviewCard}>
                <Image source={{ uri: salonImage?.uri || salonImage }} style={styles.reviewCover} />
                <View style={styles.reviewContent}>
                    <Text style={styles.reviewSalonName}>{salonName}</Text>
                    <Text style={styles.reviewOwner}>Owned by {ownerName}</Text>
                    <Text style={styles.reviewPhone}>📞 {ownerPhone}</Text>
                    <Text style={styles.reviewAddress}>📍 {address}, {city} - {pincode}</Text>
                </View>
            </View>

            {/* REFERRAL CODE BOX */}
            <View style={{ marginTop: 16, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
                    🎟️ Have a Referral Code? (Optional)
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                        style={[styles.input, { flex: 1, textTransform: 'uppercase', marginBottom: 0 }]}
                        value={referralCodeInput}
                        onChangeText={(txt) => {
                            setReferralCodeInput(txt);
                            setReferralApplied(false);
                            setReferralError('');
                        }}
                        placeholder="e.g. KARAN200"
                        editable={!referralApplied}
                        autoCapitalize="characters"
                    />
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            { paddingHorizontal: 18, paddingVertical: 14, marginTop: 0, backgroundColor: referralApplied ? '#4CAF50' : colors.primary }
                        ]}
                        onPress={handleApplyReferralCode}
                        disabled={referralValidating || referralApplied}
                    >
                        {referralValidating ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>
                                {referralApplied ? 'APPLIED ✅' : 'APPLY'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {referralApplied && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#E8F5E9', padding: 10, borderRadius: 10 }}>
                        <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                        <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: 'bold', marginLeft: 6 }}>
                            Code Applied! 10% OFF discount will be applied at checkout.
                        </Text>
                    </View>
                )}

                {referralError ? (
                    <Text style={{ color: '#FF5252', fontSize: 12, marginTop: 6, fontWeight: '600' }}>{referralError}</Text>
                ) : null}
            </View>

            <View style={styles.statusBox}>
                <Ionicons name="checkmark-circle" size={40} color="green" />
                <Text style={styles.statusText}>Ready to Activate!</Text>
                <Text style={styles.statusSubText}>Activate your subscription to go LIVE.</Text>
            </View>

            <TouchableOpacity style={styles.activateButton} onPress={handleActivate} disabled={loading}>
                {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color="#fff" />
                        <Text style={[styles.activateButtonText, { marginLeft: 10 }]}>Creating Your Salon...</Text>
                    </View>
                ) : (
                    <Text style={styles.activateButtonText}>Activate Salon 🚀</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.editButton} onPress={() => setCurrentStep(1)}>
                <Text style={styles.editButtonText}>Edit Details</Text>
            </TouchableOpacity>
        </View >
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Setup Wizard 🧙‍♂️</Text>
                {renderStepIndicator()}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10
    },
    progressContainer: {
        flexDirection: 'row',
        width: 100,
        justifyContent: 'space-between'
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#e0e0e0'
    },
    activeDot: {
        backgroundColor: colors.primary
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    stepContainer: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8
    },
    stepSubtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32
    },
    inputGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#333'
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top'
    },
    nextButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        padding: 18,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        elevation: 4
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8
    },
    uploadBox: {
        height: 180,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        overflow: 'hidden'
    },
    previewImage: {
        width: '100%',
        height: '100%'
    },
    uploadText: {
        marginTop: 8,
        color: '#666'
    },
    gpsBox: {
        backgroundColor: '#e3f2fd',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24
    },
    gpsButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center'
    },
    gpsButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: '600'
    },
    coordText: {
        marginTop: 10,
        color: '#1565c0',
        fontWeight: 'bold'
    },
    reviewCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 3,
        marginBottom: 24
    },
    reviewCover: {
        height: 150,
        width: '100%'
    },
    reviewContent: {
        padding: 16
    },
    reviewSalonName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333'
    },
    reviewOwner: {
        fontSize: 16,
        color: '#666',
        marginTop: 4
    },
    reviewPhone: {
        fontSize: 14,
        color: '#888',
        marginTop: 8
    },
    reviewAddress: {
        fontSize: 14,
        color: '#555',
        marginTop: 8
    },
    statusBox: {
        alignItems: 'center',
        marginBottom: 30
    },
    statusText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'green',
        marginTop: 10
    },
    statusSubText: {
        color: '#666'
    },
    activateButton: {
        backgroundColor: '#2e7d32', // Green for activation
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 5
    },
    activateButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    editButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 10
    },
    editButtonText: {
        color: '#888',
        textDecorationLine: 'underline'
    }
});

export default SalonSetupScreen;
