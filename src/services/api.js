import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { ENV } from '../config/env';

const API_URL = ENV.API_URL;

// Helper to get Auth Headers
const getAuthHeaders = async () => {
    try {
        let user = auth().currentUser;
        if (!user) {
            // Wait a moment for auth state to sync if it's in a race condition
            await new Promise(resolve => setTimeout(resolve, 1000));
            user = auth().currentUser;
        }

        const token = await user?.getIdToken(true); // Force refresh



        if (!token) return { 'Content-Type': 'application/json' }; // Fallback
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    } catch (e) {
        return { 'Content-Type': 'application/json' };
    }
};

export const checkConnection = async () => {
    try {
        const response = await fetch(`${API_URL}/test/ping`, { timeout: 2000 }); // Short timeout
        return response.ok;
    } catch (error) {
        return false;
    }
};

export const loginUser = async (idToken, role = null, fcmToken = null) => {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken, role, fcmToken }), // Send fcmToken to backend
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        return data;
    } catch (error) {
        throw error;
    }
};

export const signupUser = async (userData) => {
    try {
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }
        return data;
    } catch (error) {
        throw error;
    }
};

export const registerSalon = async (salonData) => {
    try {
        // This might need auth if user is already logged in? Usually public or uses user data from auth.
        // Assuming user is authenticated at this stage.
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/register`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(salonData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to register salon');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getSalons = async (searchQuery = '', filters = {}) => {
    try {
        const radius = filters.radius || 10000;
        let url;

        if (filters.lat && filters.lng) {
            // Real GPS available — use nearby endpoint with actual coordinates
            url = `${API_URL}/salons/nearby?lat=${filters.lat}&lng=${filters.lng}&radius=${radius}`;
        } else {
            // No real GPS — use general endpoint (no fake Delhi distance)
            url = `${API_URL}/salons/nearby?lat=28.6139&lng=77.2090&radius=100000&noLocation=true`;
        }

        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }

        if (filters.sortBy) {
            url += `&sortBy=${filters.sortBy}`;
        }

        if (filters.priceRange) {
            url += `&priceRange=${filters.priceRange}`;
        }

        if (filters.minRating) {
            url += `&minRating=${filters.minRating}`;
        }

        if (filters.maxDistance) {
            url += `&maxDistance=${filters.maxDistance}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch salons');
        return data;
    } catch (error) {
        throw error;
    }
};



export const getSalonById = async (salonId) => {
    try {
        const response = await fetch(`${API_URL}/salons/${salonId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch salon');
        return data;
    } catch (error) {
        throw error;
    }
};

export const updateUserProfile = async (userId, updates) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updates),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update profile');
        return data;
    } catch (error) {
        throw error;
    }
};

export const bookService = async (bookingData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/book`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bookingData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Booking failed: ${data.error || response.statusText}`);
        return data;
    } catch (error) {
        throw error;
    }
};

export const getUserBookings = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/user-bookings/${userId}`, {
            headers: headers // Added headers here too just in case
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch bookings');
        return data;
    } catch (error) {
        throw error;
    }
};

export const toggleSalonStatus = async (salonId, status) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/toggle-status`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, status }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update status');
        return data;
    } catch (error) {
        throw error;
    }
};

export const toggleBreak = async (salonId, action, duration = 0) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/toggle-break`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, action, duration }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to toggle break');
        return data;
    } catch (error) {
        throw error;
    }
};

export const updateQueue = async (salonId, action, reason = null) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/update-queue`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, action, reason }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update queue');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getEarnings = async (salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/earnings?salonId=${salonId}`, {
            headers: headers
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch earnings');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getAnalytics = async (salonId, period = 'Weekly') => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/analytics?salonId=${salonId}&period=${period}`, {
            headers: headers
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch analytics');
        return data;
    } catch (error) {
        throw error;
    }
};

export const respondToBooking = async (bookingId, action) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/respond-booking`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ bookingId, action }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to respond to booking');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getSalonQueue = async (salonId) => {
    try {
        // Queue status might be public? Often better to be public for customers.
        const response = await fetch(`${API_URL}/salons/queue/${salonId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch queue');
        return data;
    } catch (error) {
        throw error;
    }
};

