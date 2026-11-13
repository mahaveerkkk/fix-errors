import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    Alert,
    RefreshControl,
    TextInput,
    ScrollView,
    BackHandler,
    ToastAndroid
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { getTheme } from '../theme/theme';
import { getSalons, getFavorites, toggleFavorite } from '../services/api';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Card from '../components/common/Card';
import Rating from '../components/common/Rating';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import PromoCarousel from '../components/home/PromoCarousel';
import LiveQueueTicket from '../components/user/LiveQueueTicket';
import AppUpdateModal from '../components/home/AppUpdateModal';
import PostServicePopup from '../components/home/PostServicePopup';
import { getSocket } from '../utils/socket';
import { getUnreadCount } from '../utils/notificationStorage';

const CATEGORIES = [
    { id: '1', name: 'All', icon: 'grid-outline' },
    { id: '2', name: 'Hair', icon: 'cut-outline' },
    { id: '3', name: 'Spa', icon: 'water-outline' },
    { id: '4', name: 'Facial', icon: 'sparkles-outline' },
    { id: '5', name: 'Makeup', icon: 'color-palette-outline' },
];

// getCurrentLocation now uses live GPS from LocationContext
// Keeping this as backup/compatibility layer
const getCurrentLocationFallback = async () => {
    return { latitude: 28.6139, longitude: 77.2090 }; // Delhi fallback
};

const UserHomeScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { location: liveLocation, locationReady } = useLocation(); // Live GPS location
    const { user } = route.params || {};

    const [salons, setSalons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [userFavorites, setUserFavorites] = useState([]); // Array of IDs

    // Filter State
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortBy, setSortBy] = useState('recommended'); // recommended, rating, distance, price_low
    const [priceRange, setPriceRange] = useState('all'); // all, $, $$, $$$
    const [minRating, setMinRating] = useState('all'); // all, 5, 4, 3, 2
    const [maxDistance, setMaxDistance] = useState('all'); // all, 1, 5, 10, 20

    const [activeBooking, setActiveBooking] = useState(null); // For Dynamic Notification

    const [backPressedOnce, setBackPressedOnce] = useState(false);

    // Load unread notification count on focus
    useFocusEffect(
        useCallback(() => {
            const loadUnread = async () => {
                const count = await getUnreadCount();
                setUnreadNotifCount(count);
            };
            loadUnread();
        }, [])
    );
    const [breakTick, setBreakTick] = useState(0); // For break countdown re-renders
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);


    // MOCK NOTIFICATION TRIGGER (For Demo)
    const triggerMockNotification = () => {
        setActiveBooking({
            id: '123',
            salonName: 'Luxe Salon & Spa',
            serviceName: 'Haircut & Beard Trim',
            token: '12',
            status: 'next_in_line', // accepted, on_way, next_in_line
            startTime: '10:30 AM'
        });
        ToastAndroid.show("Dynamic Notification Activated!", ToastAndroid.SHORT);
    };

    // Fetch Favorites
    const fetchUserFavorites = async () => {
        if (!user || (!user._id && !user.id)) return;
        try {
            const favs = await getFavorites(user._id || user.id);
            // Store just IDs for easy lookup
            setUserFavorites(favs.map(f => f._id || f.id || f));
        } catch (error) {
        }
    };

    const handleToggleFav = async (salonId) => {
        if (!user || (!user._id && !user.id)) {
            Alert.alert('Login Required', 'Please login to add favorites');
            return;
        }

        // Optimistic Update
        const isFav = userFavorites.includes(salonId);
        let newFavs;
        if (isFav) {
            newFavs = userFavorites.filter(id => id !== salonId);
        } else {
            newFavs = [...userFavorites, salonId];
        }
        setUserFavorites(newFavs);

        try {
            await toggleFavorite(user._id || user.id, salonId);
        } catch (error) {
            // Revert
            setUserFavorites(userFavorites);
            ToastAndroid.show('Failed to update favorite', ToastAndroid.SHORT);
        }
    };

    useEffect(() => {
        fetchSalons();
        fetchUserFavorites();

        // Real-time Updates Listener
        const socket = getSocket();

        const handleQueueUpdate = (data) => {
            // Removed Toast (User Feedback)

            setSalons(prevSalons => prevSalons.map(salon => {
                // Robust ID Comparison (String vs Object)
                if (String(salon._id) === String(data.salonId)) {
                    return {
                        ...salon,
                        // Use waitTime from socket if provided, otherwise keep existing
                        waitTime: data.waitTime !== undefined ? data.waitTime : salon.waitTime,
                        liveQueueCount: data.liveQueueCount !== undefined ? data.liveQueueCount : salon.liveQueueCount,
                        status: data.newStatus !== undefined ? data.newStatus : salon.status
                    };
                }
                return salon;
            }));
        };

        // Listen for Shop Status Changes (Open/Closed)
        const handleShopStatusUpdate = (data) => {
            setSalons(prevSalons => prevSalons.map(salon => {
                if (String(salon._id) === String(data.salonId)) {
                    const updates = { ...salon };
                    if (data.status) updates.status = data.status;
                    if (data.isOnBreak !== undefined) {
                        updates.breakInfo = {
                            isOnBreak: data.isOnBreak,
                            breakEndTime: data.breakEndTime || null,
                            breakDuration: data.breakDuration || 0
                        };
                    }
                    return updates;
                }
                return salon;
            }));
        };

        if (socket) {
            // Attach listeners
            socket.on('queueUpdate', handleQueueUpdate);
            socket.on('shopStatusUpdate', handleShopStatusUpdate);

            // If not connected yet, wait for connect event
            if (!socket.connected) {
                socket.on('connect', () => {
                });
            }
        } else {
        }

        return () => {
            if (socket) {
                socket.off('queueUpdate', handleQueueUpdate);
                socket.off('shopStatusUpdate', handleShopStatusUpdate);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Break countdown tick — refreshes salon card every 30 seconds for break timer
    useEffect(() => {
        const hasBreakingSalons = salons.some(s => s.breakInfo?.isOnBreak);
        if (!hasBreakingSalons) return;

        const timer = setInterval(() => {
            setBreakTick(prev => prev + 1);
        }, 30000); // Every 30 seconds
        return () => clearInterval(timer);
    }, [salons]);


    // Back Handler - only active when this screen is focused
    useFocusEffect(
        useCallback(() => {
            const backAction = () => {
                if (backPressedOnce) {
                    BackHandler.exitApp();
                    return true;
                }

                setBackPressedOnce(true);
                ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);

                setTimeout(() => {
                    setBackPressedOnce(false);
                }, 2000);

                return true;
            };

            const backHandler = BackHandler.addEventListener(
                "hardwareBackPress",
                backAction
            );

            return () => backHandler.remove();
        }, [backPressedOnce])
    );


    const fetchSalons = async (text = '') => {
        try {
            setLoading(true);
            // Use live GPS location from context
            const position = liveLocation || await getCurrentLocationFallback();

            // Build Filters
            const filters = {};
            if (sortBy) filters.sortBy = sortBy;
            if (priceRange !== 'all') filters.priceRange = priceRange;
            if (minRating !== 'all') filters.minRating = minRating;
            if (maxDistance !== 'all') filters.maxDistance = maxDistance;
            if (selectedCategory && selectedCategory !== 'All' && selectedCategory !== 'Saved') filters.search = selectedCategory; // Category filter (skip 'Saved' — handled locally)
            const query = text || searchQuery;
            if (query) filters.search = query;
            // Only pass lat/lng when REAL GPS is available — not Delhi fallback
            const data = await getSalons(
                query || (selectedCategory !== 'All' ? selectedCategory : ''),
                locationReady
                    ? { ...filters, lat: liveLocation?.latitude, lng: liveLocation?.longitude }
                    : { ...filters } // No location = backend sorts by rating, no fake distances
            );




            if (Array.isArray(data)) {
                setSalons(data);
                if (data.length === 0) {
                }
            } else {
                // Alert.alert("Error", "Server returned invalid data.");
            }
        } catch (error) {
            // Alert.alert('Error', 'Failed to load salons: ' + error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchSalons();
        setRefreshing(false);
    };

    const applyFilters = () => {
        setFilterVisible(false);
        fetchSalons(searchQuery);
    };

    const resetFilters = () => {
        setSortBy('recommended');
        setPriceRange('all');
        setMinRating('all');
        setMaxDistance('all');
        setSelectedCategory('All');
        setFilterVisible(false);
        fetchSalons(''); // Refresh with no search or filters
    };

    const renderFilterModal = () => {
        const isActiveFilter = (type, value) => {
            switch (type) {
                case 'category': return selectedCategory === value;
                case 'rating': return minRating === value;
                case 'distance': return maxDistance === value;
                case 'price': return priceRange === value;
                case 'sort': return sortBy === value;
                default: return false;
            }
        };

        const FilterChip = ({ label, active, onPress, icon, iconColor }) => (
            <TouchableOpacity
                style={[
                    fStyles.chip,
                    { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5', borderColor: isDarkMode ? '#333' : '#E8E8E8' },
                    active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                {icon && (
                    <Ionicons
                        name={icon}
                        size={15}
                        color={active ? '#FFF' : (iconColor || theme.colors.textSecondary)}
                        style={{ marginRight: 6 }}
                    />
                )}
                <Text style={[
                    fStyles.chipText,
                    { color: theme.colors.text },
                    active && { color: '#FFF', fontWeight: '700' }
                ]}>{label}</Text>
            </TouchableOpacity>
        );

        const SectionHeader = ({ icon, title, color }) => (
            <View style={fStyles.sectionHeader}>
                <View style={[fStyles.sectionIconCircle, { backgroundColor: (color || '#7C4DFF') + (isDarkMode ? '25' : '15') }]}>
                    <Ionicons name={icon} size={16} color={color || '#7C4DFF'} />
                </View>
                <Text style={[fStyles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
            </View>
        );

        return (
            <Modal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={applyFilters}
                title="Filter & Sort"
                footer={
                    <View style={fStyles.footer}>
                        <TouchableOpacity
                            style={[fStyles.resetBtn, { borderColor: isDarkMode ? '#444' : '#DDD' }]}
                            onPress={resetFilters}
                        >
                            <Ionicons name="refresh" size={18} color={theme.colors.textSecondary} />
                            <Text style={[fStyles.resetText, { color: theme.colors.textSecondary }]}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={fStyles.applyBtn}
                            onPress={applyFilters}
                        >
                            <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                            <Text style={fStyles.applyText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                }
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Category */}
                    <SectionHeader icon="grid-outline" title="Category" color="#7C4DFF" />
                    <View style={fStyles.chipRow}>
                        {CATEGORIES.map((cat) => (
                            <FilterChip
                                key={cat.id}
                                label={cat.name}
                                icon={cat.icon}
                                active={isActiveFilter('category', cat.name)}
                                onPress={() => setSelectedCategory(cat.name)}
                            />
                        ))}
                    </View>

                    <View style={[fStyles.divider, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]} />

                    {/* Rating */}
                    <SectionHeader icon="star" title="Rating" color="#FFB300" />
                    <View style={fStyles.chipRow}>
                        {['All', '5', '4', '3', '2'].map((opt) => (
                            <FilterChip
                                key={opt}
                                label={opt === 'All' ? 'All' : `${opt} +`}
                                icon={opt === 'All' ? 'apps-outline' : 'star'}
                                iconColor="#FFB300"
                                active={isActiveFilter('rating', opt.toLowerCase())}
                                onPress={() => setMinRating(opt.toLowerCase())}
                            />
                        ))}
                    </View>

                    <View style={[fStyles.divider, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]} />

                    {/* Distance */}
                    <SectionHeader icon="location" title="Distance" color="#2196F3" />
                    <View style={fStyles.chipRow}>
                        {[
                            { label: 'All', value: 'all', icon: 'apps-outline' },
                            { label: '< 1 km', value: '1', icon: 'walk-outline' },
                            { label: '1-5 km', value: '5', icon: 'bicycle-outline' },
                            { label: '5-10 km', value: '10', icon: 'car-outline' },
                            { label: '> 10 km', value: '50', icon: 'airplane-outline' }
                        ].map((opt) => (
                            <FilterChip
                                key={opt.value}
                                label={opt.label}
                                icon={opt.icon}
                                iconColor="#2196F3"
                                active={isActiveFilter('distance', opt.value)}
                                onPress={() => setMaxDistance(opt.value)}
                            />
                        ))}
                    </View>

                    <View style={[fStyles.divider, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]} />

                    {/* Price Range */}
                    <SectionHeader icon="pricetag" title="Price Range" color="#4CAF50" />
                    <View style={fStyles.chipRow}>
                        {[
                            { label: 'All', value: 'all', icon: 'apps-outline' },
                            { label: 'Budget', value: '$', icon: 'wallet-outline' },
                            { label: 'Standard', value: '$$', icon: 'cash-outline' },
                            { label: 'Premium', value: '$$$', icon: 'diamond-outline' },
                        ].map((opt) => (
                            <FilterChip
                                key={opt.value}
                                label={opt.label}
                                icon={opt.icon}
                                iconColor="#4CAF50"
                                active={isActiveFilter('price', opt.value)}
                                onPress={() => setPriceRange(opt.value)}
                            />
                        ))}
                    </View>

                    <View style={[fStyles.divider, { backgroundColor: isDarkMode ? '#222' : '#F0F0F0' }]} />

                    {/* Sort By */}
                    <SectionHeader icon="swap-vertical" title="Sort By" color="#FF5722" />
                    <View style={fStyles.chipRow}>
                        {[
                            { label: 'Recommended', value: 'recommended', icon: 'sparkles-outline' },
                            { label: 'Rating', value: 'rating', icon: 'star-outline' },
                            { label: 'Distance', value: 'distance', icon: 'navigate-outline' },
                            { label: 'Price ↑', value: 'price: low to high', icon: 'trending-up-outline' },
                        ].map((opt) => (
                            <FilterChip
                                key={opt.value}
                                label={opt.label}
                                icon={opt.icon}
                                iconColor="#FF5722"
                                active={isActiveFilter('sort', opt.value)}
                                onPress={() => setSortBy(opt.value)}
                            />
                        ))}
                    </View>
                    <View style={{ height: 80 }} />
                </ScrollView>
            </Modal>
        );
    };

    const fStyles = StyleSheet.create({
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 14,
        },
        sectionIconCircle: {
            width: 32,
            height: 32,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.3,
        },
        chipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: 6,
            gap: 10,
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1.5,
        },
        chipText: {
            fontSize: 14,
            fontWeight: '600',
        },
        divider: {
            height: 1.5,
            marginVertical: 16,
            borderRadius: 1,
        },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        resetBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            gap: 6,
        },
        resetText: {
            fontSize: 15,
            fontWeight: '600',
        },
        applyBtn: {
            flex: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: '#7C4DFF',
            shadowColor: '#7C4DFF',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        applyText: {
            fontSize: 15,
            fontWeight: '700',
            color: '#FFF',
        },
    });

    const renderHeader = () => (
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    <Image
                        source={{ uri: user?.profilePhoto || 'https://ui-avatars.com/api/?name=' + (user?.name || 'Guest') + '&background=random' }}
                        style={[styles.profileImage, { borderColor: theme.colors.secondary }]}
                    />
                </TouchableOpacity>
                <View style={styles.greetingContainer}>
                    <Text style={[styles.greetingText, { color: theme.colors.textSecondary }]}>Hello, {user?.name?.split(' ')[0] || 'Guest'}</Text>
                    <Text style={[styles.subGreetingText, { color: theme.colors.text }]}>Find your style</Text>
                </View>
            </View>
            <View style={styles.headerRight}>
                <TouchableOpacity
                    style={[styles.scanPayHeaderBtn, { backgroundColor: theme.colors.background }]}
                    onPress={() => navigation.navigate('QRScanner', { user })}
                >
                    <Ionicons name="scan-outline" size={22} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.notificationButton, { backgroundColor: theme.colors.background }]}
                    onPress={() => navigation.navigate('NotificationCenter')}
                >
                    <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                    {unreadNotifCount > 0 && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                            <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderSearchBar = () => (
        <View style={[styles.stickyHeaderContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="search-outline" size={20} color={theme.colors.textLight} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search salons, services..."
                    placeholderTextColor={theme.colors.textLight}
                    value={searchQuery}
                    onChangeText={(text) => {
                        setSearchQuery(text);
                        fetchSalons(text);
                    }}
                />
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons name="options-outline" size={20} color={theme.colors.textInverse} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderCategories = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            {CATEGORIES.map((category) => (
                <TouchableOpacity
                    key={category.id}
                    style={[
                        styles.categoryItem,
                        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        selectedCategory === category.name && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    ]}
                    onPress={() => setSelectedCategory(category.name)}
                >
                    <Ionicons
                        name={category.icon}
                        size={20}
                        color={selectedCategory === category.name ? theme.colors.textInverse : theme.colors.text}
                    />
                    <Text style={[
                        styles.categoryText,
                        { color: theme.colors.text },
                        selectedCategory === category.name && { color: theme.colors.textInverse }
                    ]}>
                        {category.name}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderSalonItem = ({ item }) => {
        const isOnBreak = item.breakInfo?.isOnBreak && item.breakInfo?.breakEndTime && new Date(item.breakInfo.breakEndTime) > new Date();
        const isOpen = !isOnBreak && (item.status === 'open' || item.status === 'active');

        // Status badge logic
        let statusText = 'CLOSED';
        let statusColor = '#D32F2F';
        if (isOnBreak) {
            // Calculate remaining break minutes
            const breakMinsLeft = Math.ceil((new Date(item.breakInfo.breakEndTime) - new Date()) / 60000);
            statusText = `ON BREAK • ${breakMinsLeft}m`;
            statusColor = '#F97316'; // Orange
        } else if (isOpen) {
            statusText = 'OPEN';
            statusColor = '#00C853';
        }

        const ownerName = item.ownerId?.name || 'Smart Salon';
        const ownerImage = item.ownerId?.profilePhoto || `https://ui-avatars.com/api/?name=${ownerName}&background=random`;

        // Queue Logic
        const queueCount = item.liveQueueCount !== undefined ? item.liveQueueCount : 0;
        // Approx 15 mins per person default. Use override if provided, else calc
        const estimatedWait = item.waitTime !== undefined && item.waitTime !== null ? item.waitTime : (queueCount * 15);

        // Calculate Starting Price from salon services
        let minPrice = null;
        if (item.services && Array.isArray(item.services) && item.services.length > 0) {
            const prices = item.services.map(s => Number(s.price)).filter(p => !isNaN(p) && p > 0);
            if (prices.length > 0) minPrice = Math.min(...prices);
        }
        const startingPrice = minPrice ? `₹${minPrice}` : '₹199';

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('SalonDetails', { salon: item, user })}
                style={styles.cardContainer}
            >
                {/* HERO IMAGE SECTION */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: item.images?.[0] || 'https://images.unsplash.com/photo-1560066984-138fa6ca6bd6?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80' }}
                        style={styles.heroImage}
                    />

                    {/* Dark Overlay Gradient for text readability */}
                    <View style={styles.gradientOverlay} />

                    {/* TOP LEFT: VIP PARTNER BADGE */}
                    <View style={styles.vipBadge}>
                        <Ionicons name="sparkles" size={11} color="#FFD700" style={{ marginRight: 4 }} />
                        <Text style={styles.vipText}>VIP PARTNER</Text>
                    </View>

                    {/* TOP RIGHT: FAV BUTTON */}
                    <TouchableOpacity
                        style={styles.favIconBubble}
                        onPress={() => handleToggleFav(item._id || item.id)}
                    >
                        <Ionicons
                            name={userFavorites.includes(item._id || item.id) ? "heart" : "heart-outline"}
                            size={20}
                            color={userFavorites.includes(item._id || item.id) ? "#FF5252" : "#FFF"}
                        />
                    </TouchableOpacity>

                    {/* BOTTOM LEFT OVERLAY: OPEN STATUS & DISTANCE */}
                    <View style={styles.imageFooterRow}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                            <Text style={styles.statusBadgeText}>{statusText}</Text>
                        </View>
                        <View style={styles.distanceBadge}>
                            <Ionicons name="location" size={12} color="#FFF" />
                            <Text style={styles.distanceText}> {item.distance ? item.distance.toFixed(1) + ' km' : 'Nearby'}</Text>
                        </View>
                    </View>
                </View>

                {/* INFO CONTENT SECTION */}
                <View style={[styles.cardContent, { backgroundColor: theme.colors.surface }]}>

                    {/* Header: Name & Rating */}
                    <View style={styles.rowBetween}>
                        <Text style={[styles.salonTitle, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View style={styles.ratingPill}>
                            <Ionicons name="star" size={14} color="#FFD700" />
                            <Text style={[styles.ratingNumber, { color: theme.colors.text }]}>
                                {item.rating || item.averageRating || '0'}
                            </Text>
                        </View>
                    </View>

                    {/* Sub-header: Owner & Area */}
                    <View style={styles.ownerRow}>
                        <Image source={{ uri: ownerImage }} style={styles.tinyOwnerAvatar} />
                        <Text style={[styles.ownerText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            Owned by <Text style={{ fontWeight: '700', color: theme.colors.text }}>{ownerName}</Text>
                            {item.address ? ` • ${item.address.split(',')[0]}` : ''}
                        </Text>
                    </View>

                    {/* CRITICAL: LIVE QUEUE & STARTING PRICE BAR */}
                    <View
                        style={[styles.queueInfoBar, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F7FA' }]}
                    >
                        <View style={styles.queueItem}>
                            <Ionicons name="people" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                            <Text style={[styles.queueLabel, { color: theme.colors.textSecondary }]}>QUEUE:</Text>
                            <Text style={[styles.queueValue, { color: theme.colors.text }]}>{queueCount}</Text>
                        </View>

                        <View style={[styles.dividerVertical, { backgroundColor: theme.colors.border }]} />

                        <View style={styles.queueItem}>
                            <Ionicons name="time-outline" size={13} color={isOpen ? "#00C853" : theme.colors.error} style={{ marginRight: 4 }} />
                            <Text style={[styles.queueLabel, { color: theme.colors.textSecondary }]}>WAIT:</Text>
                            <Text style={[styles.queueValue, { color: theme.colors.text }]}>{estimatedWait === 0 ? '0m' : `${estimatedWait}m`}</Text>
                        </View>

                        <View style={[styles.dividerVertical, { backgroundColor: theme.colors.border }]} />

                        <View style={styles.queueItem}>
                            <Ionicons name="pricetag-outline" size={12} color="#10B981" style={{ marginRight: 4 }} />
                            <Text style={[styles.queueLabel, { color: theme.colors.textSecondary }]}>FROM:</Text>
                            <Text style={[styles.queueValue, { color: '#10B981', fontWeight: '800' }]}>{startingPrice}</Text>
                        </View>
                    </View>

                </View>

                {/* VISUAL DIVIDER/SHADOW FIX */}
                <View style={{ height: 4 }} />
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => {
        if (item.type === 'search') return renderSearchBar();
        if (item.type === 'categories') return renderCategories();
        if (item.type === 'promo') {
            return (
                <View>
                    <PromoCarousel />
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Nearby Salons</Text>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selectedCategory === 'Saved' ? theme.colors.secondary : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                            onPress={() => setSelectedCategory(selectedCategory === 'Saved' ? 'All' : 'Saved')}
                        >
                            <Ionicons name={selectedCategory === 'Saved' ? 'bookmark' : 'bookmark-outline'} size={14} color={selectedCategory === 'Saved' ? '#FFF' : theme.colors.secondary} style={{ marginRight: 4 }} />
                            <Text style={[styles.seeAllText, { color: selectedCategory === 'Saved' ? '#FFF' : theme.colors.secondary }]}>Saved</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        if (item.type === 'no-results') {
            return (
                <View style={{ alignItems: 'center', marginTop: 50, padding: 20 }}>
                    <Ionicons name="storefront-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={{ marginTop: 16, fontSize: 18, color: theme.colors.text, fontWeight: 'bold' }}>
                        No Salons Found
                    </Text>
                    <Text style={{ marginTop: 8, textAlign: 'center', color: theme.colors.textSecondary }}>
                        We couldn't find any salons in your area.
                    </Text>
                    <Button
                        title="Try Again"
                        onPress={() => fetchSalons()}
                        style={{ marginTop: 20, paddingHorizontal: 30 }}
                    />
                </View>
            );
        }
        return renderSalonItem({ item });
    };

    // Filter for Saved category locally
    const displaySalons = selectedCategory === 'Saved'
        ? salons.filter(s => userFavorites.includes(s._id))
        : salons;

    const listData = [
        { id: 'search-bar', type: 'search' },
        { id: 'categories', type: 'categories' },
        { id: 'promo-banners', type: 'promo' },
        ...displaySalons
    ];

    if (!loading && displaySalons.length === 0) {
        listData.push({ id: 'no-results', type: 'no-results' });
    }

    return (
        <ScreenWrapper backgroundColor={theme.colors.surface}>
            <AppUpdateModal />
            <LiveQueueTicket
                booking={activeBooking}
                onClose={() => setActiveBooking(null)}
            />
            {renderHeader()}
            <FlatList
                data={listData}
                extraData={[salons, breakTick]} // CRITICAL: Ensures re-render on socket update & break tick
                renderItem={renderItem}
                keyExtractor={(item) => item.id || item._id}
                stickyHeaderIndices={[0]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.colors.primary]}
                    />
                }
            />
            {renderFilterModal()}
            <PostServicePopup user={user} navigation={navigation} isDarkMode={isDarkMode} />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        borderWidth: 2,
    },
    greetingContainer: {
        justifyContent: 'center',
    },
    greetingText: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    subGreetingText: {
        fontSize: 20,
        fontWeight: '800', // Bolder
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    scanPayHeaderBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    notificationButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    stickyHeaderContainer: {
        paddingHorizontal: 24,
        paddingBottom: 16,
        paddingTop: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 35,
        paddingHorizontal: 16,
        paddingVertical: 14,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        borderWidth: 1,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        padding: 0,
        height: 24,
        fontWeight: '500',
    },
    filterButton: {
        width: 40,
        height: 40,
        padding: 10,
        borderRadius: 20,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 16,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    filterChip: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 10,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    categoriesContainer: {
        paddingLeft: 24,
        marginBottom: 24,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 25,
        marginRight: 12,
        borderWidth: 1,
        // elevation: 1, // subtle lift
    },
    categoryText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 24,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    // ... keep existing headers ...
    // ... headers ...
    // --- COMPACT PREMIUM CARD STYLES ---
    cardContainer: {
        borderRadius: 16, // Slightly smaller radius
        marginHorizontal: 16, // Reduce side merging
        marginBottom: 16, // Reduce bottom spacing
        backgroundColor: 'transparent',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 }, // Smaller shadow
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    imageContainer: {
        height: 150, // Reduced from 200
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    vipBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    vipText: {
        color: '#FFD700',
        fontSize: 9, // Smaller text
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    favIconBubble: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32, // Smaller bubble
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageFooterRow: {
        position: 'absolute',
        bottom: 10,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 8,
    },
    statusBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    distanceText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
    cardContent: {
        padding: 12, // Reduced padding from 16
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    salonTitle: {
        fontSize: 20, // Reduced from 18
        fontWeight: 'bold',
        flex: 1,
        marginRight: 10,
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingNumber: {
        fontSize: 14,
        fontWeight: '800',
        marginLeft: 4,
    },
    ownerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tinyOwnerAvatar: {
        width: 28,
        height: 28,
        borderRadius: 9,
        marginRight: 6,
    },
    ownerText: {
        fontSize: 12,
    },
    // QUEUE BAR
    queueInfoBar: {
        flexDirection: 'row',
        paddingVertical: 8, // Thinner bar
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    queueItem: {
        flex: 1,
        alignItems: 'center',
        flexDirection: 'row', // Horizontal layout for compactness
        justifyContent: 'center'
    },
    queueLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginRight: 6, // Label beside value
        marginBottom: 0,
    },
    queueValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    dividerVertical: {
        width: 1,
        height: 20, // Shorter divider
        marginHorizontal: 10,
    },
    listContent: {
        paddingBottom: 40,
    }
});

export default UserHomeScreen;