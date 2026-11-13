import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getTheme } from '../theme/theme';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    Image,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Switch
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { addService, updateService, deleteService, addStaff, updateStaff, removeStaff, uploadImage, getSalonById } from '../services/api';
import { useRoute } from '@react-navigation/native';

const DEFAULT_SERVICES = [
    {
        name: 'Haircut & Styling',
        price: 150,
        duration: 30,
        category: 'Hair',
        photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266034/stylq/services/service_haircut_1791265836653.jpg']
    },
    {
        name: 'Beard Trim & Shave',
        price: 100,
        duration: 20,
        category: 'Face',
        photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266035/stylq/services/service_shave_1791265853904.jpg']
    },
    {
        name: 'Face Cleanup & Facial',
        price: 350,
        duration: 45,
        category: 'Face',
        photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266036/stylq/services/service_facial_1791265875671.jpg']
    },
    {
        name: 'Hair Color & Highlights',
        price: 650,
        duration: 60,
        category: 'Hair',
        photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266037/stylq/services/service_haircolor_1791265894421.jpg']
    },
    {
        name: 'Head Massage & Spa',
        price: 200,
        duration: 30,
        category: 'Relaxation',
        photos: ['https://res.cloudinary.com/dwu3tel5x/image/upload/v1791266038/stylq/services/service_headmassage_1791265912838.jpg']
    }
];