export const addService = async (salonId, service) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/services/add`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, service }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add service');
        return data;
    } catch (error) {
        throw error;
    }
};

export const updateService = async (salonId, serviceName, updates) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/services/${salonId}/${serviceName}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updates),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update service');
        return data;
    } catch (error) {
        throw error;
    }
};

export const deleteService = async (salonId, serviceName) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/services/${salonId}/${serviceName}`, {
            method: 'DELETE',
            headers: headers
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete service');
        return data;
    } catch (error) {
        throw error;
    }
};

// folder: 'profiles' | 'salons' | 'services'
export const uploadImage = async (photo, folder = 'misc') => {
    try {
        const formData = new FormData();

        // Ensure URI is correct for Android
        let localUri = photo.uri;
        if (Platform.OS === 'android' && !localUri.startsWith('file://') && !localUri.startsWith('content://')) {
            localUri = 'file://' + localUri;
        }

        formData.append('image', {
            uri: localUri,
            type: photo.type || 'image/jpeg',
            name: photo.fileName || `photo_${Date.now()}.jpg`,
        });
        // Assuming upload is public or handles its own auth? Better to NOT mess with Multipart headers manually if not needed.
        // Fetch handles boundary automatically. If we add Authorization, we must be careful not to override Content-Type.
        const token = await auth().currentUser?.getIdToken();
        const headers = { 'Accept': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/upload?folder=${folder}`, {
            method: 'POST',
            body: formData,
            headers: headers
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}`);
        }

        if (!response.ok) throw new Error(data.error || 'Image upload failed');
        return data.filePath;
    } catch (error) {
        throw error;
    }
};

export const updateSalon = async (salonId, updates) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/${salonId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updates),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update salon');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getPlans = async () => {
    try {
        const response = await fetch(`${API_URL}/admin/plans`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch plans');
        return data;
    } catch (error) {
        throw error;
    }
};

export const createPlan = async (planData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/admin/plans`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(planData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create plan');
        return data;
    } catch (error) {
        throw error;
    }
};

export const deletePlan = async (id) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/admin/plans/${id}`, {
            method: 'DELETE',
            headers: headers,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete plan');
        return data;
    } catch (error) {
        throw error;
    }
};

// Staff Management Calls

export const addStaff = async (salonId, staffMember) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/staff/add`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, staffMember }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add staff');
        return data;
    } catch (error) {
        throw error;
    }
};

export const removeStaff = async (salonId, staffId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/staff/${salonId}/${staffId}`, {
            method: 'DELETE',
            headers: headers,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to remove staff');
        return data;
    } catch (error) {
        throw error;
    }
};

export const updateStaff = async (salonId, staffId, updates) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/staff/${salonId}/${staffId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updates),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update staff');
        return data;
    } catch (error) {
        throw error;
    }
};

// Favorites
export const getFavorites = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/users/${userId}/favorites`, { headers: headers }); // Usually user specific
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch favorites');
        return data;
    } catch (error) {
        throw error;
    }
};

export const toggleFavorite = async (userId, salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/users/${userId}/favorites`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to toggle favorite');
        return data;
    } catch (error) {
        throw error;
    }
};

// Payment APIs
export const createOrder = async (orderData) => {
    try {
        // AUTH HEADER CRITICAL HERE
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/payment/create-order`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(orderData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create order');
        return data;
    } catch (error) {
        throw error;
    }
};

export const verifyPayment = async (paymentData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/payment/verify-signature`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(paymentData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Payment verification failed');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getRazorpayKey = async () => {
    try {
        const response = await fetch(`${API_URL}/payment/key`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch key');
        return data.key;
    } catch (error) {
        throw error;
    }
};

export const updateCustomerStatus = async (bookingId, status) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/booking/status`, { // Need to add route to routes!
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ bookingId, status }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update status');
        return data;
    } catch (error) {
        throw error;
    }
};

export const completeBooking = async (bookingId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/booking/complete`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ bookingId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to complete booking');
        return data;
    } catch (error) {
        throw error;
    }
};

// Reviews API
export const addReview = async (salonId, userId, rating, comment) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/review`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, userId, rating, comment }),
        });
        const data = await response.json();
        if (!response.ok) {
            const errorObj = new Error(data.error || 'Failed to add review');
            errorObj.data = data; // Attach full response data (like nextReviewDate)
            throw errorObj;
        }
        return data;
    } catch (error) {
        throw error;
    }
};

export const getReviews = async (salonId, filterRating = 'all') => {
    try {
        let url = `${API_URL}/salons/reviews/${salonId}`;
        if (filterRating && filterRating !== 'all') {
            url += `?filterRating=${filterRating}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch reviews');
        return data;
    } catch (error) {
        throw error;
    }
};

