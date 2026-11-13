import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Image,
    TouchableOpacity,
    Alert,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Animated
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadImage, updateUserProfile } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';

const { width } = Dimensions.get('window');

const OwnerProfileScreen = ({ navigation, route }) => {
    const { salon, user } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    // State
    const [loading, setLoading] = useState(false);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);

    // Owner Details - get from user object if available
    const [ownerDetails, setOwnerDetails] = useState({
        name: user?.name || salon?.ownerName || 'Salon Owner',
        email: user?.email || salon?.email || 'owner@example.com',
        profileImage: user?.profilePhoto || 'https://ui-avatars.com/api/?name=' + (user?.name || salon?.ownerName || 'Owner') + '&background=7C4DFF&color=fff&size=200',
        joinedDate: user?.createdAt ? `Member since ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'Member since Jan 2026'
    });

    // Animation
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true
        }).start();
    }, []);

    const handlePickImage = async () => {
        if (!isEditing) return;

        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setSelectedAsset(asset);
            // Update UI preview only
            setOwnerDetails(prev => ({ ...prev, profileImage: asset.uri }));
        }
    };

    const handleSave = async () => {
        // Validation
        const newName = ownerDetails.name?.trim();
        if (!newName) {
            Alert.alert('Validation Error', 'Name is required.');
            return;
        }

        setLoading(true);
        try {
            const userId = user?._id || user?.id;
            if (!userId) {
                Alert.alert('Error', 'User ID not found');
                setLoading(false);
                return;
            }

            let profilePhoto = ownerDetails.profileImage;

            // 1. Upload image if selected
            if (selectedAsset) {
                setUploadingImg(true);
                try {
                    const uploadedUrl = await uploadImage(selectedAsset, 'owners');
                    profilePhoto = uploadedUrl;
                } catch (error) {
                    Alert.alert('Warning', 'Image upload failed, profile update might be incomplete.');
                } finally {
                    setUploadingImg(false);
                }
            }

            const updates = {
                name: ownerDetails.name,
                profilePhoto: profilePhoto
            };

            await updateUserProfile(userId, updates);
            setSelectedAsset(null);
            setIsEditing(false);
            Alert.alert('Success', 'Profile updated successfully! 🎉');
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        // Clear cached data and navigate to login
                        await AsyncStorage.clear();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }]
                        });
                    }
                }
            ]
        );
    };

    const styles = getStyles(theme, isDarkMode);

    const StatCard = ({ icon, label, value, color }) => (
        <View style={[styles.statCard, { borderLeftColor: color }]}>
            <Ionicons name={icon} size={24} color={color} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    const SettingRow = ({ icon, label, value, onPress, danger }) => (
        <TouchableOpacity
            style={styles.settingRow}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.settingIconBox, danger && { backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.1)' : '#FFEBEE' }]}>
                <Ionicons name={icon} size={20} color={danger ? '#F44336' : '#7C4DFF'} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, danger && { color: '#F44336' }]}>{label}</Text>
                {value && <Text style={styles.settingValue}>{value}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1C2237" translucent />

            {/* Extended Header Background */}
            <View style={styles.headerBackground}>
                {/* Decorative circles */}
                <View style={styles.decorCircle1} />
                <View style={styles.decorCircle2} />
            </View>

            {/* Header Nav - Simple back button only */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 60 }}>
                {/* Profile Card */}
                <Animated.View style={[styles.profileCard, { opacity: fadeAnim }]}>
                    {/* Move Pencil Icon to Top Right of Card */}
                    <TouchableOpacity
                        onPress={() => setIsEditing(!isEditing)}
                        style={styles.cardHeaderEdit}
                    >
                        <Ionicons
                            name={isEditing ? "close-circle" : "pencil"}
                            size={24}
                            color={isEditing ? theme.colors.error : "#7C4DFF"}
                        />
                    </TouchableOpacity>

                    {/* Profile Image */}
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={handlePickImage}
                        activeOpacity={isEditing ? 0.7 : 1}
                    >
                        <Image
                            source={{ uri: ownerDetails.profileImage }}
                            style={styles.avatar}
                        />
                        {isEditing && (
                            <View style={styles.editAvatarBadge}>
                                <Ionicons name="camera" size={16} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                    {/* Name & Email */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        {isEditing ? (
                            <TextInput
                                style={styles.nameInput}
                                value={ownerDetails.name}
                                onChangeText={(text) => setOwnerDetails(prev => ({ ...prev, name: text }))}
                                autoFocus
                            />
                        ) : (
                            <Text style={styles.ownerName}>{ownerDetails.name}</Text>
                        )}
                    </View>
                    <Text style={styles.ownerEmail}>{ownerDetails.email}</Text>
                    <Text style={styles.memberSince}>{ownerDetails.joinedDate}</Text>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <StatCard icon="business" label="Salons" value="1" color={isDarkMode ? '#B388FF' : '#7C4DFF'} />
                        <StatCard icon="people" label="Staff" value={salon?.staff?.length || 3} color="#4CAF50" />
                        <StatCard icon="star" label="Rating" value={salon?.rating?.toFixed(1) || '0.0'} color="#FFD700" />
                    </View>
                </Animated.View>



                {/* Business Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>BUSINESS</Text>

                    <SettingRow
                        icon="card-outline"
                        label="Subscription"
                        value="Gold Plan"
                        onPress={() => navigation.navigate('Subscription', { salon })}
                    />
                    <SettingRow
                        icon="analytics-outline"
                        label="Reports & Analytics"
                        onPress={() => navigation.navigate('Reports', { salon })}
                    />
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SUPPORT</Text>

                    <SettingRow
                        icon="help-circle-outline"
                        label="Help Center"
                        onPress={() => Alert.alert('Help', 'Contact us at support@smartsalon.com')}
                    />
                    <SettingRow
                        icon="document-text-outline"
                        label="Terms & Privacy"
                        onPress={() => { }}
                    />
                    <SettingRow
                        icon="log-out-outline"
                        label="Logout"
                        onPress={handleLogout}
                        danger
                    />
                </View>

                {/* Save Button when Editing */}
                {isEditing && (
                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSave}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* App Version */}
                <Text style={styles.version}>SmartSalon v1.0.0</Text>

            </ScrollView>
        </View>
    );
};

const getStyles = (theme, isDarkMode) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    // Extended Header Background
    headerBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 220,
        backgroundColor: isDarkMode ? '#121212' : '#1C2237', // Kept dark, but adaptable if needed
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        overflow: 'hidden'
    },
    decorCircle1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(124, 77, 255, 0.15)',
        top: -80,
        right: -50
    },
    decorCircle2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(124, 77, 255, 0.1)',
        bottom: -30,
        left: -40
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5
    },
    editBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    profileCard: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        elevation: 12,
        marginBottom: 20,
        position: 'relative' // Required for absolute positioning of edit icon
    },
    cardHeaderEdit: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
        padding: 8
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 20,
        marginTop: -70
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 5,
        borderColor: theme.colors.surface
    },
    editAvatarBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: '#7C4DFF',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.colors.surface
    },
    verifiedBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: theme.colors.surface,
        borderRadius: 14,
        padding: 2
    },
    ownerName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4
    },
    nameInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#7C4DFF',
        paddingBottom: 4,
        minWidth: 200
    },
    ownerEmail: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 4
    },
    memberSince: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 20
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.divider
    },
    statCard: {
        alignItems: 'center',
        paddingLeft: 16,
        borderLeftWidth: 3
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 4
    },
    statLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary
    },
    section: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.divider
    },
    settingIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: isDarkMode ? 'rgba(124, 77, 255, 0.2)' : 'rgba(124, 77, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text
    },
    settingValue: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginTop: 2
    },
    saveBtn: {
        backgroundColor: '#7C4DFF',
        marginHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    version: {
        textAlign: 'center',
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginBottom: 40
    }
});

export default OwnerProfileScreen;
