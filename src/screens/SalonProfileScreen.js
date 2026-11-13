import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Image,
    TouchableOpacity,
    Alert,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Animated,
    Modal
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { updateSalon, uploadImage } from '../services/api';
import LinearGradient from 'react-native-linear-gradient'; // Ensure you have this installed or mock it if native module missing. 
// If LinearGradient is not available, I will simulate it with rgba views. For now, assuming standard setup or fallback.
// Since user environment is unknown, I'll stick to pure RN views with rgba for gradients to be safe, or use simple Views.
// Better: Use styling hacks for gradients if package generally unavailable, but let's try to stick to clean View overlays.
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

const InputField = ({ label, value, onChangeText, icon, placeholder, multiline, keyboardType, isEditing, theme, styles, maxLength }) => (
    <View style={styles.inputContainer}>
        <View style={styles.labelRow}>
            <Ionicons name={icon} size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.inputLabel}>{label}</Text>
        </View>
        {isEditing ? (
            <TextInput
                style={[styles.input, multiline && styles.textArea]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                multiline={multiline}
                keyboardType={keyboardType}
                maxLength={maxLength}
                textAlignVertical={multiline ? 'top' : 'center'}
            />
        ) : (
            <Text style={styles.readonlyText}>{value || 'Not set'}</Text>
        )}
    </View>
);

const { width } = Dimensions.get('window');

