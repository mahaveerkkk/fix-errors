import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Image,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Alert,
    StatusBar,
    SafeAreaView,
    ToastAndroid,
    Linking,
    Modal,
    FlatList,
    Share
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import { getSocket } from '../utils/socket';
import { getReviews, toggleFavorite, getFavorites, canReview, getSalonById, getSalonQueue, logSalonView } from '../services/api';
// Removed ScreenWrapper to handle custom full-screen layout
import WriteReviewModal from '../components/common/WriteReviewModal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Card from '../components/common/Card';

const { width, height } = Dimensions.get('window');

const SalonDetailsScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon, user } = route.params;

    // Local State for Real-time Updates
    const [salonData, setSalonData] = useState(salon);
    const [selectedServices, setSelectedServices] = useState([]);
    const [isFavorite, setIsFavorite] = useState(false);

    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewCooldown, setReviewCooldown] = useState(null); // Date when user can review again

    // Tab State
    const [activeTab, setActiveTab] = useState('services');

    // Image Viewer State
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Live Queue State
    const [queueCustomers, setQueueCustomers] = useState([]);
    const [queueWaitTime, setQueueWaitTime] = useState(0);

    // Check if salon is already favorited on load
    useEffect(() => {
        checkFavoriteStatus();
        fetchFreshSalonData(); // Fetch fresh data to get updated owner photo
        fetchQueueCustomers(); // Fetch live queue for avatar stack
        if (salon?._id || salon?.id) {
            logSalonView(salon._id || salon.id);
        }
    }, [user, salon]);

    // Fetch fresh salon data to get updated owner photo
    const fetchFreshSalonData = async () => {
        try {
            const freshData = await getSalonById(salon._id || salon.id);
            if (freshData) {
                setSalonData(freshData);
            }
        } catch (error) {
            // Keep using route.params salon data as fallback
        }
    };

    const checkFavoriteStatus = async () => {
        if (!user || (!user._id && !user.id)) return;
        try {
            const favorites = await getFavorites(user._id || user.id);
            const isFav = favorites.some(fav => (fav._id || fav) === (salon._id || salon.id));
            setIsFavorite(isFav);
        } catch (error) {
        }
    };

    const handleToggleFavorite = async () => {
        if (!user || (!user._id && !user.id)) {
            Alert.alert('Login Required', 'Please login to add favorites');
            return;
        }

        const newStatus = !isFavorite;
        setIsFavorite(newStatus); // Optimistic Update

        try {
            await toggleFavorite(user._id || user.id, salon._id || salon.id);
        } catch (error) {
            setIsFavorite(!newStatus); // Revert
            ToastAndroid.show('Failed to update favorite', ToastAndroid.SHORT);
        }
    };

    // --- SOCKET LISTENER ---
    useEffect(() => {
        const socket = getSocket();

        const handleShopStatusUpdate = (data) => {
            if (String(data.salonId) === String(salonData._id)) {
                setSalonData(prev => ({ ...prev, status: data.status }));
                // Removed Toast
            }
        };

        const handleQueueUpdate = (data) => {
            if (String(data.salonId) === String(salonData._id)) {
                setSalonData(prev => ({
                    ...prev,
                    liveQueueCount: data.liveQueueCount,
                    status: data.newStatus || prev.status
                }));
                // Refresh queue avatars
                fetchQueueCustomers();
            }
        };

        if (socket) {
            socket.on('shopStatusUpdate', handleShopStatusUpdate);
            socket.on('queueUpdate', handleQueueUpdate);
        }

        return () => {
            if (socket) {
                socket.off('shopStatusUpdate', handleShopStatusUpdate);
                socket.off('queueUpdate', handleQueueUpdate);
            }
        };
    }, [salonData._id]);

    // --- OWNER DATA (from populated ownerId) ---
    const ownerData = salonData.ownerId || {};
    const owner = {
        name: ownerData.name || salonData.ownerName || 'Salon Owner',
        phone: salonData.phone || ownerData.phone || null,
        image: ownerData.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerData.name || 'Owner')}&background=0D47A1&color=fff`,
        about: salonData.description || 'Expert stylist'
    };

    // --- CALL HANDLER ---
    const handleCall = () => {
        const phone = owner.phone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            Alert.alert('No Phone', 'Phone number not available for this salon.');
        }
    };

    // --- MESSAGE HANDLER ---
    const handleMessage = () => {
        const phone = owner.phone;
        if (phone) {
            Linking.openURL(`sms:${phone}`);
        } else {
            Alert.alert('No Phone', 'Phone number not available for this salon.');
        }
    };

    const galleryImages = salonData.images?.length > 0 ? salonData.images : [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3',
        'https://images.unsplash.com/photo-1521590832896-401615e3d684?ixlib=rb-4.0.3',
        'https://images.unsplash.com/photo-1562322140-8baeececf3df?ixlib=rb-4.0.3'
    ];

    // --- HIGH-QUALITY MATCHED PHOTOS FOR SERVICES (CLOUDINARY HOSTED) ---
    const getServicePhoto = (service) => {
        if (service?.photos && service.photos.length > 0 && service.photos[0] && typeof service.photos[0] === 'string' && service.photos[0].trim() !== '') {
            const p = service.photos[0];
            if (!p.includes('dummy') && !p.includes('placeholder')) {
                return p;
            }
        }

        const name = (service?.name || '').toLowerCase();
        const cat = (service?.category || service?.type || '').toLowerCase();

        // Exact match by service name/type using Cloudinary hosted images
        if (name.includes('cut') || name.includes('hair') && !name.includes('color') && !name.includes('spa')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266034/stylq/services/service_haircut_1791265836653.jpg';
        }
        if (name.includes('shave') || name.includes('beard') || name.includes('trim')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266035/stylq/services/service_shave_1791265853904.jpg';
        }
        if (name.includes('facial') || name.includes('cleanup') || name.includes('clean') || name.includes('glow')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266036/stylq/services/service_facial_1791265875671.jpg';
        }
        if (name.includes('color') || name.includes('colour') || name.includes('highlight') || name.includes('dye')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266037/stylq/services/service_haircolor_1791265894421.jpg';
        }
        if (name.includes('massage') || name.includes('head') || name.includes('spa')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266038/stylq/services/service_headmassage_1791265912838.jpg';
        }

        // Category fallbacks
        if (cat.includes('hair')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266034/stylq/services/service_haircut_1791265836653.jpg';
        }
        if (cat.includes('face') || cat.includes('skin')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266036/stylq/services/service_facial_1791265875671.jpg';
        }
        if (cat.includes('beard') || cat.includes('shave')) {
            return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266035/stylq/services/service_shave_1791265853904.jpg';
        }

        // General fallback
        return 'https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266034/stylq/services/service_haircut_1791265836653.jpg';
    };

    const services = (salonData.services && salonData.services.length > 0) ? salonData.services : [
        {
            id: '1', name: 'Haircut & Styling', price: 150, duration: 30, category: 'Hair',
            photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266034/stylq/services/service_haircut_1791265836653.jpg']
        },
        {
            id: '2', name: 'Beard Trim & Shave', price: 100, duration: 20, category: 'Face',
            photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266035/stylq/services/service_shave_1791265853904.jpg']
        },
        {
            id: '3', name: 'Face Cleanup & Facial', price: 350, duration: 45, category: 'Face',
            photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266036/stylq/services/service_facial_1791265875671.jpg']
        },
        {
            id: '4', name: 'Hair Color & Highlights', price: 650, duration: 60, category: 'Hair',
            photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266037/stylq/services/service_haircolor_1791265894421.jpg']
        },
        {
            id: '5', name: 'Head Massage & Spa', price: 200, duration: 30, category: 'Relaxation',
            photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266038/stylq/services/service_headmassage_1791265912838.jpg']
        },
    ];

    // --- DYNAMIC FACILITIES (from backend) ---
    const facilities = salonData?.facilities?.length > 0
        ? salonData.facilities
        : [
            { icon: 'wifi', name: 'WiFi' },
            { icon: 'car', name: 'Parking' },
            { icon: 'cafe', name: 'Coffee' },
            { icon: 'snow', name: 'AC' },
        ];

    // --- REVIEWS DATA ---
    // --- REVIEWS STATE ---
    const [reviews, setReviews] = useState([]);
    const [averageRating, setAverageRating] = useState('0');

    useEffect(() => {
        fetchSalonReviews();

        const unsubscribe = navigation.addListener('focus', () => {
            fetchSalonReviews();
        });
        return unsubscribe;
    }, [salon]);

    // Fetch queue customers for avatar stack
    const fetchQueueCustomers = async () => {
        try {
            const salonId = salon._id || salon.id;
            const data = await getSalonQueue(salonId);
            if (data.queue) {
                setQueueCustomers(data.queue);
                setQueueWaitTime(data.totalWaitTime || 0);
            }
        } catch (error) {
        }
    };

    const fetchSalonReviews = async () => {
        try {
            const salonId = salon._id || salon.id;
            const data = await getReviews(salonId);
            if (data.reviews && data.reviews.length > 0) {
                // Map API response to match UI format
                const formattedReviews = data.reviews.map(r => ({
                    id: r._id,
                    name: r.userId?.name || 'User',
                    rating: r.rating,
                    comment: r.comment,
                    time: new Date(r.createdAt).toLocaleDateString(),
                    image: r.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${r.userId?.name || 'User'}`
                }));
                setReviews(formattedReviews);
                const computedAvg = data.stats?.averageRating ?? data.averageRating ?? salonData.rating ?? 0;
                setAverageRating(Number(computedAvg).toFixed(1));
            } else {
                // No reviews - show empty state
                setReviews([]);
                setAverageRating(salonData.rating ? Number(salonData.rating).toFixed(1) : '0');
            }
        } catch (error) {
            setReviews([]);
        }
    };

    // --- LOGIC ---

    const toggleService = (service) => {
        const serviceId = service.id || service._id;
        const isSelected = selectedServices.find(s => (s.id || s._id) === serviceId);

        if (isSelected) {
            setSelectedServices(selectedServices.filter(s => (s.id || s._id) !== serviceId));
        } else {
            setSelectedServices([...selectedServices, service]);
        }
    };

    const totalAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);

    // Handle Write Review with 3-month cooldown check
    const handleWriteReview = async () => {
        const isGuest = !user || (!user._id && !user.id);
        if (isGuest) {
            Alert.alert(
                'Login Required',
                'Please login to write a review.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Login', onPress: () => navigation.navigate('Login') }
                ]
            );
            return;
        }

        try {
            const salonId = salonData._id || salonData.id;
            const userId = user._id || user.id;
            const result = await canReview(salonId, userId);

            if (result.canReview) {
                setReviewCooldown(null);
                setShowReviewModal(true);
            } else {
                const nextDate = new Date(result.nextReviewDate);
                const formattedDate = nextDate.toLocaleDateString('hi-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                Alert.alert(
                    '⏳ Thoda Ruko!',
                    `Aap ${formattedDate} ke baad dubara review de sakte hain.\n\n(3 mahine mein ek baar review allowed hai)`,
                    [{ text: 'OK', style: 'default' }]
                );
            }
        } catch (error) {
            // If check fails, allow review attempt (backend will catch it)
            setShowReviewModal(true);
        }
    };

    const handleBookNow = () => {
        const isGuest = !user || (!user._id && !user.id);
        if (isGuest) {
            Alert.alert(
                'Login Required',
                'Please login to book a service.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Login', onPress: () => navigation.navigate('Login') }
                ]
            );
            return;
        }

        if (selectedServices.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one service to continue');
            return;
        }
        // Ensure we pass updated salonData
        navigation.navigate('StaffSelection', { salon: salonData, selectedServices, user });
    };

    // --- RENDERERS ---

    // --- TAB BAR ---
    const TABS = [
        { key: 'services', label: 'Services' },
        { key: 'staff', label: 'Stylists' },
        { key: 'reviews', label: 'Reviews' },
        { key: 'about', label: 'About' },
    ];

    const handleTabPress = (tabKey) => {
        if (tabKey === 'reviews') {
            navigation.navigate('AllReviews', { salon: salonData });
        } else {
            setActiveTab(tabKey);
        }
    };

    const renderTabBar = () => (
        <View style={[tabStyles.tabContainer, { borderBottomColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[tabStyles.tab, isActive && tabStyles.tabActive]}
                        onPress={() => handleTabPress(tab.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[tabStyles.tabText, { color: isDarkMode ? '#888' : '#999' }, isActive && tabStyles.tabTextActive]}>
                            {tab.label}
                        </Text>
                        {isActive && <View style={tabStyles.tabIndicator} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    // --- ABOUT SECTION ---
    const renderAbout = () => {
        const timings = salonData.timings || {};
        const social = salonData.socialLinks || {};
        const todayIndex = new Date().getDay();
        const todayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][todayIndex];
        const isOpenToday = timings.days?.includes(todayName);

        // Always show social links — use dummy if not set
        const socialItems = [
            { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', label: 'Instagram', dummy: 'https://instagram.com' },
            { key: 'facebook', icon: 'logo-facebook', color: '#1877F2', label: 'Facebook', dummy: 'https://facebook.com' },
            { key: 'youtube', icon: 'logo-youtube', color: '#FF0000', label: 'YouTube', dummy: 'https://youtube.com' },
            { key: 'website', icon: 'globe-outline', color: '#7C4DFF', label: 'Website', dummy: 'https://google.com' },
        ];

        const openImage = (index) => {
            setSelectedImageIndex(index);
            setImageViewerVisible(true);
        };

        return (
            <View style={aboutStyles.container}>
                {/* Photo Gallery — Clickable */}
                {galleryImages.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[aboutStyles.simpleTitle, { color: theme.colors.text }]}>Photos</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {galleryImages.map((img, i) => (
                                <TouchableOpacity key={i} onPress={() => openImage(i)} activeOpacity={0.85}>
                                    <Image
                                        source={{ uri: img }}
                                        style={aboutStyles.galleryImage}
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Description — Simple */}
                {(salonData.description || owner.about) && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[aboutStyles.simpleTitle, { color: theme.colors.text }]}>About</Text>
                        <Text style={[aboutStyles.simpleText, { color: theme.colors.textSecondary }]}>
                            {salonData.description || owner.about}
                        </Text>
                    </View>
                )}

                {/* Working Hours — Simple */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={[aboutStyles.simpleTitle, { color: theme.colors.text }]}>Working Hours</Text>
                        <View style={[aboutStyles.statusPill, { backgroundColor: isOpenToday ? (isDarkMode ? 'rgba(76,175,80,0.15)' : '#E8F5E9') : (isDarkMode ? 'rgba(244,67,54,0.15)' : '#FFEBEE'), marginLeft: 10 }]}>
                            <View style={[aboutStyles.statusDot, { backgroundColor: isOpenToday ? '#4CAF50' : '#F44336' }]} />
                            <Text style={[aboutStyles.statusText, { color: isOpenToday ? '#4CAF50' : '#F44336' }]}>
                                {isOpenToday ? 'Open' : 'Closed'}
                            </Text>
                        </View>
                    </View>
                    <Text style={[aboutStyles.simpleText, { color: theme.colors.textSecondary }]}>
                        {timings.open || '09:00'} — {timings.close || '21:00'}
                    </Text>
                    {timings.days && timings.days.length > 0 && (
                        <Text style={[aboutStyles.simpleText, { marginTop: 4, color: theme.colors.textSecondary }]}>
                            {timings.days.join('  •  ')}
                        </Text>
                    )}
                </View>

                {/* Social Links — Always show */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={[aboutStyles.simpleTitle, { color: theme.colors.text }]}>Follow Us</Text>
                    <View style={aboutStyles.socialRow}>
                        {socialItems.map(item => (
                            <TouchableOpacity
                                key={item.key}
                                style={aboutStyles.socialBtn}
                                onPress={() => Linking.openURL(social[item.key] || item.dummy)}
                            >
                                <View style={[aboutStyles.socialIconCircle, { backgroundColor: item.color + (isDarkMode ? '25' : '15') }]}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text style={[aboutStyles.socialLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    const renderHeader = () => {
        const isOpen = salonData.status === 'open' || salonData.status === 'active';
        return (
            <View style={styles.headerContainer}>
                <Image source={{ uri: galleryImages[0] }} style={styles.heroImage} />
                <View style={styles.heroOverlay} />

                {/* Top Nav Bar */}
                <View style={styles.navBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.rightIcons}>
                        <TouchableOpacity style={styles.iconBtn} onPress={handleToggleFavorite} activeOpacity={0.8}>
                            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#FF5252" : "#FFF"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={async () => {
                            try {
                                const salonId = salonData._id || salonData.id;
                                const salonLink = `https://styleq.social`;
                                const rating = averageRating || salonData.rating || '0';
                                const message = `✂️ Check out *${salonData.name}* on StylQ!\n\n⭐ ${rating} Rating | 📍 ${salonData.address || 'Premium Salon'}\n\n🔥 Book your appointment now — skip the wait & join the live queue!\n\n👉 ${salonLink}\n\nDownload StylQ — Smart Salon Booking`;
                                await Share.share({
                                    message,
                                    title: `${salonData.name} — Book on StylQ`,
                                    url: salonLink,
                                });
                            } catch (e) {
                            }
                        }} activeOpacity={0.8}>
                            <Ionicons name="share-social-outline" size={22} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Hero Bottom Badges (Subtle Floating Info) */}
                <View style={styles.heroBottomRow}>
                    <View style={styles.vipBadge}>
                        <Ionicons name="sparkles" size={12} color="#FFD700" style={{ marginRight: 4 }} />
                        <Text style={styles.vipText}>PREMIUM VERIFIED</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isOpen ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)' }]}>
                        <View style={styles.statusDotWhite} />
                        <Text style={styles.statusBadgeText}>{isOpen ? 'Open Now' : 'Closed'}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderFacilities = () => (
        <View style={styles.facilitiesSection}>
            <Text style={[styles.sectionTitleSmall, { color: theme.colors.text }]}>Salon Amenities</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.facilitiesScroll}
            >
                {facilities.map((item, index) => (
                    <View
                        key={index}
                        style={[
                            styles.facilityPill,
                            {
                                backgroundColor: isDarkMode ? '#1E1B2E' : '#F5F3FF',
                                borderColor: isDarkMode ? 'rgba(124,77,255,0.3)' : '#EDE9FE'
                            }
                        ]}
                    >
                        <Ionicons name={item.icon || 'checkmark-circle-outline'} size={15} color="#7C4DFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.facilityPillText, { color: isDarkMode ? '#DDD' : '#4C1D95' }]}>{item.name}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );

    const renderServices = () => (
        <View style={styles.sectionContainer}>
            <View style={styles.servicesHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Available Services</Text>
                <Text style={[styles.servicesCountBadge, { color: theme.colors.textSecondary }]}>{services.length} items</Text>
            </View>
            <View style={styles.servicesList}>
                {services.map((service) => {
                    const serviceId = service.id || service._id;
                    const isSelected = selectedServices.find(s => (s.id || s._id) === serviceId);
                    const hasPhoto = service.photos && service.photos.length > 0;

                    return (
                        <TouchableOpacity
                            key={serviceId}
                            style={[
                                styles.serviceCardNew,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: isSelected ? '#7C4DFF' : (isDarkMode ? '#2D2D3A' : '#F0F0F5')
                                },
                                isSelected && { backgroundColor: isDarkMode ? '#201A36' : '#F8F6FF' }
                            ]}
                            onPress={() => toggleService(service)}
                            activeOpacity={0.85}
                        >
                            {/* Service Photo with smart matching */}
                            <Image
                                source={{ uri: getServicePhoto(service) }}
                                style={styles.serviceImageNew}
                            />

                            {/* Service Information */}
                            <View style={styles.serviceInfoCol}>
                                <Text style={[styles.serviceTitleNew, { color: theme.colors.text }]} numberOfLines={1}>
                                    {service.name}
                                </Text>
                                <View style={styles.serviceMetaRow}>
                                    <View style={styles.durationChip}>
                                        <Ionicons name="time-outline" size={11} color="#666" style={{ marginRight: 3 }} />
                                        <Text style={styles.durationChipText}>{service.duration || 30} mins</Text>
                                    </View>
                                    <Text style={styles.categoryTextPill}>{service.category || service.type || 'Salon Care'}</Text>
                                </View>
                                <Text style={styles.servicePriceNew}>
                                    ₹{service.price}
                                </Text>
                            </View>

                            {/* Urban Company style Add / Added Button */}
                            <TouchableOpacity
                                style={[
                                    styles.serviceActionBtn,
                                    isSelected ? styles.serviceActionBtnActive : styles.serviceActionBtnInactive
                                ]}
                                onPress={() => toggleService(service)}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name={isSelected ? "checkmark" : "add"}
                                    size={16}
                                    color={isSelected ? "#FFF" : "#7C4DFF"}
                                    style={{ marginRight: 2 }}
                                />
                                <Text style={[
                                    styles.serviceActionBtnText,
                                    { color: isSelected ? "#FFF" : "#7C4DFF" }
                                ]}>
                                    {isSelected ? 'ADDED' : 'ADD'}
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    // --- REVIEWS SECTION ---
    const renderReviews = () => (
        <View style={styles.sectionContainer}>
            <View style={styles.rowBetween}>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => navigation.navigate('AllReviews', { salon: salonData })}
                >
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reviews</Text>
                    <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.ratingBadgeText}>{averageRating}</Text>
                    </View>
                </TouchableOpacity>
                {reviews.length > 0 && (
                    <TouchableOpacity onPress={() => navigation.navigate('AllReviews', { salon: salonData })}>
                        <Text style={styles.seeAllText}>See All ({reviews.length})</Text>
                    </TouchableOpacity>
                )}
            </View>

            {reviews.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Ionicons name="chatbubble-outline" size={40} color={isDarkMode ? '#555' : '#CCC'} />
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>No reviews yet</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Be the first to review!</Text>
                </View>
            ) : (
                reviews.slice(0, 3).map((review) => (
                    <View key={review.id} style={[styles.reviewCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FC' }]}>
                        <View style={styles.reviewHeader}>
                            <Image source={{ uri: review.image }} style={styles.reviewAvatar} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.reviewName, { color: theme.colors.text }]}>{review.name}</Text>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Ionicons
                                            key={star}
                                            name={star <= review.rating ? "star" : "star-outline"}
                                            size={14}
                                            color="#FFD700"
                                            style={{ marginRight: 2 }}
                                        />
                                    ))}
                                </View>
                            </View>
                            <Text style={[styles.reviewTime, { color: theme.colors.textSecondary }]}>{review.time}</Text>
                        </View>
                        <Text style={[styles.reviewComment, { color: theme.colors.textSecondary }]}>{review.comment}</Text>
                    </View>
                ))
            )}

            {/* Write Review Button */}
            <TouchableOpacity
                style={[styles.writeReviewBtn, { backgroundColor: isDarkMode ? 'rgba(124,77,255,0.1)' : 'rgba(124, 77, 255, 0.05)' }]}
                onPress={handleWriteReview}
            >
                <Ionicons name="create-outline" size={20} color="#7C4DFF" />
                <Text style={styles.writeReviewText}>Write a Review</Text>
            </TouchableOpacity>
        </View>
    );

    // Handle review success - refresh reviews list
    const handleReviewSuccess = () => {
        fetchSalonReviews();
        ToastAndroid.show('⭐ Review Submitted!', ToastAndroid.SHORT);
    };

    // --- STAFF / STYLISTS SECTION ---
    const renderStaff = () => {
        const staffList = salonData.staff || [];

        if (staffList.length === 0) {
            return (
                <View style={[styles.sectionContainer, { alignItems: 'center', paddingVertical: 40 }]}>
                    <Ionicons name="people-outline" size={48} color={theme.colors.textLight} />
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 12, fontSize: 16, fontWeight: 'bold' }}>No Staff Listed</Text>
                    <Text style={{ color: theme.colors.textLight, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                        Services are handled directly by the salon owner.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.sectionContainer}>
                {staffList.map((member, index) => {
                    const avatarUrl = member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'Stylist')}&background=7C4DFF&color=fff&bold=true`;
                    const isAvailable = member.isAvailable !== false;

                    return (
                        <View
                            key={member._id || index}
                            style={[
                                staffStyles.staffCard,
                                { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#333' : '#EEE' }
                            ]}
                        >
                            <Image source={{ uri: avatarUrl }} style={staffStyles.staffAvatar} />
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[staffStyles.staffName, { color: theme.colors.text }]}>{member.name}</Text>
                                    <View style={[staffStyles.statusBadgePill, { backgroundColor: isAvailable ? (isDarkMode ? 'rgba(76,175,80,0.15)' : '#E8F5E9') : (isDarkMode ? 'rgba(244,67,54,0.15)' : '#FFEBEE') }]}>
                                        <View style={[staffStyles.statusDot, { backgroundColor: isAvailable ? '#4CAF50' : '#F44336' }]} />
                                        <Text style={[staffStyles.statusBadgeText, { color: isAvailable ? '#4CAF50' : '#F44336' }]}>
                                            {isAvailable ? 'Available' : 'Busy'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[staffStyles.staffRole, { color: theme.colors.textSecondary }]}>{member.role || 'Hair & Beauty Specialist'}</Text>

                                {member.liveQueueCount > 0 ? (
                                    <Text style={{ color: '#7C4DFF', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                                        👥 {member.liveQueueCount} in queue
                                    </Text>
                                ) : (
                                    <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                                        ✨ No waiting queue
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderStaffStrip = () => {
        const staffList = salonData.staff || [];
        if (staffList.length === 0) return null;

        return (
            <View style={staffStyles.stripContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[staffStyles.stripTitle, { color: theme.colors.text }]}>Our Expert Stylists</Text>
                    <TouchableOpacity onPress={() => setActiveTab('staff')}>
                        <Text style={{ color: '#7C4DFF', fontSize: 13, fontWeight: 'bold' }}>See All ({staffList.length})</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {staffList.map((member, i) => {
                        const avatarUrl = member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'Stylist')}&background=7C4DFF&color=fff&bold=true`;
                        const isAvailable = member.isAvailable !== false;
                        return (
                            <TouchableOpacity
                                key={member._id || i}
                                style={staffStyles.avatarItem}
                                onPress={() => setActiveTab('staff')}
                                activeOpacity={0.8}
                            >
                                <View style={staffStyles.avatarWrapper}>
                                    <Image source={{ uri: avatarUrl }} style={staffStyles.stripAvatar} />
                                    <View style={[staffStyles.onlineDot, { backgroundColor: isAvailable ? '#4CAF50' : '#F44336' }]} />
                                </View>
                                <Text style={[staffStyles.avatarName, { color: theme.colors.text }]} numberOfLines={1}>{member.name}</Text>
                                <Text style={[staffStyles.avatarRole, { color: theme.colors.textSecondary }]} numberOfLines={1}>{member.role || 'Stylist'}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 130 }}
            >
                {renderHeader()}

                <View style={[styles.bodyContent, { backgroundColor: theme.colors.background }]}>

                    {/* SALON HERO SUMMARY CARD - Clean Luxury Typography */}
                    <View style={[styles.salonSummaryCard, { backgroundColor: theme.colors.surface, borderColor: isDarkMode ? '#2D2D3A' : '#EDE8F5' }]}>
                        <View style={styles.salonTitleRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={[styles.salonTitleText, { color: theme.colors.text }]} numberOfLines={2}>
                                    {salonData.name}
                                </Text>
                                <View style={styles.salonAddressRow}>
                                    <Ionicons name="location-sharp" size={14} color="#7C4DFF" style={{ marginTop: 2, marginRight: 4 }} />
                                    <Text style={[styles.salonAddressText, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                        {salonData.address || 'Location information not provided'}
                                    </Text>
                                </View>
                            </View>

                            {/* Map Directions Button */}
                            <TouchableOpacity
                                style={styles.mapDirectionsBtn}
                                onPress={() => {
                                    const lat = salonData.location?.lat;
                                    const lng = salonData.location?.lng;
                                    if (lat && lng) {
                                        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                        Linking.openURL(url);
                                    } else {
                                        Alert.alert('Location Not Available', 'Salon location coordinates not found.');
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="navigate" size={14} color="#FFF" />
                                <Text style={styles.mapDirectionsBtnText}>Directions</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Rating & Reviews Bar */}
                        <View style={styles.salonRatingRow}>
                            <TouchableOpacity
                                style={styles.ratingBadgePill}
                                onPress={() => navigation.navigate('AllReviews', { salon: salonData })}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="star" size={14} color="#FFB800" />
                                <Text style={styles.ratingScoreText}>{averageRating || salonData.rating || '5.0'}</Text>
                                <Text style={styles.ratingCountText}>({salonData.reviewCount || reviews.length || 0} reviews)</Text>
                                <Ionicons name="chevron-forward" size={12} color="#999" style={{ marginLeft: 2 }} />
                            </TouchableOpacity>

                            <View style={styles.verifiedPartnerBadge}>
                                <Ionicons name="shield-checkmark" size={13} color="#10B981" style={{ marginRight: 4 }} />
                                <Text style={styles.verifiedPartnerText}>StylQ Partner</Text>
                            </View>
                        </View>
                    </View>

                    {/* OWNER CARD - NEW STYLE */}
                    <View style={[styles.ownerCardNew, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FD' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: owner.image }} style={styles.ownerAvatarNew} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={[styles.ownerLabelNew, { color: theme.colors.textSecondary }]}>OWNER</Text>
                                <Text style={[styles.ownerNameNew, { color: theme.colors.text }]}>{owner.name}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: isDarkMode ? 'rgba(76,175,80,0.15)' : '#E8F5E9' }]}
                                onPress={handleCall}
                            >
                                <Ionicons name="call" size={20} color="#4CAF50" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.contactBtn, { backgroundColor: isDarkMode ? 'rgba(33,150,243,0.15)' : '#E3F2FD' }]}
                                onPress={handleMessage}
                            >
                                <Ionicons name="chatbubble" size={20} color="#2196F3" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderFacilities()}

                    {/* LIVE QUEUE BAR — Stacked Avatars */}
                    <TouchableOpacity
                        style={[liveQueueStyles.container, { backgroundColor: isDarkMode ? 'rgba(124,77,255,0.1)' : '#F8F5FF', borderColor: isDarkMode ? 'rgba(124,77,255,0.3)' : '#E8DEFF' }]}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('LiveQueue', { salon: salonData, user })}
                    >
                        {/* Left: Stacked Avatars */}
                        <View style={liveQueueStyles.leftSection}>
                            <View style={liveQueueStyles.avatarStack}>
                                {queueCustomers.length > 0 ? (
                                    queueCustomers.slice(0, 4).map((customer, index) => {
                                        const colors = ['7C4DFF', 'FF5252', '00BFA5', 'FF6D00', '2979FF'];
                                        const bgColor = colors[index % colors.length];
                                        const photoUrl = customer.userId?.profilePhoto
                                            || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.userId?.name || 'U')}&background=${bgColor}&color=fff&bold=true&size=128`;
                                        return (
                                            <Image
                                                key={customer._id || index}
                                                source={{ uri: photoUrl }}
                                                style={[
                                                    liveQueueStyles.stackedAvatar,
                                                    { marginLeft: index === 0 ? 0 : -12, zIndex: 4 - index }
                                                ]}
                                            />
                                        );
                                    })
                                ) : (
                                    // Empty state — show placeholder circles
                                    [1, 2, 3].map((_, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                liveQueueStyles.stackedAvatar,
                                                liveQueueStyles.emptyAvatar,
                                                { marginLeft: index === 0 ? 0 : -12, zIndex: 3 - index }
                                            ]}
                                        >
                                            <Ionicons name="person" size={14} color="#CCC" />
                                        </View>
                                    ))
                                )}
                                {queueCustomers.length > 4 && (
                                    <View style={[liveQueueStyles.stackedAvatar, liveQueueStyles.moreAvatar, { marginLeft: -12, zIndex: 5 }]}>
                                        <Text style={liveQueueStyles.moreAvatarText}>+{queueCustomers.length - 4}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={liveQueueStyles.queueInfo}>
                                <Text style={[liveQueueStyles.queueTitle, { color: theme.colors.text }]}>
                                    {queueCustomers.length > 0 ? `${queueCustomers.length} in Queue` : 'No one in Queue'}
                                </Text>
                                <Text style={liveQueueStyles.queueSubtitle}>
                                    {queueCustomers.length > 0 ? `~${queueWaitTime || queueCustomers.length * 15}m wait` : 'Join now — zero wait!'}
                                </Text>
                            </View>
                        </View>

                        {/* Right: View Queue Button */}
                        <View style={liveQueueStyles.viewBtn}>
                            <Ionicons name="people" size={16} color="#FFF" />
                            <Text style={liveQueueStyles.viewBtnText}>View Queue</Text>
                            <Ionicons name="chevron-forward" size={14} color="#FFF" />
                        </View>
                    </TouchableOpacity>

                    {renderStaffStrip()}

                    {renderTabBar()}

                    {activeTab === 'services' && renderServices()}
                    {activeTab === 'staff' && renderStaff()}
                    {activeTab === 'about' && renderAbout()}
                </View>

            </ScrollView >

            {/* FLOATING CART BAR - LUXURY PILL */}
            {selectedServices.length > 0 && (
                <View style={styles.floatingCartContainer}>
                    <View style={[styles.floatingCartCard, { backgroundColor: '#1A1829' }]}>
                        <View style={styles.floatingCartLeft}>
                            <View style={styles.cartCountBadge}>
                                <Text style={styles.cartCountText}>{selectedServices.length}</Text>
                            </View>
                            <View>
                                <Text style={styles.floatingCartTitle}>
                                    ₹{totalAmount}
                                </Text>
                                <Text style={styles.floatingCartSubtitle}>
                                    {selectedServices.length === 1 ? '1 service selected' : `${selectedServices.length} services selected`}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.floatingBookBtn}
                            onPress={handleBookNow}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.floatingBookBtnText}>Book Now</Text>
                            <Ionicons name="arrow-forward" size={17} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Fullscreen Image Viewer */}
            <Modal visible={imageViewerVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8 }}
                        onPress={() => setImageViewerVisible(false)}
                    >
                        <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', top: 55, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{selectedImageIndex + 1} / {galleryImages.length}</Text>
                    </View>
                    <FlatList
                        data={galleryImages}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={selectedImageIndex}
                        getItemLayout={(_, index) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * index, index })}
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                            setSelectedImageIndex(idx);
                        }}
                        renderItem={({ item }) => (
                            <View style={{ width: Dimensions.get('window').width, justifyContent: 'center', alignItems: 'center' }}>
                                <Image
                                    source={{ uri: item }}
                                    style={{ width: Dimensions.get('window').width - 20, height: Dimensions.get('window').height * 0.6, borderRadius: 12 }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                        keyExtractor={(_, i) => i.toString()}
                    />
                </View>
            </Modal>

            {/* Write Review Modal */}
            <WriteReviewModal
                visible={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                salonId={salonData._id || salonData.id}
                userId={user?._id || user?.id}
                salonName={salonData.name}
                onSuccess={handleReviewSuccess}
            />
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    // HERO
    headerContainer: {
        height: 280, // Optimized height so hero doesn't dominate screen
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.22)',
    },
    navBar: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 10
    },
    iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightIcons: {
        flexDirection: 'row',
        gap: 10
    },
    heroBottomRow: {
        position: 'absolute',
        bottom: 34,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(26,24,41,0.85)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.35)'
    },
    vipText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFD700',
        letterSpacing: 0.5
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusDotWhite: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFF',
        marginRight: 5
    },
    statusBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700'
    },

    // BODY
    bodyContent: {
        paddingHorizontal: 18,
        paddingTop: 20,
        marginTop: -22,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        backgroundColor: '#FFF',
        minHeight: height - 260
    },

    // SALON SUMMARY CARD
    salonSummaryCard: {
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    salonTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    salonTitleText: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    salonAddressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 2,
    },
    salonAddressText: {
        fontSize: 12.5,
        lineHeight: 17,
        flex: 1,
    },
    mapDirectionsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C4DFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        gap: 4,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    mapDirectionsBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700'
    },
    salonRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    ratingBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    ratingScoreText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#B45309',
        marginLeft: 4,
    },
    ratingCountText: {
        fontSize: 11.5,
        color: '#78350F',
        marginLeft: 4,
    },
    verifiedPartnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    verifiedPartnerText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#065F46',
    },

    // OWNER CARD NEW
    ownerCardNew: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16
    },
    ownerAvatarNew: {
        width: 44,
        height: 44,
        borderRadius: 22
    },
    ownerLabelNew: {
        fontSize: 10,
        color: '#888',
        fontWeight: 'bold',
        letterSpacing: 1
    },
    ownerNameNew: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    contactBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // FACILITIES - Modern Pill Style
    facilitiesSection: {
        marginBottom: 18
    },
    sectionTitleSmall: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
        marginBottom: 10,
    },
    facilitiesScroll: {
        paddingRight: 10,
        gap: 8,
    },
    facilityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    facilityPillText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // CUSTOMERS
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },

    // SERVICES
    sectionContainer: {
        marginBottom: 20
    },
    servicesHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1A1F2B',
    },
    servicesCountBadge: {
        fontSize: 12,
        fontWeight: '600',
    },
    servicesList: {
        gap: 10
    },
    serviceCardNew: {
        padding: 12,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    serviceImageNew: {
        width: 60,
        height: 60,
        borderRadius: 14,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    serviceIconBoxNew: {
        width: 60,
        height: 60,
        borderRadius: 14,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceInfoCol: {
        flex: 1,
        justifyContent: 'center',
    },
    serviceTitleNew: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    serviceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 6,
    },
    durationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    durationChipText: {
        fontSize: 10.5,
        color: '#4B5563',
        fontWeight: '600',
    },
    categoryTextPill: {
        fontSize: 10.5,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    servicePriceNew: {
        fontSize: 16,
        fontWeight: '850',
        color: '#7C4DFF',
    },
    serviceActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 70,
    },
    serviceActionBtnInactive: {
        backgroundColor: '#F5F3FF',
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    serviceActionBtnActive: {
        backgroundColor: '#7C4DFF',
    },
    serviceActionBtnText: {
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },

    // FLOATING CART PILL
    floatingCartContainer: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        zIndex: 99,
    },
    floatingCartCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 22,
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(124,77,255,0.4)',
    },
    floatingCartLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cartCountBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#7C4DFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    cartCountText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
    floatingCartTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
    floatingCartSubtitle: {
        color: '#A5B4FC',
        fontSize: 11,
        fontWeight: '500',
    },
    floatingBookBtn: {
        backgroundColor: '#7C4DFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        gap: 6,
    },
    floatingBookBtnText: {
        color: '#FFF',
        fontSize: 13.5,
        fontWeight: '700',
    },
});

// --- TAB STYLES ---
const tabStyles = StyleSheet.create({
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        marginBottom: 20,
        marginTop: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        position: 'relative',
    },
    tabActive: {},
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#999',
    },
    tabTextActive: {
        color: '#7C4DFF',
        fontWeight: '700',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: '20%',
        right: '20%',
        height: 3,
        backgroundColor: '#7C4DFF',
        borderRadius: 2,
    },
});

// --- ABOUT STYLES ---
const aboutStyles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    galleryImage: {
        width: 200,
        height: 140,
        borderRadius: 16,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    card: {
        backgroundColor: '#F8F9FD',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginLeft: 8,
        flex: 1,
    },
    descriptionText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 22,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    hoursRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    hoursBox: {
        alignItems: 'center',
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 14,
        paddingVertical: 12,
    },
    hoursLabel: {
        fontSize: 11,
        color: '#999',
        marginBottom: 4,
    },
    hoursTime: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1F2B',
    },
    hoursDivider: {
        paddingHorizontal: 12,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayChip: {
        width: 40,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
    },
    dayChipActive: {
        backgroundColor: '#E8E0FF',
    },
    dayChipToday: {
        backgroundColor: '#7C4DFF',
    },
    dayChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#999',
    },
    dayChipTextActive: {
        color: '#7C4DFF',
    },
    contactList: {
        gap: 8,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 14,
    },
    contactIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    contactLabel: {
        fontSize: 11,
        color: '#999',
    },
    contactValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1F2B',
        marginTop: 2,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    socialBtn: {
        alignItems: 'center',
    },
    socialIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    socialLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#666',
    },
    simpleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1F2B',
        marginBottom: 8,
    },
    simpleText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 22,
    },
});

// --- LIVE QUEUE BAR STYLES ---
const liveQueueStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F5FF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#E8DEFF',
        // Subtle shadow
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarStack: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    stackedAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2.5,
        borderColor: '#FFF',
    },
    emptyAvatar: {
        backgroundColor: '#F0ECF8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreAvatar: {
        backgroundColor: '#7C4DFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreAvatarText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFF',
    },
    queueInfo: {
        flex: 1,
    },
    queueTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1F2B',
    },
    queueSubtitle: {
        fontSize: 12,
        color: '#7C4DFF',
        fontWeight: '500',
        marginTop: 2,
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C4DFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    viewBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
});

// --- STAFF / STYLIST STYLES ---
const staffStyles = StyleSheet.create({
    stripContainer: {
        marginBottom: 16,
        paddingHorizontal: 2,
    },
    stripTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    avatarItem: {
        alignItems: 'center',
        marginRight: 16,
        width: 68,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 6,
    },
    stripAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 2,
        borderColor: '#7C4DFF',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 13,
        height: 13,
        borderRadius: 6.5,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    avatarName: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    avatarRole: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 1,
    },
    staffCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    staffAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    staffName: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    staffRole: {
        fontSize: 12,
        marginTop: 2,
    },
    statusBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

export default SalonDetailsScreen;