const ServiceManagementScreen = ({ navigation, route }) => {
    const { isDarkMode } = useTheme();
    const theme = getTheme(isDarkMode);
    const initialSalon = route.params?.salon || {};
    const routeName = useRoute().name; // Get current screen name
    const [salon, setSalon] = useState(initialSalon || { services: [], staff: [] });
    const [activeTab, setActiveTab] = useState(route.params?.initialTab || (routeName === 'StaffManagement' ? 'Staff' : 'Services')); // 'Services' | 'Staff'
    const [loading, setLoading] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [uploadingImg, setUploadingImg] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null); // Added for deferred upload

    // Form Fields (Shared)
    const [name, setName] = useState('');
    const [price, setPrice] = useState(''); // Service
    const [duration, setDuration] = useState(''); // Service
    const [category, setCategory] = useState(''); // Service
    const [role, setRole] = useState(''); // Staff
    const [photoUrl, setPhotoUrl] = useState(''); // Shared for both

    // --- Actions ---

    const openAddModal = () => {
        setIsEditing(false);
        setEditItem(null);
        setName('');
        setPrice('');
        setDuration('');
        setCategory('');
        setRole('');
        setPhotoUrl('');
        setSelectedAsset(null);
        setModalVisible(true);
    };

    const openEditModal = (item) => {
        setIsEditing(true);
        setEditItem(item);
        setName(item.name);
        if (activeTab === 'Services') {
            setPrice(item.price.toString());
            setDuration(item.duration.toString());
            setCategory(item.category || '');
            setPhotoUrl(item.photos && item.photos.length > 0 ? item.photos[0] : '');
        } else {
            setRole(item.role || '');
            setPhotoUrl(item.photo || '');
        }
        setSelectedAsset(null);
        setModalVisible(true);
    };

    const handlePickImage = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
            selectionLimit: 1,
        });

        if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setSelectedAsset(asset);
            setPhotoUrl(asset.uri); // Local preview only
        }
    };

    const handleSave = async () => {
        if (!name) { Alert.alert('Error', 'Name is required'); return; }
        setLoading(true);

        let finalPhotoUrl = photoUrl;

        // If a new image was selected, upload it now
        if (selectedAsset) {
            try {
                finalPhotoUrl = await uploadImage(selectedAsset, activeTab === 'Services' ? 'services' : 'staff');
            } catch (error) {
                Alert.alert('Warning', 'Image upload failed, saving without new image.');
                finalPhotoUrl = isEditing ? (activeTab === 'Services' && editItem.photos?.length ? editItem.photos[0] : (editItem.photo || '')) : '';
            }
        }

        try {
            if (activeTab === 'Services') {
                const serviceData = {
                    name,
                    price: parseFloat(price) || 0,
                    duration: parseInt(duration) || 30,
                    category: category || 'General',
                    photos: finalPhotoUrl ? [finalPhotoUrl] : [] // Backend expects array
                };
                if (isEditing) {
                    await updateService(salon._id, editItem.name, serviceData);
                } else {
                    await addService(salon._id, serviceData);
                }
            } else {
                const staffData = {
                    name,
                    role,
                    status: 'Available',
                    photo: finalPhotoUrl || `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}`
                };
                if (isEditing) {
                    await updateStaff(salon._id, editItem._id, staffData);
                } else {
                    await addStaff(salon._id, staffData);
                }
            }

            // Refetch fresh salon data
            const freshSalon = await getSalonById(salon._id);
            setSalon(freshSalon);
            setModalVisible(false);
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDefaults = async () => {
        if (loading) return; // Prevent multiple clicks / double taps
        setLoading(true);
        try {
            const existingNames = (salon.services || []).map(s => s.name?.toLowerCase().trim());
            // Only add services that are not already present
            const servicesToAdd = DEFAULT_SERVICES.filter(ds => !existingNames.includes(ds.name?.toLowerCase().trim()));

            if (servicesToAdd.length === 0) {
                Alert.alert('Info', 'Default services are already added to your salon.');
                setLoading(false);
                return;
            }

            for (const service of servicesToAdd) {
                await addService(salon._id, service);
            }
            const freshSalon = await getSalonById(salon._id);
            setSalon(freshSalon);
            Alert.alert('Success', 'Default services added successfully!');
        } catch (error) {
            Alert.alert('Error', 'Failed to add defaults: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (item) => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setLoading(true);
                    try {
                        if (activeTab === 'Services') {
                            await deleteService(salon._id, item.name);
                        } else {
                            await removeStaff(salon._id, item._id);
                        }

                        // Refetch fresh salon data
                        const { getSalonById } = require('../services/api');
                        const freshSalon = await getSalonById(salon._id);
                        setSalon(freshSalon);
                    } catch (error) {
                        Alert.alert('Error', error.message);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    // --- Render Items ---

    const renderServiceItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {item.photos && item.photos.length > 0 ? (
                <Image source={{ uri: item.photos[0] }} style={styles.itemImage} />
            ) : (
                <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E293B' : '#E3F2FD' }]}>
                    <Ionicons name="cut-outline" size={24} color={theme.colors.primary} />
                </View>
            )}
            <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.name}</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>{item.duration} mins • {item.category}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceTag, { color: theme.colors.primary }]}>₹{item.price}</Text>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editIcon}>
                    <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.trashIcon} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={16} color="#FF5252" />
            </TouchableOpacity>
        </View>
    );

    const handleToggleAvailability = async (staffItem) => {
        const newValue = !(staffItem.isAvailable !== false);
        try {
            await updateStaff(salon._id, staffItem._id, { isAvailable: newValue });
            const freshSalon = await getSalonById(salon._id);
            setSalon(freshSalon);
        } catch (error) {
            Alert.alert('Error', 'Failed to update staff availability');
        }
    };

    const renderStaffItem = ({ item }) => {
        const isAvailable = item.isAvailable !== false; // default true
        return (
            <View style={[styles.card, { backgroundColor: theme.colors.surface }, !isAvailable && { opacity: 0.6 }]}>
                <Image source={{ uri: item.photo || item.image }} style={styles.avatar} />
                <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>{item.role}</Text>
                    {!isAvailable && (
                        <Text style={{ fontSize: 11, color: '#FF5252', fontWeight: '600', marginTop: 2 }}>⛔ Absent Today</Text>
                    )}
                </View>
                <View style={{ alignItems: 'center', marginRight: 8 }}>
                    <Switch
                        value={isAvailable}
                        onValueChange={() => handleToggleAvailability(item)}
                        trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
                        thumbColor={isAvailable ? '#FFF' : '#FFF'}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Text style={{ fontSize: 9, color: isAvailable ? '#4CAF50' : '#FF5252', fontWeight: '600', marginTop: 2 }}>
                        {isAvailable ? 'Active' : 'Off'}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editIcon}>
                    <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.trashIcon} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={16} color="#FF5252" />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Salon</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Services' && styles.activeTab, { borderBottomColor: activeTab === 'Services' ? theme.colors.primary : 'transparent' }]}
                    onPress={() => setActiveTab('Services')}
                >
                    <Text style={[styles.tabText, activeTab === 'Services' && { color: theme.colors.primary }, activeTab !== 'Services' && { color: theme.colors.textSecondary }]}>
                        Services ({salon.services?.length || 0})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Staff' && styles.activeTab, { borderBottomColor: activeTab === 'Staff' ? theme.colors.primary : 'transparent' }]}
                    onPress={() => setActiveTab('Staff')}
                >
                    <Text style={[styles.tabText, activeTab === 'Staff' && { color: theme.colors.primary }, activeTab !== 'Staff' && { color: theme.colors.textSecondary }]}>
                        Staff ({salon.staff?.length || 0})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <FlatList
                data={activeTab === 'Services' ? (salon.services || []) : (salon.staff || [])}
                renderItem={activeTab === 'Services' ? renderServiceItem : renderStaffItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.listContainer}
                ListHeaderComponent={
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.colors.primary }]} onPress={openAddModal}>
                        <Text style={[styles.addBtnText, { color: theme.colors.background }]}>+ Add New {activeTab === 'Services' ? 'Service' : 'Staff'}</Text>
                    </TouchableOpacity>
                }
                ListEmptyComponent={
                    activeTab === 'Services' ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="cut-outline" size={60} color="#CCC" />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No services added yet.</Text>
                            <TouchableOpacity style={styles.importBtn} onPress={handleAddDefaults}>
                                <Ionicons name="cloud-download-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.importBtnText}>Import Default Services</Text>
                            </TouchableOpacity>
                            <Text style={styles.emptyHint}>Quickly add common services like Haircut, Shave, etc.</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={60} color="#CCC" />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No staff members added yet.</Text>
                        </View>
                    )
                }
            />

            {/* Modal */}
            <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit' : 'Add'} {activeTab === 'Services' ? 'Service' : 'Staff'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>

                        {/* Image Picker */}
                        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImg}>
                            {uploadingImg ? (
                                <ActivityIndicator color="#1C2237" />
                            ) : photoUrl ? (
                                <Image source={{ uri: photoUrl }} style={styles.pickedImage} />
                            ) : (
                                <View style={{ alignItems: 'center' }}>
                                    <Ionicons name="camera-outline" size={32} color="#CCC" />
                                    <Text style={styles.uploadText}>Upload Photo</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor="#999"
                            value={name} onChangeText={setName}
                        />

                        {activeTab === 'Services' ? (
                            <>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        placeholder="Price (₹)"
                                        keyboardType="numeric"
                                        placeholderTextColor="#999"
                                        value={price} onChangeText={setPrice}
                                    />
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        placeholder="Duration (min)"
                                        keyboardType="numeric"
                                        placeholderTextColor="#999"
                                        value={duration} onChangeText={setDuration}
                                    />
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Category (e.g. Hair, Facial)"
                                    placeholderTextColor="#999"
                                    value={category} onChangeText={setCategory}
                                />
                            </>
                        ) : (
                            <TextInput
                                style={styles.input}
                                placeholder="Role (e.g. Senior Stylist)"
                                placeholderTextColor="#999"
                                value={role} onChangeText={setRole}
                            />
                        )}

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={uploadingImg}>
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FD' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, paddingTop: 20, marginBottom: 20
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1F2B' },
    headerSubtitle: { fontSize: 14, color: '#888' },
    headerProfile: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE' },

    tabContainer: {
        flexDirection: 'row', marginHorizontal: 24, backgroundColor: '#FFF',
        borderRadius: 30, padding: 4, marginBottom: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 26, alignItems: 'center' },
    activeTab: { backgroundColor: '#1C2237' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
    activeTabText: { color: '#FFF' },

    listContainer: { paddingHorizontal: 24, paddingBottom: 100 },

    addBtn: {
        borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', borderRadius: 20,
        paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.5)'
    },
    addBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },

    // Card
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        padding: 16, borderRadius: 20, marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1
    },
    iconBox: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: '#E3F2FD',
        justifyContent: 'center', alignItems: 'center', marginRight: 16
    },
    itemImage: {
        width: 44, height: 44, borderRadius: 12, marginRight: 16, backgroundColor: '#EEE'
    },
    avatar: {
        width: 44, height: 44, borderRadius: 12, marginRight: 16, backgroundColor: '#EEE'
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1F2B' },
    cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
    priceTag: { fontSize: 16, fontWeight: 'bold', color: '#1A1F2B', marginBottom: 4 },
    editIcon: { padding: 4 },
    trashIcon: { padding: 4, marginLeft: 8 },


    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1F2B' },
    input: {
        backgroundColor: '#F5F6F8', padding: 16, borderRadius: 16,
        marginBottom: 16, fontSize: 16, color: '#333'
    },
    saveBtn: {
        backgroundColor: '#1C2237', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 10
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    cancelBtn: { padding: 16, alignItems: 'center', marginTop: 10 },
    cancelBtnText: { color: '#888', fontWeight: 'bold' },

    // Image Picker
    imagePicker: {
        width: 100, height: 100, borderRadius: 20, backgroundColor: '#F5F6F8',
        alignSelf: 'center', justifyContent: 'center', alignItems: 'center',
        marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE'
    },
    pickedImage: {
        width: '100%', height: '100%'
    },
    uploadText: {
        fontSize: 10, color: '#888', marginTop: 4
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 50,
        marginTop: 20
    },
    emptyText: {
        fontSize: 16,
        marginVertical: 10
    },
    emptyHint: {
        fontSize: 12,
        color: '#AAA',
        marginTop: 10
    },
    importBtn: {
        backgroundColor: '#7C4DFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        marginTop: 10,
        shadowColor: "#7C4DFF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5
    },
    importBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14
    }
});

export default ServiceManagementScreen;
