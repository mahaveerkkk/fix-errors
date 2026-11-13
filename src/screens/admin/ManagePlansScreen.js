import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView
} from 'react-native';
import { colors } from '../../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getPlans, createPlan, deletePlan } from '../../services/api';

const ManagePlansScreen = ({ navigation }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await getPlans();
            setPlans(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch plans');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlan = async () => {
        if (!name || !price || !duration) {
            Alert.alert('Error', 'Please fill required fields');
            return;
        }

        setSubmitting(true);
        try {
            await createPlan({
                name,
                price: Number(price),
                durationDays: Number(duration),
                description
            });
            setModalVisible(false);
            resetForm();
            fetchPlans();
            Alert.alert('Success', 'Plan created successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to create plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (id) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this plan?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePlan(id);
                            fetchPlans();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete plan');
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setDuration('');
        setDescription('');
    };

    const renderItem = ({ item }) => (
        <View style={styles.planCard}>
            <View style={styles.planHeader}>
                <Text style={styles.planName}>{item.name}</Text>
                <Text style={styles.planPrice}>₹{item.price}</Text>
            </View>
            <Text style={styles.planDuration}>{item.durationDays} Days Validity</Text>
            <Text style={styles.planDesc}>{item.description}</Text>

            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePlan(item._id)}
            >
                <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription Plans</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
                <FlatList
                    data={plans}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No plans found. Create one!</Text>
                    }
                />
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Plan</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Plan Name (e.g. Monthly)"
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Price (₹)"
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Duration (Days)"
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Description"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleCreatePlan}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: colors.primary,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    loader: {
        marginTop: 50,
    },
    listContent: {
        padding: 20,
    },
    planCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    planName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    planPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primary,
    },
    planDuration: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    planDesc: {
        fontSize: 14,
        color: '#444',
    },
    deleteButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: '#ff4444',
        padding: 8,
        borderRadius: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#999',
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: colors.text,
    },
    input: {
        backgroundColor: '#f0f2f5',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#eee',
        marginRight: 10,
    },
    saveButton: {
        backgroundColor: colors.primary,
        marginLeft: 10,
    },
    cancelButtonText: {
        color: '#333',
        fontWeight: '600',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default ManagePlansScreen;
