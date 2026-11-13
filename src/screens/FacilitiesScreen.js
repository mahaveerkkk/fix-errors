import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { updateSalon, getSalonById } from '../services/api';

// Available facilities with icons
const AVAILABLE_FACILITIES = [
    { id: 'wifi', name: 'WiFi', icon: 'wifi' },
    { id: 'parking', name: 'Parking', icon: 'car' },
    { id: 'ac', name: 'AC', icon: 'snow' },
    { id: 'coffee', name: 'Coffee', icon: 'cafe' },
    { id: 'tv', name: 'TV', icon: 'tv' },
    { id: 'magazines', name: 'Magazines', icon: 'newspaper' },
    { id: 'music', name: 'Music', icon: 'musical-notes' },
    { id: 'wheelchair', name: 'Wheelchair Access', icon: 'accessibility' },
    { id: 'cards', name: 'Card Payment', icon: 'card' },
    { id: 'upi', name: 'UPI Payment', icon: 'phone-portrait' },
    { id: 'sanitized', name: 'Sanitized Tools', icon: 'shield-checkmark' },
    { id: 'kids', name: 'Kids Friendly', icon: 'happy' },
];

const FacilitiesScreen = ({ navigation, route }) => {
    const { salon } = route.params || {};
    const [selectedFacilities, setSelectedFacilities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        // Fetch fresh salon data to get latest facilities
        const fetchFreshSalonData = async () => {
            try {
                const salonId = salon?._id || salon?.id;
                if (salonId) {
                    const freshSalon = await getSalonById(salonId);
                    if (freshSalon?.facilities && freshSalon.facilities.length > 0) {
                        const existingIds = freshSalon.facilities.map(f => {
                            const matched = AVAILABLE_FACILITIES.find(
                                af => af.name === f.name || af.icon === f.icon
                            );
                            return matched?.id || null;
                        }).filter(Boolean);
                        setSelectedFacilities(existingIds);
                    }
                }
            } catch (error) {
            } finally {
                setInitialLoading(false);
            }
        };

        fetchFreshSalonData();
    }, [salon]);

    const toggleFacility = (facilityId) => {
        setSelectedFacilities(prev => {
            if (prev.includes(facilityId)) {
                return prev.filter(id => id !== facilityId);
            } else {
                return [...prev, facilityId];
            }
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const facilitiesToSave = selectedFacilities.map(id => {
                const facility = AVAILABLE_FACILITIES.find(f => f.id === id);
                return { name: facility.name, icon: facility.icon };
            });

            await updateSalon(salon._id, { facilities: facilitiesToSave });
            Alert.alert('Success', 'Facilities updated successfully! 🎉');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update facilities: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8F9FD" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A1F2B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Facilities</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>Select the facilities available at your salon</Text>

                {/* Facilities Grid */}
                <View style={styles.grid}>
                    {AVAILABLE_FACILITIES.map((facility) => {
                        const isSelected = selectedFacilities.includes(facility.id);
                        return (
                            <TouchableOpacity
                                key={facility.id}
                                style={[
                                    styles.facilityCard,
                                    isSelected && styles.facilityCardSelected
                                ]}
                                onPress={() => toggleFacility(facility.id)}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.iconCircle,
                                    isSelected && styles.iconCircleSelected
                                ]}>
                                    <Ionicons
                                        name={facility.icon}
                                        size={24}
                                        color={isSelected ? '#FFF' : '#7C4DFF'}
                                    />
                                </View>
                                <Text style={[
                                    styles.facilityName,
                                    isSelected && styles.facilityNameSelected
                                ]}>
                                    {facility.name}
                                </Text>
                                {isSelected && (
                                    <View style={styles.checkBadge}>
                                        <Ionicons name="checkmark" size={12} color="#FFF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Selected Count */}
                <Text style={styles.selectedCount}>
                    {selectedFacilities.length} facilities selected
                </Text>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                            <Text style={styles.saveBtnText}>Save Facilities</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F8F9FD'
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 20,
        elevation: 2
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A1F2B'
    },
    content: {
        padding: 20,
        paddingBottom: 100
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20,
        textAlign: 'center'
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    facilityCard: {
        width: '31%',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4
    },
    facilityCardSelected: {
        borderColor: '#7C4DFF',
        backgroundColor: '#F3E5F5'
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F3E5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    iconCircleSelected: {
        backgroundColor: '#7C4DFF'
    },
    facilityName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center'
    },
    facilityNameSelected: {
        color: '#7C4DFF'
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#4CAF50',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center'
    },
    selectedCount: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
        color: '#7C4DFF',
        fontWeight: '600'
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#EEE'
    },
    saveBtn: {
        flexDirection: 'row',
        backgroundColor: '#7C4DFF',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C4DFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8
    }
});

export default FacilitiesScreen;