// Like / Unlike a review
export const likeReview = async (reviewId, userId) => {
    try {
        const response = await fetch(`${API_URL}/salons/like-review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewId, userId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to like review');
        return data;
    } catch (error) {
        throw error;
    }
};

// Check if user can review (3-month cooldown)
export const canReview = async (salonId, userId) => {
    try {
        const response = await fetch(`${API_URL}/salons/can-review?salonId=${salonId}&userId=${userId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to check review eligibility');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getPendingReview = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/pending-review?userId=${userId}`, {
            headers: headers
        });
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
};

export const cancelBookingByUser = async (bookingId, userId, reason) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/cancel-by-user`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ bookingId, userId, reason }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to cancel booking');
        return data;
    } catch (error) {
        throw error;
    }
};

// Add Walk-in Customer
export const addWalkIn = async (salonId, customerName, services) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/walk-in`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, customerName, services }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add walk-in');
        return data;
    } catch (error) {
        throw error;
    }
};

// 1-Click Fast Walk-in Customer (Zero Typing)
export const quickAddWalkIn = async (salonId, serviceName, duration, price) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/quick-walk-in`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, serviceName, duration, price }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add quick walk-in');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getAppConfig = async () => {
    try {
        const response = await fetch(`${API_URL}/config/appData`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch config');
        return data;
    } catch (error) {
        throw error;
    }
};

// ============ WALLET APIs ============
export const getWallet = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch wallet');
        return data;
    } catch (error) {
        throw error;
    }
};

export const scratchCard = async (userId, cardId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/scratch/${userId}/${cardId}`, {
            method: 'POST',
            headers: headers,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to scratch card');
        return data;
    } catch (error) {
        throw error;
    }
};

// ============ WALLET NEW APIs ============
export const addMoneyCreateOrder = async (userId, amount) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/add-money/create-order`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ userId, amount }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create order');
        return data;
    } catch (error) {
        throw error;
    }
};

export const addMoneyVerify = async (paymentData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/add-money/verify`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(paymentData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Verification failed');
        return data;
    } catch (error) {
        throw error;
    }
};

export const paySalon = async (userId, salonId, amount) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/pay-salon`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ userId, salonId, amount }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Payment failed');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getSalonWallet = async (salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/salon/${salonId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch salon wallet');
        return data;
    } catch (error) {
        throw error;
    }
};

export const paySubscriptionFromWallet = async (salonId, planId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/pay-subscription`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, planId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Subscription payment failed');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getSalonForQR = async (salonId) => {
    try {
        const response = await fetch(`${API_URL}/wallet/scan/${salonId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch salon info');
        return data;
    } catch (error) {
        throw error;
    }
};

// PIN Methods
export const setWalletPin = async (userId, pin) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/set-pin`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ userId, pin }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to set PIN');
        return data;
    } catch (error) {
        throw error;
    }
};

export const verifyWalletPin = async (userId, pin) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/wallet/verify-pin`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ userId, pin }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invalid PIN');
        return data;
    } catch (error) {
        throw error;
    }
};

// ============ APPOINTMENT SLOT APIs ============
export const getAvailableSlots = async (salonId, date, totalDuration) => {
    try {
        const response = await fetch(`${API_URL}/salons/available-slots/${salonId}?date=${date}&totalDuration=${totalDuration}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch slots');
        return data;
    } catch (error) {
        throw error;
    }
};

export const bookAppointment = async (bookingData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/book-appointment`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bookingData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to book appointment');
        return data;
    } catch (error) {
        throw error;
    }
};

// Get upcoming appointments for a salon (salon owner view)
export const getUpcomingAppointments = async (salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/upcoming-appointments/${salonId}`, {
            headers: headers,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch appointments');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getUserProfile = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/users/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch user profile');
        return data;
    } catch (error) {
        throw error;
    }
};

