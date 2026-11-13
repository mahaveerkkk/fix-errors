import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ScrollView
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme/theme';
import ScreenWrapper from '../components/common/ScreenWrapper';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

const MembershipScreen = ({ navigation }) => {
    const [plans, setPlans] = useState([
        { id: '1', name: 'Gold Member', price: '999', credits: '1200', validity: '3 Months', benefits: 'Priority Booking, 10% Off Products' },
        { id: '2', name: 'Silver Member', price: '499', credits: '550', validity: '1 Month', benefits: '5% Off Services' },
    ]);

    const [modalVisible, setModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [credits, setCredits] = useState('');
    const [validity, setValidity] = useState('');
    const [benefits, setBenefits] = useState('');

    const handleAddPlan = () => {
        setName('');
        setPrice('');
        setCredits('');
        setValidity('');
        setBenefits('');
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!name || !price) {
            Alert.alert('Error', 'Please fill required fields');
            return;
        }

        const newPlan = {
            id: Date.now().toString(),
            name,
            price,
            credits: credits || price,
            validity: validity || '1 Month',
            benefits
        };
        setPlans(prev => [...prev, newPlan]);
        setModalVisible(false);
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Plan', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => setPlans(prev => prev.filter(p => p.id !== id)) }
        ]);
    };

    const renderPlanItem = ({ item }) => (
        <Card style={styles.planCard}>
            <View style={styles.planHeader}>
                <View>
                    <Text style={styles.planName}>{item.name}</Text>
                    <Text style={styles.planPrice}>₹{item.price}</Text>
                </View>
                <View style={styles.creditBadge}>
                    <Text style={styles.creditLabel}>Get Credits</Text>
                    <Text style={styles.creditValue}>₹{item.credits}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.detailText}>Valid for {item.validity}</Text>
            </View>

            {item.benefits ? (
                <View style={styles.detailRow}>
                    <Ionicons name="gift-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.detailText}>{item.benefits}</Text>
                </View>
            ) : null}

            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete Plan</Text>
            </TouchableOpacity>
        </Card>
    );

    return (
        <ScreenWrapper>
            <Header title="Membership Plans" showBack />

            <FlatList
                data={plans}
                renderItem={renderPlanItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <Button
                        title="+ Create New Plan"
                        onPress={handleAddPlan}
                        style={{ marginBottom: 20 }}
                    />
                }
            />

            {/* Add Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>Create Membership Plan</Text>

                            <Text style={styles.inputLabel}>Plan Name</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Gold Membership"
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.inputLabel}>Price (₹)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={price}
                                        onChangeText={setPrice}
                                        placeholder="999"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.inputLabel}>Credit Value (₹)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={credits}
                                        onChangeText={setCredits}
                                        placeholder="1200"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Validity</Text>
                            <TextInput
                                style={styles.input}
                                value={validity}
                                onChangeText={setValidity}
                                placeholder="e.g. 3 Months"
                            />

                            <Text style={styles.inputLabel}>Benefits / Description</Text>
                            <TextInput
                                style={styles.input}
                                value={benefits}
                                onChangeText={setBenefits}
                                placeholder="e.g. Priority Booking, Free Haircut"
                                multiline
                            />

                            <View style={styles.modalActions}>
                                <Button
                                    title="Cancel"
                                    variant="outline"
                                    onPress={() => setModalVisible(false)}
                                    style={{ flex: 1, marginRight: 10 }}
                                />
                                <Button
                                    title="Create"
                                    onPress={handleSave}
                                    style={{ flex: 1, marginLeft: 10 }}
                                />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    listContent: {
        padding: 20,
    },
    planCard: {
        marginBottom: 16,
        padding: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    planName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    creditBadge: {
        backgroundColor: '#E8F5E9',
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    creditLabel: {
        fontSize: 10,
        color: '#2E7D32',
        fontWeight: 'bold',
    },
    creditValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2E7D32',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.divider,
        marginVertical: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginLeft: 8,
    },
    deleteButton: {
        marginTop: 12,
        alignSelf: 'flex-end',
    },
    deleteText: {
        color: theme.colors.error,
        fontSize: 14,
        fontWeight: '600',
    },
    // Modal
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: theme.colors.text,
    },
    inputLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
        color: theme.colors.text,
    },
    row: {
        flexDirection: 'row',
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 10,
        marginBottom: 20,
    }
});

export default MembershipScreen;
