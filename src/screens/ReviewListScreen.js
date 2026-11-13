import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import { getReviews } from '../services/api';

const ReviewListScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon } = route.params || {};
    const salonId = salon?._id || salon?.id;

    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0, distribution: {} });
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        fetchReviews();
    }, [activeFilter]);

    const fetchReviews = async () => {
        if (!salonId) return;
        setLoading(true);
        try {
            const data = await getReviews(salonId, activeFilter);
            setReviews(data.reviews || []);
            setStats(data.stats || { averageRating: 0, totalReviews: 0, distribution: {} });
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 30) return `${diffDays} days ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    };

    const FilterChip = ({ label, value }) => (
        <TouchableOpacity
            style={[
                styles.filterChip,
                { backgroundColor: activeFilter === value ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border }
            ]}
            onPress={() => setActiveFilter(value)}
        >
            {value !== 'all' && <Ionicons name="star" size={12} color={activeFilter === value ? '#fff' : '#FFD700'} />}
            <Text style={[styles.filterChipText, { color: activeFilter === value ? '#fff' : theme.colors.text }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderReviewItem = ({ item }) => (
        <Card style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <Image
                    source={{ uri: item.userId?.profilePhoto || `https://ui-avatars.com/api/?name=${item.userId?.name}&background=random` }}
                    style={styles.userAvatar}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.userName, { color: theme.colors.text }]}>{item.userId?.name || 'Anonymous'}</Text>
                    <View style={styles.ratingRow}>
                        <View style={styles.starBadge}>
                            <Ionicons name="star" size={12} color="#FFD700" />
                            <Text style={styles.starBadgeText}>{item.rating}</Text>
                        </View>
                        <Text style={[styles.dateText, { color: theme.colors.textLight }]}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.moreBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textLight} />
                </TouchableOpacity>
            </View>
            {item.comment && (
                <Text style={[styles.commentText, { color: theme.colors.textSecondary }]}>{item.comment}</Text>
            )}
            <View style={styles.likeRow}>
                <View style={styles.likeBtn}>
                    <Ionicons name={(item.likes || []).length > 0 ? "heart" : "heart-outline"} size={18} color={(item.likes || []).length > 0 ? "#EF4444" : theme.colors.textLight} />
                    <Text style={[styles.likeCount, { color: theme.colors.textLight }]}>{(item.likes || []).length}</Text>
                </View>
            </View>
        </Card>
    );

    return (
        <ScreenWrapper>
            <Header title="Reviews" showBack />

            {/* Stats Header */}
            <View style={[styles.statsHeader, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.avgRatingBox}>
                    <Ionicons name="star" size={24} color="#FFD700" />
                    <Text style={[styles.avgRatingText, { color: theme.colors.text }]}>
                        {stats.averageRating.toFixed(1)} ({stats.totalReviews.toLocaleString()} reviews)
                    </Text>
                </View>
            </View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
                <FilterChip label="All" value="all" />
                <FilterChip label="5" value="5" />
                <FilterChip label="4" value="4" />
                <FilterChip label="3" value="3" />
                <FilterChip label="2" value="2" />
                <FilterChip label="1" value="1" />
            </ScrollView>

            {/* Reviews List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : reviews.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={60} color={theme.colors.textLight} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No reviews yet</Text>
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    renderItem={renderReviewItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    statsHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    avgRatingBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avgRatingText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    reviewCard: {
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    userName: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    starBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: 8,
    },
    starBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#F9A825',
        marginLeft: 3,
    },
    dateText: {
        fontSize: 11,
    },
    moreBtn: {
        padding: 4,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10,
    },
    likeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 10,
    },
    likeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    likeCount: {
        fontSize: 12,
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
    },
});

export default ReviewListScreen;