const SalonProfileScreen = ({ navigation, route }) => {
    const { salon: initialSalon } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    // State
    const [salon, setSalon] = useState(initialSalon || {});
    const [loading, setLoading] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [editedSalon, setEditedSalon] = useState({
        name: '', ownerName: '', address: '', phone: '',
        about: '', images: [], openTime: '09:00', closeTime: '21:00'
    });

    // Animation Values
    const scrollY = useRef(new Animated.Value(0)).current;
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [300, 100],
        extrapolate: 'clamp'
    });
    const imageOpacity = scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });
    const headerTitleOpacity = scrollY.interpolate({
        inputRange: [150, 250],
        outputRange: [0, 1],
        extrapolate: 'clamp'
    });

    useEffect(() => {
        if (initialSalon) {
            setSalon(initialSalon);
            setEditedSalon({
                name: initialSalon.name || '',
                ownerName: initialSalon.ownerName || '',
                address: initialSalon.address || '',
                phone: initialSalon.phone || '',
                about: initialSalon.description || '',
                images: initialSalon.images || [],
                openTime: initialSalon.timings?.open || '09:00',
                closeTime: initialSalon.timings?.close || '21:00'
            });
        }
    }, [initialSalon]);

    const handleSave = async () => {
        // Validation
        const salonName = editedSalon.name?.trim();
        const address = editedSalon.address?.trim();
        const phone = editedSalon.phone?.replace(/\D/g, ''); // Strip non-digits

        if (!salonName) {
            Alert.alert('Validation Error', 'Salon Name is required.');
            return;
        }
        if (!address) {
            Alert.alert('Validation Error', 'Address is required.');
            return;
        }
        if (phone && phone.length !== 10) {
            Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number.');
            return;
        }

        setLoading(true);
        try {
            const updates = {
                name: editedSalon.name,
                ownerName: editedSalon.ownerName, // Send owner name too
                address: editedSalon.address,
                phone: editedSalon.phone,
                description: editedSalon.about,
                images: editedSalon.images,
                timings: {
                    open: editedSalon.openTime,
                    close: editedSalon.closeTime,
                    days: salon.timings?.days || []
                }
            };

            const updatedData = await updateSalon(salon._id, updates);
            setSalon(updatedData);
            setIsEditing(false);
            Alert.alert('Success', 'Profile Updated Successfully! 🎉');
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const [uploadingBanner, setUploadingBanner] = useState(false);

    // Handle Banner Photo Upload (first image in array)
    const handlePickBannerImage = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 1,
        });

        if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setUploadingBanner(true);
            try {
                const uploadedUrl = await uploadImage(asset, 'salons');
                // Replace first image (banner) or add as first if no images
                setEditedSalon(prev => {
                    const newImages = [...prev.images];
                    if (newImages.length > 0) {
                        newImages[0] = uploadedUrl; // Replace banner
                    } else {
                        newImages.push(uploadedUrl); // Add as banner
                    }
                    return { ...prev, images: newImages };
                });
            } catch (error) {
                Alert.alert('Upload Failed', 'Could not upload banner image.');
            } finally {
                setUploadingBanner(false);
            }
        }
    };

    // Handle Salon Gallery Photo Upload (images after the first one)
    const handlePickImage = async () => {
        // Gallery can have max 3 additional photos (excluding banner)
        const galleryImages = editedSalon.images.slice(1);
        if (galleryImages.length >= 3) {
            Alert.alert('Limit Reached', 'You can only upload up to 3 gallery photos.');
            return;
        }

        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 1,
        });

        if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setUploadingImg(true);
            try {
                const uploadedUrl = await uploadImage(asset, 'salons');
                setEditedSalon(prev => ({ ...prev, images: [...prev.images, uploadedUrl] }));
            } catch (error) {
                Alert.alert('Upload Failed', 'Could not upload image.');
            } finally {
                setUploadingImg(false);
            }
        }
    };

    const handleRemoveImage = (indexToRemove) => {
        Alert.alert('Remove Photo', 'Delete this photo?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    const newImages = editedSalon.images.filter((_, index) => index !== indexToRemove);
                    setEditedSalon(prev => ({ ...prev, images: newImages }));
                }
            }
        ]);
    };

    const styles = getStyles(theme, isDarkMode);

    // --- Components ---



    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* HEADER BACKGROUND IMAGE (Parallax) */}
            <Animated.View style={[styles.headerBg, { height: headerHeight }]}>
                <Animated.Image
                    source={{ uri: (isEditing ? editedSalon.images[0] : salon.images?.[0]) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3' }}
                    style={[styles.headerImage, { opacity: imageOpacity }]}
                />
                <View style={styles.overlay} />

                {/* Header Content (Abs) */}
                <View style={styles.headerContent}>
                    {!isEditing && (
                        <View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>VERIFIED</Text>
                            </View>
                            <Text style={styles.bigTitle}>{salon.name}</Text>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={16} color="#FFD700" />
                                <Text style={styles.ratingText}>4.8 (120 Reviews)</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Animated.View>

            {/* TOP NAVIGATION BAR */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Animated.Text style={[styles.navTitle, { opacity: headerTitleOpacity }]}>
                    {isEditing ? 'Edit Profile' : salon.name}
                </Animated.Text>
                <TouchableOpacity
                    onPress={() => setIsEditing(!isEditing)}
                    style={[styles.iconBtn, isEditing && styles.activeEditBtn]}
                >
                    <Ionicons name={isEditing ? "close" : "create-outline"} size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* MAIN CONTENT SCROLL */}
            <Animated.ScrollView
                contentContainerStyle={{ paddingTop: 260, paddingBottom: 100 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                {/* CONTENT CARD */}
                <View style={[styles.contentCard, isEditing && { marginTop: 20 }]}>

                    {/* Info Row Component */}
                    {!isEditing && (
                        <>
                            {/* SALON INFO CARD */}
                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconBox}>
                                        <Ionicons name="storefront" size={20} color={theme.colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.infoLabel}>Salon Name</Text>
                                        <Text style={styles.infoValue}>{salon.name || 'Not set'}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoDivider} />



                                <View style={styles.infoRow}>
                                    <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0' }]}>
                                        <Ionicons name="information-circle" size={20} color={theme.colors.warning} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.infoLabel}>About</Text>
                                        <Text style={styles.infoValue}>{salon.description || 'No description'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* CONTACT CARD */}
                            <View style={styles.infoCard}>
                                <Text style={styles.cardTitle}>📍 Location & Contact</Text>

                                <View style={styles.infoRow}>
                                    <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD' }]}>
                                        <Ionicons name="location" size={20} color={theme.colors.info} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.infoLabel}>Address</Text>
                                        <Text style={styles.infoValue}>{salon.address || 'Not set'}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoDivider} />

                                <View style={styles.infoRow}>
                                    <View style={[styles.infoIconBox, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}>
                                        <Ionicons name="call" size={20} color={theme.colors.success} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.infoLabel}>Phone</Text>
                                        <Text style={styles.infoValue}>{salon.phone || 'Not set'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* EDIT BUTTON */}
                            <TouchableOpacity
                                style={styles.editProfileBtn}
                                onPress={() => setIsEditing(true)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="create-outline" size={20} color="#FFF" />
                                <Text style={styles.editProfileBtnText}>Edit Salon Profile</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* EDIT MODE */}
                    {isEditing && (
                        <>
                            {/* BANNER PHOTO SECTION */}
                            <View style={styles.editCard}>
                                <View style={styles.editCardHeader}>
                                    <Ionicons name="image" size={20} color={theme.colors.primary} />
                                    <Text style={styles.editCardTitle}>Banner Photo</Text>
                                </View>
                                <Text style={styles.editCardSubtitle}>This will be your salon's cover image</Text>
                                <TouchableOpacity
                                    style={styles.bannerPreviewContainer}
                                    onPress={handlePickBannerImage}
                                    disabled={uploadingBanner}
                                >
                                    {editedSalon.images[0] ? (
                                        <>
                                            <Image source={{ uri: editedSalon.images[0] }} style={styles.bannerPreview} />
                                            <View style={styles.bannerOverlay}>
                                                <Ionicons name="camera" size={24} color="#FFF" />
                                                <Text style={styles.bannerOverlayText}>Change Banner</Text>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={styles.bannerPlaceholder}>
                                            {uploadingBanner ? <ActivityIndicator color={theme.colors.primary} size="large" /> : (
                                                <>
                                                    <Ionicons name="cloud-upload" size={40} color={theme.colors.primary} />
                                                    <Text style={styles.bannerPlaceholderText}>Upload Banner Photo</Text>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* SALON GALLERY SECTION */}
                            <View style={styles.editCard}>
                                <View style={styles.editCardHeader}>
                                    <Ionicons name="images" size={20} color={theme.colors.success} />
                                    <Text style={styles.editCardTitle}>Salon Photos</Text>
                                </View>
                                <Text style={styles.editCardSubtitle}>Add photos of your salon (max 3)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                                    {/* Add Photo Button - show if less than 3 gallery photos */}
                                    {editedSalon.images.slice(1).length < 3 && (
                                        <TouchableOpacity
                                            style={styles.addPhotoBox}
                                            onPress={handlePickImage}
                                            disabled={uploadingImg}
                                        >
                                            {uploadingImg ? <ActivityIndicator color={theme.colors.primary} /> : (
                                                <>
                                                    <Ionicons name="add" size={32} color={theme.colors.primary} />
                                                    <Text style={styles.addPhotoText}>Add Photo</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}

                                    {/* Gallery Photos - only show images after index 0 (banner) */}
                                    {editedSalon.images.slice(1).map((img, idx) => (
                                        <View key={idx} style={styles.photoThumbContainer}>
                                            <Image source={{ uri: img }} style={styles.photoThumb} />
                                            <TouchableOpacity
                                                style={styles.deletePhotoBtn}
                                                onPress={() => handleRemoveImage(idx + 1)}
                                            >
                                                <Ionicons name="close" size={14} color="#FFF" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* BASIC DETAILS CARD */}
                            <View style={styles.editCard}>
                                <View style={styles.editCardHeader}>
                                    <Ionicons name="pencil" size={20} color={theme.colors.warning} />
                                    <Text style={styles.editCardTitle}>Basic Details</Text>
                                </View>

                                <InputField
                                    label="Salon Name"
                                    icon="storefront-outline"
                                    value={editedSalon.name}
                                    onChangeText={t => setEditedSalon({ ...editedSalon, name: t })}
                                    placeholder="E.g. Luxe Studio"
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />



                                <InputField
                                    label="About"
                                    icon="information-circle-outline"
                                    value={editedSalon.about}
                                    onChangeText={t => setEditedSalon({ ...editedSalon, about: t })}
                                    placeholder="Describe your services..."
                                    multiline
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />
                            </View>

                            {/* LOCATION & CONTACT CARD */}
                            <View style={styles.editCard}>
                                <View style={styles.editCardHeader}>
                                    <Ionicons name="location" size={20} color={theme.colors.info} />
                                    <Text style={styles.editCardTitle}>Location & Contact</Text>
                                </View>

                                <InputField
                                    label="Address"
                                    icon="location-outline"
                                    value={editedSalon.address}
                                    onChangeText={t => setEditedSalon({ ...editedSalon, address: t })}
                                    placeholder="Full Street Address"
                                    multiline
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />

                                <InputField
                                    label="Phone"
                                    icon="call-outline"
                                    value={editedSalon.phone}
                                    onChangeText={t => {
                                        const digits = t.replace(/\D/g, '');
                                        setEditedSalon({ ...editedSalon, phone: digits });
                                    }}
                                    placeholder="10-digit phone number"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />
                            </View>

                            {/* OPERATING HOURS CARD */}
                            <View style={styles.editCard}>
                                <View style={styles.editCardHeader}>
                                    <Ionicons name="time" size={20} color={theme.colors.success} />
                                    <Text style={styles.editCardTitle}>Operating Hours</Text>
                                </View>
                                <Text style={styles.editCardSubtitle}>Set your salon's open and close time (HH:MM format)</Text>

                                <InputField
                                    label="Open Time"
                                    icon="time-outline"
                                    value={editedSalon.openTime}
                                    onChangeText={t => setEditedSalon({ ...editedSalon, openTime: t })}
                                    placeholder="09:00"
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />

                                <InputField
                                    label="Close Time"
                                    icon="time-outline"
                                    value={editedSalon.closeTime}
                                    onChangeText={t => setEditedSalon({ ...editedSalon, closeTime: t })}
                                    placeholder="21:00"
                                    isEditing={isEditing}
                                    theme={theme}
                                    styles={styles}
                                />
                            </View>

                            {/* ACTION BUTTONS */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => setIsEditing(false)}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={handleSave}
                                    activeOpacity={0.8}
                                >
                                    {loading ? <ActivityIndicator color="#FFF" /> : (
                                        <Text style={styles.saveBtnText}>Save Changes</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                </View>
            </Animated.ScrollView>
        </View>
    );
};

const getStyles = (theme, isDarkMode) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // HEADER
    headerBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1C2237',
        zIndex: 0
    },
    headerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))' // Fallback for pure view
    },
    headerContent: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    badge: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    bigTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    ratingText: {
        color: '#EEE',
        marginLeft: 6,
        fontWeight: '600'
    },

    // NAV BAR
    navBar: {
        position: 'absolute',
        top: 40, // Status bar safe
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 100
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(10px)' // Note: only works on some platforms, good to have
    },
    activeEditBtn: {
        backgroundColor: theme.colors.error
    },
    navTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold'
    },

    // BODY CARD
    contentCard: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        minHeight: 800,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },

    // INPUTS
    inputContainer: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    inputLabel: {
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    input: {
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F5F7FA',
        padding: 16,
        borderRadius: 16,
        fontSize: 16,
        color: theme.colors.text,
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top'
    },
    readonlyText: {
        fontSize: 18,
        color: theme.colors.text,
        fontWeight: '500',
        paddingVertical: 8
    },

    // GALLERY
    gallerySection: {
        marginBottom: 24
    },
    addPhotoBox: {
        width: 100,
        height: 100,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        backgroundColor: isDarkMode ? 'rgba(124, 77, 255, 0.1)' : '#F3E5F5'
    },
    addPhotoText: {
        color: theme.colors.primary,
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4
    },
    photoThumbContainer: {
        position: 'relative',
        marginRight: 10
    },
    photoThumb: {
        width: 100,
        height: 100,
        borderRadius: 16
    },
    deletePhotoBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: theme.colors.error,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF'
    },

    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        marginTop: 8
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.divider,
        marginVertical: 20
    },
    row: {
        flexDirection: 'row'
    },

    // INFO CARDS
    infoCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: isDarkMode ? '#333' : '#F0F0F5'
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8
    },
    infoIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: isDarkMode ? 'rgba(124, 77, 255, 0.2)' : '#F3E5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    infoLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    infoValue: {
        fontSize: 16,
        color: theme.colors.text,
        fontWeight: '600'
    },
    infoDivider: {
        height: 1,
        backgroundColor: theme.colors.divider,
        marginVertical: 8,
        marginLeft: 58
    },

    // HOURS DISPLAY
    hoursRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 10
    },
    hourBox: {
        alignItems: 'center',
        flex: 1
    },
    hourLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 6
    },
    hourValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 4
    },
    hourDivider: {
        width: 1,
        height: 50,
        backgroundColor: theme.colors.divider
    },

    // BUTTONS
    editProfileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        marginTop: 10,
        marginBottom: 20,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6
    },
    editProfileBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 30,
        gap: 12
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#333' : '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    cancelBtnText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: 'bold'
    },
    saveBtn: {
        flex: 2,
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5
    },

    // EDIT MODE CARDS
    editCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: isDarkMode ? '#333' : '#F0F0F5'
    },
    editCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    editCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 10
    },
    editCardSubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 12
    },

    // BANNER PREVIEW
    bannerPreviewContainer: {
        width: '100%',
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8
    },
    bannerPreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    bannerOverlayText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 6
    },
    bannerPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: isDarkMode ? '#1E1E1E' : '#F3E5F5',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center'
    },
    bannerPlaceholderText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8
    }
});

export default SalonProfileScreen;
