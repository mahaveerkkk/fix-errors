import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, RefreshControl } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import { getReviews, likeReview } from '../services/api';
import { auth } from '../config/firebase';

const FILTER_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: '5', value: 5 },
    { label: '4', value: 4 },
    { label: '3', value: 3 },
    { label: '2', value: 2 },
];

const AllReviewsScreen = ({ navigation, route }) => {
    const { salon } = route.params || {};
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);

    const [reviews, setReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // Current logged-in user
    const [likedReviews, setLikedReviews] = useState(new Set()); // Track liked reviews locally

    // Calculate stats
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
        : '0.0';

    useEffect(() => {
        fetchReviews();
        // Get current user from route params OR Firebase auth
        const user = route.params?.user;
        if (user) {
            setCurrentUser(user);
        } else {
            // Fallback: get user from Firebase auth
            const firebaseUser = auth().currentUser;
            if (firebaseUser) {
                setCurrentUser({ _id: firebaseUser.uid, uid: firebaseUser.uid, name: firebaseUser.displayName });
            }
        }
    }, []);

    useEffect(() => {
        applyFilter();
    }, [selectedFilter, reviews]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const salonId = salon?._id || salon?.id;
            if (salonId) {
                const data = await getReviews(salonId);
                // API returns { reviews: [...], stats: {...} } structure
                const reviewsList = data?.reviews || data || [];
                setReviews(Array.isArray(reviewsList) ? reviewsList : []);
            }
        } catch (error) {
            setReviews([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReviews();
        setRefreshing(false);
    };

    const applyFilter = () => {
        if (selectedFilter === 'all') {
            setFilteredReviews(reviews);
        } else {
            setFilteredReviews(reviews.filter(r => r.rating === selectedFilter));
        }
    };

    const handleLike = async (reviewId) => {
        if (!currentUser?._id) return;
        try {
            const result = await likeReview(reviewId, currentUser._id);
            // Update likes count in local state
            setReviews(prev => prev.map(r =>
                r._id === reviewId ? { ...r, likes: result.likes } : r
            ));
            // Track liked state locally (since Firebase UID != MongoDB ObjectId)
            setLikedReviews(prev => {
                const next = new Set(prev);
                if (result.liked) {
                    next.add(reviewId);
                } else {
                    next.delete(reviewId);
                }
                return next;
            });
        } catch (error) {
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return '';
        const now = new Date();
        const reviewDate = new Date(date);
        const diffMs = now - reviewDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 1) return 'Today';
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 30) return `${diffDays} days ago`;
        if (diffDays < 60) return '1 month ago';
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const renderFilterTab = (option) => {
        const isSelected = selectedFilter === option.value;
        return (
            <TouchableOpacity
                key={option.value}
                style={[
                    styles.filterTab,
                    isSelected && styles.filterTabActive,
                    { backgroundColor: isSelected ? '#F59E0B' : theme.colors.surfaceHighlight }
                ]}
                onPress={() => setSelectedFilter(option.value)}
            >
                {option.value !== 'all' && (
                    <Ionicons name="star" size={12} color={isSelected ? '#FFF' : '#F59E0B'} style={{ marginRight: 4 }} />
                )}
                <Text style={[
                    styles.filterTabText,
                    { color: isSelected ? '#FFF' : theme.colors.text }
                ]}>
                    {option.label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderReviewCard = ({ item }) => {
        const isLiked = likedReviews.has(item._id);
        const likesCount = (item.likes || []).length;
        return (
            <View style={[styles.reviewCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {/* Header Row */}
                <View style={styles.reviewHeader}>
                    <Image
                        source={{ uri: item.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${item.userId?.name || 'User'}` }}
                        style={styles.avatar}
                    />
                    <View style={styles.reviewInfo}>
                        <Text style={[styles.reviewerName, { color: theme.colors.text }]}>
                            {item.userId?.name || 'Anonymous'}
                        </Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.ratingBadgeText}>{item.rating}</Text>
                    </View>
                    <TouchableOpacity style={styles.moreButton}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textLight} />
                    </TouchableOpacity>
                </View>

                {/* Review Text */}
                <Text style={[styles.reviewText, { color: theme.colors.textSecondary }]}>
                    {item.comment || 'Great service!'}
                </Text>

                {/* Footer Row */}
                <View style={styles.reviewFooter}>
                    <TouchableOpacity
                        style={styles.likeButton}
                        onPress={() => handleLike(item._id)}
                    >
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={18}
                            color={isLiked ? "#EF4444" : theme.colors.textLight}
                        />
                        <Text style={[styles.likeCount, { color: theme.colors.textLight }]}>
                            {likesCount}
                        </Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeAgo, { color: theme.colors.textLight }]}>
                        {getTimeAgo(item.createdAt)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <ScreenWrapper>
            <Header title="Reviews" showBack />

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={styles.content}
            >
                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContainer}
                >
                    {FILTER_OPTIONS.map(renderFilterTab)}
                </ScrollView>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <Ionicons name="star" size={20} color="#F59E0B" />
                    <Text style={[styles.avgRating, { color: theme.colors.text }]}>{avgRating}</Text>
                    <Text style={[styles.totalReviews, { color: theme.colors.textSecondary }]}>
                        ({totalReviews.toLocaleString()} reviews)
                    </Text>
                </View>

                {/* Reviews List */}
                {filteredReviews.length === 0 && !loading ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="star-outline" size={48} color={theme.colors.textLight} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            No reviews yet
                        </Text>
                    </View>
                ) : (
                    filteredReviews.map((item, index) => (
                        <View key={item._id || index}>
                            {renderReviewCard({ item })}
                        </View>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    filterContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    filterTabActive: {
        elevation: 2,
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avgRating: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    totalReviews: {
        fontSize: 14,
        marginLeft: 8,
    },
    reviewCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    reviewInfo: {
        flex: 1,
        marginLeft: 12,
    },
    reviewerName: {
        fontSize: 16,
        fontWeight: '600',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    ratingBadgeText: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    moreButton: {
        padding: 4,
    },
    reviewText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    reviewFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    likeButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    likeCount: {
        fontSize: 13,
        marginLeft: 6,
    },
    timeAgo: {
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
    },
});

export default AllReviewsScreen;
