import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Rating from '../components/common/Rating';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

const StaffSelectionScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon, selectedServices, user } = route.params || {};
    const [selectedStaff, setSelectedStaff] = useState(null); // null = Any

    const allStaff = salon?.staff || [];
    const availableStaff = allStaff.filter(s => s.isAvailable !== false);
    const unavailableStaff = allStaff.filter(s => s.isAvailable === false);

    const handleContinue = () => {
        navigation.navigate('Booking', {
            salon,
            selectedServices,
            selectedStaff: selectedStaff || { id: 'any', name: 'Any Professional' },
            user
        });
    };

    const renderStaffItem = ({ item }) => {
        const staffId = item._id || item.id;
        const selectedId = selectedStaff?._id || selectedStaff?.id;
        const isSelected = selectedId === staffId;
        const isAvailable = item.isAvailable !== false;
        return (
            <TouchableOpacity
                onPress={() => isAvailable && setSelectedStaff(item)}
                disabled={!isAvailable}
                style={[
                    styles.staffCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, transform: [{ scale: 1.02 }] },
                    !isAvailable && { opacity: 0.5 }
                ]}
                activeOpacity={0.9}
            >
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: item.photo || item.image || `https://ui-avatars.com/api/?name=${item.name}&background=random&size=200` }}
                        style={[styles.staffImage, !isAvailable && { opacity: 0.5 }]}
                    />
                    {!isAvailable && (
                        <View style={[styles.absentBadge]}>
                            <Ionicons name="close-circle" size={10} color="#FFF" />
                            <Text style={styles.absentBadgeText}>Absent</Text>
                        </View>
                    )}
                    {item.recommended && isAvailable && (
                        <View style={[styles.aiBadge, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.background }]}>
                            <Ionicons name="sparkles" size={10} color={theme.colors.textInverse} />
                            <Text style={[styles.aiBadgeText, { color: theme.colors.textInverse }]}>AI Pick</Text>
                        </View>
                    )}
                    {isAvailable && (
                        <View style={[styles.ratingPill, { backgroundColor: theme.colors.surfaceHighlight }]}>
                            <Ionicons name="star" size={10} color="#FFB800" />
                            <Text style={[styles.ratingText, { color: theme.colors.text }]}>{item.rating}</Text>
                            <Text style={[styles.reviewText, { color: theme.colors.textLight }]}>({item.reviews || 45})</Text>
                        </View>
                    )}
                </View>

                <View style={styles.staffDetails}>
                    <Text style={[styles.staffName, { color: theme.colors.text }, isSelected && { color: theme.colors.textInverse }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {isAvailable ? (
                        <Text style={[styles.staffRole, { color: theme.colors.textSecondary }, isSelected && { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                            {item.role}
                        </Text>
                    ) : (
                        <Text style={{ fontSize: 11, color: '#FF5252', fontWeight: '600' }}>Not Available Today</Text>
                    )}
                </View>

                {isSelected && (
                    <View style={[styles.checkIndicator, { backgroundColor: theme.colors.success }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderAnyStaffOption = () => {
        const isSelected = selectedStaff === null;
        return (
            <TouchableOpacity
                onPress={() => setSelectedStaff(null)}
                style={[
                    styles.anyCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                ]}
                activeOpacity={0.9}
            >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceHighlight }, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="people" size={24} color={isSelected ? theme.colors.textInverse : theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.anyTitle, { color: theme.colors.text }, isSelected && { color: theme.colors.textInverse }]}>Any Professional</Text>
                    <Text style={[styles.anySubtitle, { color: theme.colors.textSecondary }, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>Maximum availability • Fastest service</Text>
                </View>
                {isSelected && (
                    <View style={styles.anyCheck}>
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.textInverse} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper>
            <Header title="Select Specialist" showBack />
            <View style={styles.container}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.headerSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Option</Text>
                        {renderAnyStaffOption()}
                        <Text style={[styles.sectionTitle, { marginTop: 32, color: theme.colors.text }]}>Specialist Masters</Text>
                    </View>

                    <FlatList
                        data={availableStaff}
                        renderItem={renderStaffItem}
                        keyExtractor={(item, index) => `${item._id || item.id || 'staff'}-${index}`}
                        numColumns={2}
                        scrollEnabled={false}
                        columnWrapperStyle={styles.columnWrapper}
                        contentContainerStyle={styles.listContent}
                    />

                    {unavailableStaff.length > 0 && (
                        <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textLight, fontSize: 13 }]}>Not Available Today</Text>
                            <FlatList
                                data={unavailableStaff}
                                renderItem={renderStaffItem}
                                keyExtractor={(item, index) => `absent-${item._id || item.id || 'staff'}-${index}`}
                                numColumns={2}
                                scrollEnabled={false}
                                columnWrapperStyle={styles.columnWrapper}
                            />
                        </View>
                    )}
                </ScrollView>
            </View>

            <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.divider }]}>
                <Button
                    title="Continue to Booking"
                    onPress={handleContinue}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerSection: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    anyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    anyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    anySubtitle: {
        fontSize: 13,
        marginTop: 4,
        opacity: 0.8,
    },
    anyCheck: {
        marginLeft: 8,
    },
    staffCard: {
        width: CARD_WIDTH,
        borderRadius: 16,
        padding: 10,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
        coverImage: true,
        gap: 10,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,

    },
    staffImage: {
        width: CARD_WIDTH - 20,
        height: (CARD_WIDTH - 20) * 0.85,
        borderRadius: 14,
        backgroundColor: '#F0F0F0',
    },
    ratingPill: {
        position: 'absolute',
        bottom: -10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    ratingText: {
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    reviewText: {
        fontSize: 10,
        marginLeft: 2,
    },
    aiBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        zIndex: 1,
    },
    aiBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    staffDetails: {
        alignItems: 'center',
        marginTop: 4,
        width: '100%',
    },
    staffName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    staffRole: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 8,
    },
    checkIndicator: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
        zIndex: 2,
    },
    absentBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF5252',
        zIndex: 1,
    },
    absentBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginLeft: 3,
        color: '#FFF',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 32,
        borderTopWidth: 1,
        elevation: 20,
    },
});

export default StaffSelectionScreen;
