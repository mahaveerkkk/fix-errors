import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Switch
} from 'react-native';
import { colors } from '../../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import { API_URL } from '../../services/api';

const ManageSalonsScreen = ({ navigation }) => {
    const [salons, setSalons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSalons();
    }, []);

    const fetchSalons = async () => {
        try {
            const response = await axios.get(`${API_URL}/salons/admin/all`);
            setSalons(response.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch salons');
        } finally {
            setLoading(false);
        }
    };

    const toggleBlock = async (salonId, currentStatus) => {
        try {
            await axios.post(`${API_URL}/salons/admin/block/${salonId}`, {
                blocked: !currentStatus
            });
            // Optimistic update
            setSalons(prev => prev.map(s =>
                s._id === salonId ? { ...s, isBlocked: !currentStatus } : s
            ));
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.salonName}>{item.name}</Text>
                    <Text style={styles.ownerName}>Owner: {item.ownerId?.name || 'Unknown'}</Text>
                </View>
                <Switch
                    trackColor={{ false: '#767577', true: colors.error }}
                    thumbColor={item.isBlocked ? colors.white : '#f4f3f4'}
                    onValueChange={() => toggleBlock(item._id, item.isBlocked)}
                    value={item.isBlocked}
                />
            </View>
            <Text style={styles.address}>{item.address}</Text>
            <View style={styles.statusRow}>
                <Text style={[styles.statusText, item.isBlocked ? styles.blocked : styles.active]}>
                    {item.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                </Text>
                <Text style={styles.dateText}>Joined: {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Salons</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={salons}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No salons found.</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 40,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.white,
    },
    listContent: {
        padding: 20,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    salonName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    ownerName: {
        fontSize: 14,
        color: colors.textLight,
    },
    address: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F5F5F5',
        paddingTop: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: 'hidden',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    active: {
        backgroundColor: '#E8F5E9',
        color: '#2E7D32',
    },
    blocked: {
        backgroundColor: '#FFEBEE',
        color: '#C62828',
    },
    dateText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 60,
        color: '#999',
        fontSize: 16,
    },
});

export default ManageSalonsScreen;
