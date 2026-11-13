import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getTheme } from '../../theme/theme';

const { width } = Dimensions.get('window');
const CAROUSEL_WIDTH = width - 48; // Horizontal margin 24 * 2

const BANNERS = [
    {
        id: '1',
        title: 'Premium Styling',
        subtitle: 'Get 20% off on your first grooming session',
        image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        color: '#D4AF37'
    },
    {
        id: '2',
        title: 'Exclusive Spa Days',
        subtitle: 'Relax and rejuvenate with our signature packages',
        image: 'https://images.unsplash.com/photo-1544161515-4af6b1d4640b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        color: '#1A1A1A'
    },
    {
        id: '3',
        title: 'New Bridal Glow',
        subtitle: 'Book a consultation for your special day',
        image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        color: '#8E44AD'
    }
];

const PromoCarousel = () => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => {
            const nextIndex = (activeIndex + 1) % BANNERS.length;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setActiveIndex(nextIndex);
        }, 5000);

        return () => clearInterval(interval);
    }, [activeIndex]);

    const renderItem = ({ item }) => (
        <TouchableOpacity activeOpacity={0.9} style={styles.bannerContainer}>
            <Image source={{ uri: item.image }} style={styles.bannerImage} />
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
            <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>{item.title}</Text>
                <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                <View style={[styles.button, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.buttonText, { color: theme.colors.textInverse }]}>Book Now</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={BANNERS}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                snapToInterval={CAROUSEL_WIDTH}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_WIDTH);
                    setActiveIndex(index);
                }}
            />
            <View style={styles.pagination}>
                {BANNERS.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            { backgroundColor: index === activeIndex ? theme.colors.primary : theme.colors.textLight },
                            index === activeIndex && { width: 16 }
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        marginHorizontal: 0,
        paddingHorizontal: 24,
    },
    bannerContainer: {
        width: CAROUSEL_WIDTH,
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    bannerContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bannerSubtitle: {
        color: '#FFFFFF',
        fontSize: 14,
        marginBottom: 12,
        opacity: 0.9,
    },
    button: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    buttonText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginHorizontal: 4,
    }
});

export default PromoCarousel;
