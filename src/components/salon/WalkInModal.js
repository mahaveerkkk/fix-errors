import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { addWalkIn } from '../../services/api';

const WalkInModal = ({ visible, onClose, salon, onAdded }) => {
    const [customerName, setCustomerName] = useState('');
    const [selectedServices, setSelectedServices] = useState([]);
    const [loading, setLoading] = useState(false);

    const toggleService = (service) => {
        const index = selectedServices.findIndex(s => s.name === service?.name);
        if (index === -1) {
            setSelectedServices([...selectedServices, service]);
        } else {
            const newServices = [...selectedServices];
            newServices.splice(index, 1);
            setSelectedServices(newServices);
        }
    };

    const handleAddCustomer = async () => {
        if (!customerName.trim()) {
            Alert.alert('Error', 'Customer name is required');
            return;
        }
        if (selectedServices.length === 0) {
            Alert.alert('Error', 'Select at least one service');
            return;
        }

        setLoading(false);
        try {
            const result = await addWalkIn(salon._id, customerName, selectedServices);
            Alert.alert('Success', 'Customer added to queue!');
            onAdded && onAdded(result);
            handleClose();
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to add customer');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCustomerName('');
        setSelectedServices([]);
        onClose();
    };

    const totalAmount = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    const totalTime = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Walk-in Customer</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
                        {/* Name Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Customer Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter Name"
                                placeholderTextColor="#999"
                                value={customerName}
                                onChangeText={setCustomerName}
                            />

                            {/* Service Selection */}
                            <Text style={styles.label}>Select Services</Text>
                            <View style={styles.servicesGrid}>
                                {salon?.services?.map((service, index) => {
                                    const isSelected = selectedServices.some(s => s.name === service?.name);
                                    const servicePhoto = service.photos && service.photos.length > 0 ? service.photos[0] : null;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.serviceItem,
                                                isSelected && styles.serviceItemSelected
                                            ]}
                                            onPress={() => toggleService(service)}
                                        >
                                            {/* Service Photo / Icon */}
                                            {servicePhoto ? (
                                                <Image source={{ uri: servicePhoto }} style={styles.servicePhoto} />
                                            ) : (
                                                <View style={[styles.serviceIconBox, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                                    <Ionicons name="cut-outline" size={18} color={isSelected ? '#FFF' : '#7C3AED'} />
                                                </View>
                                            )}
                                            <View style={styles.serviceInfo}>
                                                <Text style={[styles.serviceName, isSelected && styles.textWhite]} numberOfLines={1}>
                                                    {service.name}
                                                </Text>
                                                <Text style={[styles.serviceMeta, isSelected && styles.textWhiteLight]}>
                                                    ₹{service.price} • {service.duration || 30}m
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Summary Card */}
                        {selectedServices.length > 0 && (
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Selected Services</Text>
                                    <Text style={styles.summaryValue}>{selectedServices.length}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Duration</Text>
                                    <Text style={styles.summaryValue}>{totalTime} mins</Text>
                                </View>
                                <View style={[styles.summaryRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalValue}>₹{totalAmount}</Text>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 30 }} />
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                            onPress={handleAddCustomer}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Add to Queue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
    },
    closeBtn: {
        padding: 4,
    },
    body: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
        marginBottom: 16,
    },
    servicesGrid: {
        flexDirection: 'column',
        gap: 10,
    },
    serviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        gap: 10,
    },
    serviceItemSelected: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    servicePhoto: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#E5E7EB',
    },
    serviceIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F3E8FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    serviceMeta: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    textWhite: {
        color: '#FFF',
    },
    textWhiteLight: {
        color: 'rgba(255,255,255,0.8)',
    },
    summaryCard: {
        backgroundColor: '#F3E8FF',
        borderRadius: 16,
        padding: 16,
        marginTop: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(124,58,237,0.2)',
        paddingTop: 8,
        marginTop: 4,
        marginBottom: 0,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#7C3AED',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#7C3AED',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    submitBtn: {
        flex: 2,
        backgroundColor: '#7C3AED',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        backgroundColor: '#A78BFA',
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
});

export default WalkInModal;
