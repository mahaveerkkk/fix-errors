import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const ServiceSelectionScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const { salon, user } = route.params;
    const [selectedServices, setSelectedServices] = useState([]);

    const services = salon.services || [
        { id: '1', name: 'Haircut', price: 250, duration: 30 },
        { id: '2', name: 'Shave', price: 150, duration: 20 },
        { id: '3', name: 'Facial', price: 500, duration: 45 },
        { id: '4', name: 'Hair Color', price: 1200, duration: 90 },
        { id: '5', name: 'Manicure', price: 400, duration: 40 },
        { id: '6', name: 'Pedicure', price: 450, duration: 45 },
    ];

    const toggleService = (service) => {
        const serviceId = service.id || service._id;
        if (selectedServices.find(s => (s.id || s._id) === serviceId)) {
            setSelectedServices(selectedServices.filter(s => (s.id || s._id) !== serviceId));
        } else {
            setSelectedServices([...selectedServices, service]);
        }
    };

    const totalAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

    const renderServiceItem = ({ item }) => {
        const serviceId = item.id || item._id;
        const isSelected = selectedServices.find(s => (s.id || s._id) === serviceId);
        const hasPhoto = item.photos && item.photos.length > 0;
        return (
            <Card
                onPress={() => toggleService(item)}
                style={[styles.serviceCard, isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                variant="outlined"
            >
                {/* Service Photo/Icon */}
                {hasPhoto ? (
                    <Image source={{ uri: item.photos[0] }} style={styles.serviceImage} />
                ) : (
                    <View style={[styles.serviceIconBox, { backgroundColor: theme.colors.surfaceHighlight }]}>
                        <Ionicons name="cut-outline" size={20} color={theme.colors.primary} />
                    </View>
                )}
                <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, { color: theme.colors.text }, isSelected && { color: theme.colors.textInverse }]}>{item.name}</Text>
                    <Text style={[styles.serviceDuration, { color: theme.colors.textLight }, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{item.duration} mins</Text>
                </View>
                <View style={styles.serviceRight}>
                    <Text style={[styles.servicePrice, { color: theme.colors.text }, isSelected && { color: theme.colors.textInverse }]}>₹{item.price}</Text>
                    <View style={[styles.checkbox, { borderColor: theme.colors.border }, isSelected && { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary }]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color={theme.colors.textInverse} />}
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <ScreenWrapper>
            <Header title="Select Services" showBack />
            <FlatList
                data={services}
                renderItem={renderServiceItem}
                keyExtractor={item => item.id || item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.divider }]}>
                <View style={styles.summaryContainer}>
                    <View>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textLight }]}>Total Amount</Text>
                        <Text style={[styles.summaryValue, { color: theme.colors.text }]}>₹{totalAmount}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textLight }]}>Duration</Text>
                        <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{totalDuration} mins</Text>
                    </View>
                </View>
                <Button
                    title="Continue to Staff"
                    onPress={() => navigation.navigate('StaffSelection', { salon, selectedServices, user })}
                    disabled={selectedServices.length === 0}
                />
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    listContent: {
        padding: 24,
        paddingBottom: 150,
    },
    serviceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
    },
    serviceImage: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginRight: 12,
        backgroundColor: '#EEE',
    },
    serviceIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    serviceDuration: {
        fontSize: 12,
    },
    serviceRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        borderTopWidth: 1,
        elevation: 10,
    },
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 12,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
    }
});

export default ServiceSelectionScreen;