export default {
    checkConnection,
    loginUser,
    signupUser,
    registerSalon,
    getSalons,
    getSalonById,
    updateUserProfile,
    getUserProfile,
    bookService,
    getUserBookings,
    toggleSalonStatus,
    toggleBreak,
    updateQueue,
    getEarnings,
    getAnalytics,
    respondToBooking,
    getSalonQueue,
    getPlans,
    createPlan,
    deletePlan,
    addService,
    updateService,
    deleteService,
    addStaff,
    removeStaff,
    updateStaff,
    uploadImage,
    updateSalon,
    getFavorites,
    toggleFavorite,
    createOrder,
    verifyPayment,
    getRazorpayKey,
    updateCustomerStatus,
    completeBooking,
    addReview,
    getReviews,
    canReview,
    getPendingReview,
    cancelBookingByUser,
    addWalkIn,
    likeReview,
    submitSupportTicket,
    getUserTickets,
    getAppConfig,
    getWallet,
    scratchCard,
    addMoneyCreateOrder,
    addMoneyVerify,
    paySalon,
    getSalonWallet,
    paySubscriptionFromWallet,
    getSalonForQR,
    getAvailableSlots,
    bookAppointment,
    getSalonCustomers
};

// Support Ticket APIs
export const submitSupportTicket = async (ticketData) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/support/create`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(ticketData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit ticket');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getUserTickets = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/support/user/${userId}`, {
            headers: headers
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch tickets');
        return data;
    } catch (error) {
        throw error;
    }
};
export const getSalonHistory = async (salonId, period = 'Daily') => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/history/${salonId}?period=${period}`, {
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText.substring(0, 100)}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
};

// Send Customer Status (On The Way / Delayed)
export const sendCustomerStatus = async (salonId, userId, status, eta = null) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/${salonId}/customer-status`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ userId, status, eta })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to send status');
        return data;
    } catch (error) {
        throw error;
    }
};

// Salon sends status message to a customer in queue
export const sendStatusToCustomer = async (bookingId, salonId, statusMessage) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/send-status-to-customer`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ bookingId, salonId, statusMessage })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to send status');
        return data;
    } catch (error) {
        throw error;
    }
};

// Customer Analytics — Full Profile
export const getCustomerProfile = async (salonId, userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/customer-profile/${salonId}/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch customer profile');
        return data;
    } catch (error) {
        throw error;
    }
};

// Save Customer Note
export const saveCustomerNote = async (salonId, userId, note) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/customer-note`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ salonId, userId, note })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save note');
        return data;
    } catch (error) {
        throw error;
    }
};

// CRM Fetch Customers
export const getSalonCustomers = async (salonId, filter = 'all') => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/crm/${salonId}/customers?filter=${filter}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch CRM data');
        return data;
    } catch (error) {
        throw error;
    }
};
// Delete Account — removes user + salon + bookings + wallet + Cloudinary + Firebase
export const deleteAccount = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: headers,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete account');
        return data;
    } catch (error) {
        throw error;
    }
};

// ============================================
// REFERRAL SYSTEM APIs
// ============================================
export const getMyReferralCode = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/referral/my-code/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch referral code');
        return data;
    } catch (error) {
        throw error;
    }
};

export const validateReferralCode = async (code) => {
    try {
        const response = await fetch(`${API_URL}/referral/validate-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invalid referral code');
        return data;
    } catch (error) {
        throw error;
    }
};

export const applyReferralCode = async (referralCode, salonId, userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/referral/apply`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ referralCode, salonId, userId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to apply referral code');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getReferralStats = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/referral/stats/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch referral stats');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getReferralHistory = async (userId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/referral/history/${userId}`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch referral history');
        return data;
    } catch (error) {
        throw error;
    }
};

export const getTodayVisitors = async (salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/salons/${salonId}/visitors`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch visitors');
        return data;
    } catch (error) {
        throw error;
    }
};

export const logSalonView = async (salonId) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/crm/${salonId}/log-view`, {
            method: 'POST',
            headers: headers
        });
        const data = await response.json();
        return data;
    } catch (error) {
        return { logged: false };
    }
};
