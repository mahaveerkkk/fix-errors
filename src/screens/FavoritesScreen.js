import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Rating from '../components/common/Rating';
import Badge from '../components/common/Badge';

const FavoritesScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { user } = route.params || {};

    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchFavorites();
        }
    }, [user]);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const { getFavorites } = require('../services/api');
            const data = await getFavorites(user._id || user.id);
            setFavorites(data || []);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const removeFavorite = async (salonId) => {
        try {
            const { toggleFavorite } = require('../services/api');
            await toggleFavorite(user._id || user.id, salonId);
            fetchFavorites(); // Refresh list
        } catch (error) {
        }
    };

    const renderItem = ({ item }) => (
        <Card
            style={styles.card}
            variant="elevated"
            onPress={() => navigation.navigate('SalonDetails', { salon: item, user })}
        >
            <Image
                source={{ uri: (item.images && item.images.length > 0) ? item.images[0] : 'https://via.placeholder.com/150' }}
                style={styles.image}
            />
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <TouchableOpacity onPress={() => removeFavorite(item._id)}>
                        <Ionicons name="heart" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.address, { color: theme.colors.textSecondary }]}>{item.address}</Text>

                <View style={styles.statsRow}>
                    <Rating rating={item.rating || 0} count={item.ratingCount || 0} size={12} />
                    <Text style={[styles.dot, { color: theme.colors.textLight }]}>•</Text>
                    <Text style={[styles.distance, { color: theme.colors.textLight }]}>{item.distance ? `${item.distance.toFixed(1)} km` : 'Nearby'}</Text>
                </View>

                <View style={styles.footerRow}>
                    <Badge
                        label={item.status === 'open' ? 'OPEN' : 'CLOSED'}
                        color={item.status === 'open' ? theme.colors.success : theme.colors.error}
                        size="sm"
                    />
                    <TouchableOpacity
                        style={[styles.bookButton, { backgroundColor: theme.colors.surfaceHighlight }]}
                        onPress={() => navigation.navigate('SalonDetails', { salon: item, user })}
                    >
                        <Text style={[styles.bookButtonText, { color: theme.colors.primary }]}>Book Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );

    return (
        <ScreenWrapper>
            <Header title="Favorites" showBack />
            <FlatList
                data={favorites}
                renderItem={renderItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="heart-dislike-outline" size={64} color={theme.colors.textLight} />
                        <Text style={[styles.emptyText, { color: theme.colors.text }]}>No favorites yet</Text>
                        <Text style={[styles.emptySubText, { color: theme.colors.textLight }]}>Save salons you like to find them easily later.</Text>
                    </View>
                }
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    listContent: {
        padding: 24,
    },
    card: {
        flexDirection: 'row',
        padding: 0,
        marginBottom: 16,
        overflow: 'hidden',
    },
    image: {
        width: 100,
        height: '100%',
    },
    content: {
        flex: 1,
        padding: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    address: {
        fontSize: 12,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    dot: {
        marginHorizontal: 6,
        fontSize: 12,
    },
    distance: {
        fontSize: 12,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bookButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    bookButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default FavoritesScreen;
