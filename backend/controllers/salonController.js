const Salon = require('../models/Salon');
const { updateReferralSalonId } = require('./referralController');

// ============================================
// 📌 CONFIGURABLE LIMITS - Edit these values as needed
// ============================================
const MONTHLY_BOOKING_LIMIT = 3;/// Max bookings per user per month (change this to adjust limit)
// ============================================
const Booking = require('../models/Booking');
const User = require('../models/User');
const Review = require('../models/Review');
const { getIo } = require('../socket');
const { sendNotification } = require('../services/notificationService');
const { deleteImage } = require('../utils/cloudinary');
const {
    isValidObjectId, isValidRating, isValidSalonStatus, isValidPhone, sanitizePhone,
    isValidEmail, isValidLatitude, isValidLongitude, isValidCoordinates, isValidPrice, isValidDuration,
    isValidService, validateServicesArray, sanitizeUpdateFields, SALON_UPDATE_WHITELIST
} = require('../utils/validation');

// Helper to calculate distance (Haversine Formula) - Hardened against null/undefined/NaN
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
        lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
        return null;
    }

    var nLat1 = Number(lat1), nLon1 = Number(lon1);
    var nLat2 = Number(lat2), nLon2 = Number(lon2);

    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

    // (0,0) is Null Island placeholder
    if ((nLat1 === 0 && nLon1 === 0) || (nLat2 === 0 && nLon2 === 0)) return null;

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(nLat2 - nLat1);
    var dLon = deg2rad(nLon2 - nLon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(nLat1)) * Math.cos(deg2rad(nLat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return isNaN(d) ? null : d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

exports.registerSalon = async (req, res) => {
    try {
        let { ownerId, name, description, address, phone, email, latitude, longitude, services, staff, timings, images, status } = req.body;
        // HARDENING: Validate ownerId
        if (!ownerId || !isValidObjectId(ownerId)) {
            return res.status(400).json({ error: 'Invalid owner ID' });
        }

        // HARDENING: Validate required name
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Salon name is required' });
        }

        // HARDENING: Validate and sanitize phone
        if (phone) {
            if (!isValidPhone(phone)) {
                return res.status(400).json({ error: 'Invalid phone number. Must be at least 10 digits.' });
            }
            phone = sanitizePhone(phone);
        }

        // HARDENING: Validate email format
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // HARDENING: Validate GPS coordinates - MUST be real coordinates, NOT (0,0) or missing
        if (!isValidCoordinates(latitude, longitude)) {
            return res.status(400).json({
                error: 'Salon GPS location is required to register. Please enable location services on your device.'
            });
        }

        latitude = Number(latitude);
        longitude = Number(longitude);

        // HARDENING: Validate services array structure
        if (services && services.length > 0) {
            const servicesValidation = validateServicesArray(services);
            if (!servicesValidation.valid) {
                return res.status(400).json({ error: servicesValidation.error });
            }
        }

        // HARDENING: Validate status
        if (status && !isValidSalonStatus(status)) {
            status = 'draft'; // Default if invalid
        }

        // Default services for new salons (if none provided)
        const defaultServices = [
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

        const newSalon = new Salon({
            ownerId,
            name: name.trim(),
            description: description || '',
            address: address ? address.trim() : '',
            phone,
            email,
            location: {
                lat: latitude,
                lng: longitude
            },
            services: (services && services.length > 0) ? services : defaultServices,
            staff: staff || [],
            timings: timings || { open: '09:00', close: '21:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
            images: images || [],
            status: status || 'draft'
        });

        await newSalon.save();

        // Check if referral code was used during owner signup
        try {
            await updateReferralSalonId(ownerId, newSalon._id);
        } catch (refError) {
            console.error('Error updating referral salonId:', refError.message);
        }

        res.status(201).json({ message: 'Salon registered successfully', salon: newSalon });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register salon: ' + error.message });
    }
};

// Get single salon by ID
exports.getSalonById = async (req, res) => {
    try {
        const { salonId } = req.params;
        const salon = await Salon.findById(salonId).populate('ownerId', 'name email profilePhoto');
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Safely increment profile views in background
        Salon.updateOne({ _id: salonId }, { $inc: { profileViews: 1 } }).catch(console.error);

        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getNearbySalons = async (req, res) => {
    try {
        const { lat, lng, search, priceRange, minRating, maxDistance, sortBy, skipDistance } = req.query;

        // Build query
        let query = {
            isBlocked: false,
            status: { $ne: 'draft' } // Exclude unapproved/draft salons
        };

        // Search query
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { 'services.name': { $regex: search, $options: 'i' } }
            ];
        }

        const salons = await Salon.find(query).populate('ownerId', 'name profilePhoto').lean();

        // Parallel processing for distance & fresh queue counts & atomic rating calculation
        let processedSalons = await Promise.all(salons.map(async (salon) => {
            let distance = null;
            if (!skipDistance && lat && lng && salon.location && salon.location.lat && salon.location.lng
                && !(salon.location.lat === 0 && salon.location.lng === 0)) {
                distance = getDistanceFromLatLonInKm(lat, lng, salon.location.lat, salon.location.lng);
            }

            // Calculate avg price
            let avgPrice = 0;
            if (salon.services && salon.services.length > 0) {
                const total = salon.services.reduce((sum, s) => sum + s.price, 0);
                avgPrice = total / salon.services.length;
            }

            // Count actual active bookings
            const activeBookings = await Booking.find({
                salonId: salon._id,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const realQueueCount = activeBookings.length;
            const totalWaitTime = activeBookings.reduce((total, booking) => {
                const bookingDuration = booking.services.reduce((sum, service) => sum + (service.duration || 30), 0);
                return total + bookingDuration;
            }, 0);

            // FIX RATING BUG: Compute real average rating from Review collection
            const mongoose = require('mongoose');
            const reviewStats = await Review.aggregate([
                { $match: { salonId: new mongoose.Types.ObjectId(salon._id) } },
                { $group: { _id: '$salonId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
            ]);

            const realRating = reviewStats.length > 0
                ? Math.round(reviewStats[0].avgRating * 10) / 10
                : (salon.rating || 0);

            const realReviewCount = reviewStats.length > 0
                ? reviewStats[0].count
                : (salon.reviewCount || 0);

            return {
                ...salon,
                rating: realRating,
                reviewCount: realReviewCount,
                distance,
                avgPrice,
                liveQueueCount: realQueueCount,
                waitTime: totalWaitTime
            };
        }));

        // Filter out salons without valid distance if maxDistance is specified
        if (maxDistance && maxDistance !== 'all') {
            const max = parseFloat(maxDistance);
            processedSalons = processedSalons.filter(salon => salon.distance !== null && salon.distance <= max);
        }

        // Price Range Filter
        if (priceRange && priceRange !== 'all') {
            processedSalons = processedSalons.filter(salon => {
                if (priceRange === '$') return salon.avgPrice < 500;
                if (priceRange === '$$') return salon.avgPrice >= 500 && salon.avgPrice <= 1500;
                if (priceRange === '$$$') return salon.avgPrice > 1500;
                return true;
            });
        }

        // Rating Filter
        if (minRating && minRating !== 'all') {
            const min = parseFloat(minRating);
            processedSalons = processedSalons.filter(salon => (salon.rating || 0) >= min);
        }

        // Safe Sorting
        if (sortBy === 'rating') {
            processedSalons.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === 'distance') {
            processedSalons.sort((a, b) => {
                const distA = (a.distance !== null && !isNaN(a.distance)) ? a.distance : 999999;
                const distB = (b.distance !== null && !isNaN(b.distance)) ? b.distance : 999999;
                return distA - distB;
            });
        } else if (sortBy === 'price_low') {
            processedSalons.sort((a, b) => a.avgPrice - b.avgPrice);
        } else if (sortBy === 'price_high') {
            processedSalons.sort((a, b) => b.avgPrice - a.avgPrice);
        } else {
            // Default 'recommended'
            processedSalons.sort((a, b) => {
                const distA = (a.distance !== null && !isNaN(a.distance)) ? a.distance : 10;
                const distB = (b.distance !== null && !isNaN(b.distance)) ? b.distance : 10;
                const scoreA = distA - ((a.rating || 0) * 2);
                const scoreB = distB - ((b.rating || 0) * 2);
                return scoreA - scoreB;
            });
        }
        res.status(200).json(processedSalons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.bookService = async (req, res) => {
    try {
        let { userId, salonId, services, staffId } = req.body;

        // Resolve User ID if it's a Firebase UID
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            let user = await User.findOne({ firebaseUid: userId });

            // Handle Guest User Fallback
            if (!user && userId === 'GUEST_USER') {
                user = await User.findOne({ email: 'guest@smartsalon.com' });
                if (!user) {
                    user = new User({
                        name: 'Guest User',
                        email: 'guest@smartsalon.com',
                        role: 'user',
                        firebaseUid: 'guest_user_static_uid',
                        phone: '0000000000',
                        isPaymentActive: true,
                        salonSetupCompleted: true
                    });
                    await user.save();
                }
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            userId = user._id;
        }

        const salon = await Salon.findById(salonId);
        if (!salon) throw new Error("Salon not found");

        if (salon.isBookingPaused) {
            return res.status(400).json({ error: 'Salon is currently not accepting bookings' });
        }

        // --- NEW: Prevent Booking if Salon is Closed ---
        if (salon.status === 'closed') {
            return res.status(400).json({ error: 'Salon is currently Closed. Please try again when we open.' });
        }

        // --- NEW: Check Operating Hours ---
        if (salon.timings) {
            const now = new Date();
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = days[now.getDay()];

            // 1. Check Day (If days array exists and is not empty, strict check)
            if (salon.timings.days && salon.timings.days.length > 0) {
                // Ensure case-insensitive match just in case
                const isOpenToday = salon.timings.days.some(d => d.toLowerCase() === currentDay.toLowerCase());
                if (!isOpenToday) {
                    return res.status(400).json({ error: `Salon is closed on ${currentDay}s.` });
                }
            }

            // 2. Check Time (Simple HH:MM string comparison) — Use IST (UTC+5:30)
            const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
            const istNow = new Date(now.getTime() + istOffset);
            const currentTimeStr = istNow.toISOString().slice(11, 16); // "HH:MM" in IST
            const { open, close } = salon.timings;

            if (open && close) {
                if (currentTimeStr < open || currentTimeStr > close) {
                    return res.status(400).json({
                        error: `Salon is closed. Operating hours are ${open} to ${close}.`
                    });
                }
            }
        }
        // -----------------------------------------------

        // --- MONTHLY BOOKING LIMIT CHECK ---
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthlyBookingCount = await Booking.countDocuments({
            userId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $nin: ['cancelled', 'rejected'] } // Don't count cancelled/rejected
        });

        if (monthlyBookingCount >= MONTHLY_BOOKING_LIMIT) {
            return res.status(400).json({
                error: `Monthly booking limit reached! You can only book ${MONTHLY_BOOKING_LIMIT} times per month. Your limit resets on ${new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
            });
        }
        // -----------------------------------------------

        // FIX: Queue position-based token number
        // Count current active bookings (pending, accepted, arrived, in_service) for this salon
        const activeCount = await Booking.countDocuments({
            salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });
        const newToken = activeCount + 1;

        // Calculate total amount and duration
        let totalAmount = 0;
        let totalDuration = 0;
        services.forEach(s => {
            totalAmount += s.price;
            totalDuration += (s.duration || 30);
        });

        const newBooking = new Booking({
            userId,
            salonId,
            staffId: staffId || null, // Optional
            services,
            tokenNumber: newToken,
            status: 'pending',
            totalAmount,
            estimatedDuration: totalDuration
        });

        await newBooking.save();

        // Update Salon Queue
        salon.lastTokenNumber = newToken;
        salon.liveQueueCount = (salon.liveQueueCount || 0) + 1;

        // Update Staff Queue if selected
        if (staffId) {
            const staffIndex = salon.staff.findIndex(s => s._id.toString() === staffId);
            if (staffIndex !== -1) {
                salon.staff[staffIndex].liveQueueCount = (salon.staff[staffIndex].liveQueueCount || 0) + 1;
            }
        }

        await salon.save();

        // Real-time Update via Socket.io
        try {
            const io = getIo();

            // Calculate total wait time from all active bookings
            const activeBookings = await Booking.find({
                salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const totalWaitTime = activeBookings.reduce((total, booking) => {
                const bookingDuration = booking.services.reduce((sum, service) => sum + (service.duration || 30), 0);
                return total + bookingDuration;
            }, 0);

            // Emit queue update GLOBALLY so Home Screen lists update
            io.emit('queueUpdate', {
                salonId,
                liveQueueCount: salon.liveQueueCount,
                waitTime: totalWaitTime,
                action: 'new_booking'
            });

            // Emit New Booking Request for Notification (Socket)
            const user = await User.findById(userId);
            io.to(salonId).emit('newBooking', {
                bookingId: newBooking._id,
                userId: {
                    name: user ? user.name : 'Guest',
                    profilePhoto: user ? user.profilePhoto : null,
                    phone: user ? user.phone : null
                },
                services: services.map(s => { return { name: s.name } }), // Array of objects
                // services: services.map(s => s.name).join(', '), // Old flat string - Frontend expects array or check
                totalAmount,
                tokenNumber: newToken,
                staffId
            });

            // Emit Firebase Notification to Salon Owner
            const owner = await User.findById(salon.ownerId);
            if (owner && owner.fcmToken) {
                await sendNotification(
                    owner.fcmToken,
                    'New Booking Request! 📅',
                    `${user ? user.name : 'A customer'} wants to book ${services.length} services.`
                );
            } else {
            }
        } catch (e) {
        }

        // Auto-Accept Logic (60 Seconds Rule)
        const autoAcceptTime = 60; // Hardcoded 60s as per requirement
        const expiresAt = new Date(Date.now() + autoAcceptTime * 1000);
        newBooking.expiresAt = expiresAt;
        await newBooking.save(); // Save expiry time

        setTimeout(async () => {
            try {
                const booking = await Booking.findById(newBooking._id);
                // If still pending after 60s, Auto-Confirm
                if (booking && booking.status === 'pending') {
                    booking.status = 'accepted';
                    booking.serviceStartTime = new Date();
                    // Token already assigned at booking creation, no need to reassign
                    await booking.save();
                    // Emit update GLOBALLY so user's app receives it
                    const io = getIo();
                    io.emit('bookingStatus', {
                        bookingId: booking._id.toString(),
                        status: 'accepted',
                        autoConfirmed: true,
                        tokenNumber: booking.tokenNumber,
                        salonId: salonId.toString()
                    });
                    io.emit('queueUpdate', { salonId: salonId.toString(), action: 'auto_confirm' });

                    // Notify User
                    const user = await User.findById(booking.userId);
                    if (user && user.fcmToken) {
                        await sendNotification(user.fcmToken, 'Booking Auto-Confirmed! ✅', `Salon didn't reply, so we confirmed you! Token #${booking.tokenNumber}`);
                    } else {
                    }

                    // Notify Owner (That they missed it)
                    const owner = await User.findById(salon.ownerId);
                    if (owner && owner.fcmToken) {
                        await sendNotification(owner.fcmToken, 'Auto-Accepted Booking ⚠️', `You missed the request. System auto-accepted it.`);
                    }
                }
            } catch (err) { /* silent */ }
        }, autoAcceptTime * 1000);

        res.status(200).json({ message: 'Booking request sent', bookingId: newBooking._id, tokenNumber: newToken });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.respondToBooking = async (req, res) => {
    try {
        const { bookingId, action } = req.body; // action: 'accept' or 'reject'

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status !== 'pending') return res.status(400).json({ error: 'Booking already processed' });

        if (action === 'accept') {
            booking.status = 'accepted';
        } else if (action === 'reject') {
            booking.status = 'rejected';
            // Self-Healing
            const realQueueCount = await Booking.countDocuments({
                salonId: booking.salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const salon = await Salon.findById(booking.salonId);
            if (salon) {
                salon.liveQueueCount = realQueueCount;
                await salon.save();
            }
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        await booking.save();

        // Get updated queue count for socket emission
        const currentQueueCount = await Booking.countDocuments({
            salonId: booking.salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });

        // Emit updates via socket
        try {
            const io = getIo();
            const salonIdStr = booking.salonId.toString();

            const activeForWait = await Booking.find({
                salonId: booking.salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const totalWaitTime = activeForWait.reduce((total, b) => {
                const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 30), 0);
                return total + bDuration;
            }, 0);

            io.to(salonIdStr).emit('bookingStatus', {
                bookingId: booking._id.toString(),
                status: booking.status,
                tokenNumber: booking.tokenNumber,
                salonId: salonIdStr
            });

            io.to(salonIdStr).emit('queueUpdate', {
                salonId: salonIdStr,
                action: `booking_${action}ed`,
                bookingId: String(booking._id),
                waitTime: totalWaitTime
            });
            io.emit('queueUpdate', {
                salonId: salonIdStr,
                action: `booking_${action}ed`,
                bookingId: String(booking._id),
                waitTime: totalWaitTime
            });
        } catch (socketErr) {
            console.error('Respond booking socket error:', socketErr);
        }

        // Notify User
        const user = await User.findById(booking.userId);
        if (user && user.fcmToken) {
            const title = action === 'accept' ? 'Booking Accepted! 🎉' : 'Booking Declined ❌';
            const body = action === 'accept'
                ? `Your token number is ${booking.tokenNumber}.`
                : 'Sorry, the salon cannot accept your booking right now.';
            await sendNotification(user.fcmToken, title, body);
        }

        res.status(200).json({ message: `Booking ${action}ed`, booking });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateQueue = async (req, res) => {
    try {
        const { salonId, action, bookingId, reason } = req.body; // action: 'complete', 'cancel', 'pause', 'resume'

        const salon = await Salon.findById(salonId);
        if (!salon) throw new Error("Salon not found");

        if (action === 'pause') {
            salon.isBookingPaused = true;
            await salon.save();
            return res.status(200).json({ message: 'Booking Paused', isBookingPaused: true });
        }

        if (action === 'resume') {
            salon.isBookingPaused = false;
            await salon.save();
            return res.status(200).json({ message: 'Booking Resumed', isBookingPaused: false });
        }

        // --- Cancel Active Booking Logic ---
        if (action === 'cancel') {
            let targetBooking = null;
            if (bookingId) {
                targetBooking = await Booking.findById(bookingId);
            } else {
                // Fallback to oldest active booking
                targetBooking = await Booking.findOne({
                    salonId,
                    status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
                }).sort({ tokenNumber: 1 });
            }

            if (targetBooking) {
                targetBooking.status = 'cancelled';
                targetBooking.cancellationReason = reason || 'Cancelled by salon owner';
                targetBooking.cancelledBy = 'salon';
                await targetBooking.save();

                // Update Staff Queue if assigned
                if (targetBooking.staffId) {
                    const staffIndex = salon.staff.findIndex(s => s._id.toString() === targetBooking.staffId.toString());
                    if (staffIndex !== -1 && salon.staff[staffIndex].liveQueueCount > 0) {
                        salon.staff[staffIndex].liveQueueCount -= 1;
                    }
                }

                if (salon.liveQueueCount > 0) {
                    salon.liveQueueCount -= 1;
                }

                // Notify User
                const user = await User.findById(targetBooking.userId);
                if (user && user.fcmToken) {
                    await sendNotification(
                        user.fcmToken,
                        'Booking Cancelled ❌',
                        `Salon cancelled your booking. Reason: ${reason || 'Unspecified'}`
                    );
                }
            }
        }
        // ----------------------------------------

        if (action === 'complete') {
            let targetBooking = null;
            if (bookingId) {
                targetBooking = await Booking.findById(bookingId);
            } else {
                // Fallback to oldest ACCEPTED booking
                targetBooking = await Booking.findOne({
                    salonId,
                    status: { $in: ['accepted', 'arrived', 'in_service'] }
                }).sort({ tokenNumber: 1 });
            }

            if (targetBooking) {
                // Only enforce 10-min rule if bookingId was NOT explicitly passed by owner
                if (!bookingId) {
                    const startTime = new Date(targetBooking.serviceStartTime || targetBooking.updatedAt);
                    const now = new Date();
                    const diffMinutes = (now - startTime) / 1000 / 60;

                    if (diffMinutes < 10) {
                        return res.status(400).json({ error: `Cannot complete yet. Minimum 10 mins required. (${Math.round(10 - diffMinutes)} mins left)` });
                    }
                }

                targetBooking.status = 'completed';
                await targetBooking.save();

                // Send Review Request Notification to User
                const completedUser = await User.findById(targetBooking.userId);
                if (completedUser && completedUser.fcmToken) {
                    await sendNotification(
                        completedUser.fcmToken,
                        "⭐ Rate Your Experience!",
                        `Hope you liked the service at ${salon.name}! Please take a moment to rate us. 🙏`
                    );
                }

                // Update Staff Queue if assigned
                if (targetBooking.staffId) {
                    const staffIndex = salon.staff.findIndex(s => s._id.toString() === targetBooking.staffId.toString());
                    if (staffIndex !== -1 && salon.staff[staffIndex].liveQueueCount > 0) {
                        salon.staff[staffIndex].liveQueueCount -= 1;
                    }
                }
            }

            if (salon.liveQueueCount > 0) {
                salon.liveQueueCount -= 1;
            }
        }
        await salon.save();

        // QUEUE ALERTS & LIVE STATUS
        const nextBookings = await Booking.find({
            salonId,
            status: { $in: ['accepted', 'arrived', 'in_service'] }
        }).sort({ tokenNumber: 1 }).limit(5);

        // 1. Live Status Update (Who is currently being served?)
        let currentServing = null;
        if (nextBookings.length > 0) {
            const currentUser = await User.findById(nextBookings[0].userId);
            currentServing = {
                name: currentUser ? currentUser.name : (nextBookings[0].walkInName || 'Guest'),
                services: nextBookings[0].services.map(s => s.name).join(', '),
                tokenNumber: nextBookings[0].tokenNumber,
                staffId: nextBookings[0].staffId
            };
        }

        // Notify Position 1 (Current Turn)
        if (nextBookings.length >= 1) {
            const firstBooking = nextBookings[0];
            if (firstBooking.userId) {
                const firstUser = await User.findById(firstBooking.userId);
                if (firstUser && firstUser.fcmToken) {
                    await sendNotification(
                        firstUser.fcmToken,
                        "🎉 It's Your Turn!",
                        `You are being served at ${salon.name}. Please be ready!`
                    );
                }
            }
        }

        // Notify Position 2 (Get Ready)
        if (nextBookings.length >= 2) {
            const secondBooking = nextBookings[1];
            if (secondBooking.userId) {
                const secondUser = await User.findById(secondBooking.userId);
                if (secondUser && secondUser.fcmToken) {
                    await sendNotification(
                        secondUser.fcmToken,
                        "Get Ready! 🏃",
                        "Your number is 2! Please head to the salon."
                    );
                }
            }
        }

        // Real-time Socket Update (Room + Global)
        try {
            const { getIo } = require('../socket');
            const io = getIo();
            const salonIdStr = String(salonId);

            const remainingBookings = await Booking.find({
                salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const updatedWaitTime = remainingBookings.reduce((total, b) => {
                const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 30), 0);
                return total + bDuration;
            }, 0);

            const payload = {
                salonId: salonIdStr,
                liveQueueCount: salon.liveQueueCount,
                waitTime: updatedWaitTime,
                action: 'queue_reduced',
                currentServing
            };

            io.to(salonIdStr).emit('queueUpdate', payload);
            io.emit('queueUpdate', payload);
        } catch (e) { }

        res.status(200).json({ message: 'Queue updated', liveQueueCount: salon.liveQueueCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { salonId, status } = req.body;
        if (!salonId || !status) {
            return res.status(400).json({ error: 'salonId and status are required' });
        }

        // PREVENT CLOSE if active bookings/walk-ins exist in queue
        if (status === 'closed') {
            const activeCount = await Booking.countDocuments({
                salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            if (activeCount > 0) {
                return res.status(400).json({
                    error: `Cannot close shop. You have ${activeCount} active customer(s) in queue. Complete or cancel all bookings first.`,
                    activeCount
                });
            }
        }

        const salon = await Salon.findByIdAndUpdate(salonId, { status }, { new: true });

        // SOCKET EMISSION: Broadcast shop status change to all connected clients
        try {
            const io = getIo();
            io.emit('shopStatusUpdate', {
                salonId,
                status,
                message: `Salon is now ${status}`
            });
            // Also emit queueUpdate so Live Mode refreshes
            io.to(salonId).emit('queueUpdate', {
                salonId,
                action: 'status_change',
                newStatus: status
            });
        } catch (socketError) {
        }

        // NEW: Send Push Notifications to Users with Active Bookings
        try {
            const pendingBookings = await Booking.find({
                salonId,
                status: { $in: ['pending', 'accepted'] }
            });

            for (const booking of pendingBookings) {
                const user = await User.findById(booking.userId);
                if (user && user.fcmToken) {
                    const title = status === 'open'
                        ? `✨ ${salon.name} is now Open!`
                        : `🌙 ${salon.name} is now Closed`;
                    const body = status === 'open'
                        ? 'Your booking is active. Visit us now!'
                        : 'The salon has closed. Your booking will be honored when we reopen.';
                    await sendNotification(user.fcmToken, title, body);
                }
            }
        } catch (notifyError) {
        }

        res.status(200).json({ message: `Salon is now ${status}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============ TAKE A BREAK FEATURE ============
exports.toggleBreak = async (req, res) => {
    try {
        const { salonId, action, duration } = req.body; // action: 'start' or 'end', duration in minutes

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        if (action === 'start') {
            if (!duration || duration < 1) return res.status(400).json({ error: 'Duration is required' });

            const breakEndTime = new Date(Date.now() + duration * 60 * 1000);
            salon.breakInfo = {
                isOnBreak: true,
                breakEndTime,
                breakDuration: duration
            };
            await salon.save();

            // Socket: Notify all clients about break
            try {
                const io = getIo();
                io.emit('shopStatusUpdate', {
                    salonId,
                    status: salon.status, // Keep original status (open)
                    isOnBreak: true,
                    breakEndTime: breakEndTime.toISOString(),
                    breakDuration: duration,
                    message: `Salon is on a ${duration} min break`
                });
            } catch (e) { /* silent */ }

            res.status(200).json({ message: `Break started for ${duration} minutes`, breakEndTime });

        } else if (action === 'end') {
            salon.breakInfo = {
                isOnBreak: false,
                breakEndTime: null,
                breakDuration: 0
            };
            await salon.save();

            // Socket: Notify all clients break ended
            try {
                const io = getIo();
                io.emit('shopStatusUpdate', {
                    salonId,
                    status: salon.status,
                    isOnBreak: false,
                    breakEndTime: null,
                    breakDuration: 0,
                    message: 'Break ended, salon is back!'
                });
            } catch (e) { /* silent */ }

            res.status(200).json({ message: 'Break ended' });
        } else {
            return res.status(400).json({ error: 'Invalid action. Use "start" or "end".' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getEarnings = async (req, res) => {
    try {
        const { salonId } = req.query;
        // Simple all-time aggregation for Dashboard
        const bookings = await Booking.find({ salonId, status: 'completed' });
        let totalEarnings = 0;
        bookings.forEach(b => totalEarnings += b.totalAmount);
        res.status(200).json({
            salonId,
            totalEarnings,
            bookingCount: bookings.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const { salonId, period } = req.query; // period: 'Weekly', 'Monthly', 'Yearly'
        const now = new Date();
        let startDate, previousStartDate, previousEndDate;

        // 1. Determine Date Ranges
        if (period === 'Weekly') {
            startDate = new Date(now.setDate(now.getDate() - 7));
            previousStartDate = new Date(now.setDate(now.getDate() - 7)); // 14 days ago // BUG: this modifies 'now' again, but let's keep it clean
            previousEndDate = new Date(startDate);
        } else if (period === 'Monthly') {
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            previousStartDate = new Date(now.setMonth(now.getMonth() - 1));
            previousEndDate = new Date(startDate);
        } else if (period === 'Yearly') {
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            previousStartDate = new Date(now.setFullYear(now.getFullYear() - 1));
            previousEndDate = new Date(startDate);
        } else {
            startDate = new Date(now.setDate(now.getDate() - 7));
            previousStartDate = new Date(now.setDate(now.getDate() - 7));
            previousEndDate = new Date(startDate);
        }

        // Fetch Salon to get profileViews
        const salon = await Salon.findById(salonId).select('profileViews');

        // Fetch All Bookings (Completed) for Lifetime and Period stats
        const allCompletedBookings = await Booking.find({ salonId, status: 'completed' }).populate('userId', 'name profilePhoto phone');
        const currentBookings = allCompletedBookings.filter(b => b.createdAt >= startDate);
        const previousBookings = allCompletedBookings.filter(b => b.createdAt >= previousStartDate && b.createdAt < previousEndDate);

        // Fetch Recent Reviews
        const Review = require('../models/Review'); // Ensure we have the model
        const allReviews = await Review.find({ salonId }).populate('userId', 'name profilePhoto').sort({ createdAt: -1 });

        // --- 1. REVENUE STATS ---
        const currentRevenue = currentBookings.reduce((sum, b) => sum + b.totalAmount, 0);
        const previousRevenue = previousBookings.reduce((sum, b) => sum + b.totalAmount, 0);
        let growth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : (currentRevenue > 0 ? 100 : 0);

        // Daily Avg & Best Day
        const dailyRevenues = {};
        allCompletedBookings.forEach(b => {
            const dateStr = new Date(b.createdAt).toDateString();
            dailyRevenues[dateStr] = (dailyRevenues[dateStr] || 0) + b.totalAmount;
        });
        const revenueArray = Object.values(dailyRevenues);
        const bestDayRevenue = revenueArray.length > 0 ? Math.max(...revenueArray) : 0;

        // This month vs last month
        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const thisMonthRev = allCompletedBookings.filter(b => b.createdAt >= thisMonthStart).reduce((sum, b) => sum + b.totalAmount, 0);
        const lastMonthRev = allCompletedBookings.filter(b => b.createdAt >= lastMonthStart && b.createdAt < thisMonthStart).reduce((sum, b) => sum + b.totalAmount, 0);

        // --- 2. CUSTOMER INSIGHTS ---
        const uniqueCustomers = new Set();
        const returningCustomers = new Set();
        const customerVisits = {}; // { userId: [dates] }

        allCompletedBookings.forEach(b => {
            const uId = b.userId ? b.userId._id.toString() : (b.walkInName || 'Walk-In');
            uniqueCustomers.add(uId);

            if (!customerVisits[uId]) customerVisits[uId] = [];
            customerVisits[uId].push(b.createdAt);

            if (customerVisits[uId].length > 1) {
                returningCustomers.add(uId);
            }
        });

        // --- 3. LOST CUSTOMERS --- (Inactive > 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let lostCustomers = [];
        Object.keys(customerVisits).forEach(uId => {
            const visits = customerVisits[uId].sort((a, b) => b - a);
            const lastVisit = visits[0];

            if (lastVisit < thirtyDaysAgo) {
                // Find user info
                const booking = allCompletedBookings.find(b => (b.userId && b.userId._id.toString() === uId) || b.walkInName === uId);
                // Calculate total spent
                const totalSpent = allCompletedBookings.filter(b => (b.userId && b.userId._id.toString() === uId) || b.walkInName === uId)
                    .reduce((sum, b) => sum + b.totalAmount, 0);

                lostCustomers.push({
                    id: uId,
                    name: booking.userId ? booking.userId.name : booking.walkInName,
                    photo: booking.userId ? booking.userId.profilePhoto : null,
                    phone: booking.userId ? booking.userId.phone : null,
                    lastVisit: lastVisit,
                    totalSpent: totalSpent
                });
            }
        });
        // Sort by total spent (highest first) to prioritize big spenders
        lostCustomers.sort((a, b) => b.totalSpent - a.totalSpent);

        // --- 4. PEAK HOURS ---
        const hourCounts = Array(24).fill(0);
        currentBookings.forEach(b => {
            // Use serviceStartTime if available, otherwise createdAt
            const time = b.serviceStartTime ? new Date(b.serviceStartTime) : new Date(b.createdAt);
            hourCounts[time.getHours()] += 1;
        });

        // Find busiest hour
        const maxBookings = Math.max(...hourCounts);
        const busiestHourIdx = hourCounts.indexOf(maxBookings);
        const formatHour = (h) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

        // --- 5. BOOKING SOURCE ---
        const sources = { walkIn: 0, queue: 0, appointment: 0 };
        currentBookings.forEach(b => {
            if (b.isWalkIn) sources.walkIn++;
            else if (b.bookingType === 'appointment') sources.appointment++;
            else sources.queue++;
        });

        // --- 6. TOP SERVICES ---
        const serviceStats = {};
        allCompletedBookings.forEach(b => {
            b.services.forEach(s => {
                const name = s.name;
                if (!serviceStats[name]) serviceStats[name] = { name, count: 0, revenue: 0 };
                serviceStats[name].count += 1;
                serviceStats[name].revenue += s.price;
            });
        });

        const sortedServices = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue);
        const topServices = sortedServices.slice(0, 5);
        const slowServices = sortedServices.slice().reverse().slice(0, 3); // Bottom 3

        // --- 7. REVENUE TREND (CHART) ---
        const trendData = {};
        currentBookings.forEach(b => {
            const date = new Date(b.createdAt);
            let key = period === 'Yearly' ? date.toLocaleString('default', { month: 'short' }) : date.toLocaleString('default', { weekday: 'short' });
            trendData[key] = (trendData[key] || 0) + b.totalAmount;
        });

        let chartData = [];
        if (period === 'Weekly' || period === 'Monthly') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            chartData = days.map(day => ({ label: day[0], value: trendData[day] || 0 }));
        } else {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            chartData = months.map(m => ({ label: m[0], value: trendData[m] || 0 }));
        }

        // --- 8. RATING SUMMARY ---
        const totalReviews = allReviews.length;
        const avgRating = totalReviews > 0 ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1) : parseFloat(salon.rating || 4.8).toFixed(1);
        const recentReviews = allReviews.slice(0, 5).map(r => ({
            id: r._id,
            rating: r.rating,
            comment: r.comment,
            userName: r.userId ? r.userId.name : 'Unknown',
            date: r.createdAt
        }));

        // Build Final Response
        res.status(200).json({
            heroStats: {
                revenue: currentRevenue,
                bookings: currentBookings.length,
                growth: growth.toFixed(1) + '%',
                profileViews: salon.profileViews || 0
            },
            revenueStats: {
                dailyAvg: revenueArray.length > 0 ? (allCompletedBookings.reduce((sum, b) => sum + b.totalAmount, 0) / revenueArray.length).toFixed(0) : 0,
                bestDay: bestDayRevenue,
                thisMonth: thisMonthRev,
                lastMonth: lastMonthRev
            },
            customerInsights: {
                totalUnique: uniqueCustomers.size,
                returning: returningCustomers.size,
                newCustomers: uniqueCustomers.size - returningCustomers.size
            },
            lostCustomers: lostCustomers.slice(0, 10), // Top 10 lost big spenders
            peakHours: {
                busiestHour: maxBookings > 0 ? `${formatHour(busiestHourIdx)} - ${formatHour(busiestHourIdx + 1)}` : 'N/A',
                chart: hourCounts // Array of 24 ints
            },
            bookingSource: sources,
            servicesSummary: {
                top: topServices,
                slow: slowServices
            },
            ratingSummary: {
                average: avgRating,
                total: totalReviews,
                recent: recentReviews
            },
            chartData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addReview = async (req, res) => {
    try {
        const { salonId, userId, rating, comment } = req.body;

        // HARDENING: Validate rating is 1-5
        if (!isValidRating(rating)) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Check if user reviewed within last 3 months (90 days)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const existingReview = await Review.findOne({
            salonId,
            userId,
            createdAt: { $gte: threeMonthsAgo }
        });

        if (existingReview) {
            const nextReviewDate = new Date(existingReview.createdAt);
            nextReviewDate.setMonth(nextReviewDate.getMonth() + 3);
            return res.status(400).json({
                error: 'Aap 3 mahine mein ek hi baar review de sakte hain',
                nextReviewDate: nextReviewDate.toISOString()
            });
        }

        const review = new Review({ salonId, userId, rating: Number(rating), comment });
        await review.save();

        // Recalculate Salon's average rating using Atomic MongoDB Aggregation
        const mongoose = require('mongoose');
        const reviewStats = await Review.aggregate([
            { $match: { salonId: new mongoose.Types.ObjectId(salonId) } },
            { $group: { _id: '$salonId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const averageRating = reviewStats.length > 0 ? Math.round(reviewStats[0].avgRating * 10) / 10 : Number(rating);
        const reviewCount = reviewStats.length > 0 ? reviewStats[0].count : 1;

        await Salon.findByIdAndUpdate(salonId, {
            rating: averageRating,
            reviewCount: reviewCount
        });

        // Send New Review Notification to Salon Owner
        const salon = await Salon.findById(salonId);
        if (salon && salon.ownerId) {
            const owner = await User.findById(salon.ownerId);
            const reviewer = await User.findById(userId);
            if (owner && owner.fcmToken) {
                const { sendNotification } = require('../services/notificationService');
                await sendNotification(
                    owner.fcmToken,
                    `⭐ New ${rating}★ Review!`,
                    `${reviewer?.name || 'A customer'}: "${comment?.substring(0, 50) || 'No comment'}"`
                );
            }
        }

        // Mark the latest unreviewed completed booking for this user and salon as reviewed
        const Booking = require('../models/Booking');
        await Booking.findOneAndUpdate(
            { userId, salonId, status: 'completed', isReviewed: false },
            { isReviewed: true },
            { sort: { createdAt: -1 } }
        );

        res.status(201).json({ message: 'Review added successfully', averageRating, reviewCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all reviews for a salon
exports.getReviews = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { filterRating } = req.query; // Optional filter by star rating

        let query = { salonId };
        if (filterRating && filterRating !== 'all') {
            query.rating = Number(filterRating);
        }

        const reviews = await Review.find(query)
            .populate('userId', 'name profilePhoto')
            .sort({ createdAt: -1 });

        // Calculate rating distribution and average using Aggregation
        const mongoose = require('mongoose');
        const reviewStats = await Review.aggregate([
            { $match: { salonId: new mongoose.Types.ObjectId(salonId) } },
            { $group: { _id: '$salonId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const allReviews = await Review.find({ salonId });
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        allReviews.forEach(r => {
            distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        });

        const averageRating = reviewStats.length > 0 ? Math.round(reviewStats[0].avgRating * 10) / 10 : 0;
        const totalReviews = reviewStats.length > 0 ? reviewStats[0].count : 0;

        res.status(200).json({
            reviews,
            averageRating, // Top-level for easy consumption
            stats: {
                averageRating,
                totalReviews,
                distribution
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Like / Unlike a review (toggle)
exports.likeReview = async (req, res) => {
    try {
        const { reviewId, userId } = req.body;
        if (!reviewId || !userId) return res.status(400).json({ error: 'reviewId and userId required' });

        // Resolve the actual MongoDB ObjectId for the user
        // userId could be a Firebase UID (string) or MongoDB ObjectId
        let mongoUserId = userId;
        const mongoose = require('mongoose');

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            // It's a Firebase UID — look up the User document
            const userDoc = await User.findOne({ firebaseUid: userId });
            if (!userDoc) return res.status(404).json({ error: 'User not found' });
            mongoUserId = userDoc._id;
        }

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        const alreadyLiked = review.likes.some(id => id.toString() === mongoUserId.toString());

        if (alreadyLiked) {
            // Unlike
            await Review.findByIdAndUpdate(reviewId, { $pull: { likes: mongoUserId } });
        } else {
            // Like
            await Review.findByIdAndUpdate(reviewId, { $addToSet: { likes: mongoUserId } });
        }

        const updated = await Review.findById(reviewId);
        res.json({ liked: !alreadyLiked, likesCount: updated.likes.length, likes: updated.likes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Check if user can review (3-month cooldown check)
// Check for any completed but unreviewed booking for the user
exports.getPendingReview = async (req, res) => {
    try {
        const { userId } = req.query; // Authenticated user ID

        const Booking = require('../models/Booking');
        const pendingBooking = await Booking.findOne({
            userId,
            status: 'completed',
            isReviewed: false
        })
            .sort({ createdAt: -1 })
            .populate('salonId', 'name images rating');

        if (!pendingBooking) {
            return res.json({ hasPending: false });
        }

        res.json({
            hasPending: true,
            bookingId: pendingBooking._id,
            salonId: pendingBooking.salonId?._id,
            salonName: pendingBooking.salonId?.name,
            salonImage: pendingBooking.salonId?.images?.[0]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.canReview = async (req, res) => {
    try {
        const { salonId, userId } = req.query;

        if (!salonId || !userId) {
            return res.status(400).json({ error: 'salonId and userId are required' });
        }

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const existingReview = await Review.findOne({
            salonId,
            userId,
            createdAt: { $gte: threeMonthsAgo }
        });

        if (existingReview) {
            const nextReviewDate = new Date(existingReview.createdAt);
            nextReviewDate.setMonth(nextReviewDate.getMonth() + 3);
            return res.json({
                canReview: false,
                nextReviewDate: nextReviewDate.toISOString(),
                message: 'Aap 3 mahine baad review de sakte hain'
            });
        }

        res.json({ canReview: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserBookings = async (req, res) => {
    try {
        let { userId } = req.params;
        // Resolve User ID if it's a Firebase UID
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(userId);
        if (!isObjectId) {
            const user = await User.findOne({ firebaseUid: userId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            userId = user._id;
        }

        const bookings = await Booking.find({ userId })
            .populate('salonId', 'name address images')
            .sort({ createdAt: -1 });
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const aiService = require('../services/aiService');

exports.getSalonQueue = async (req, res) => {
    try {
        const { salonId } = req.params;
        const bookings = await Booking.find({
            salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        })
            .populate('userId', 'name profilePhoto phone')
            .sort({ tokenNumber: 1 });

        // Calculate AI Wait Time
        const totalWaitTime = await aiService.calculateWaitTime(bookings, salonId);

        res.status(200).json({
            queue: bookings,
            totalWaitTime, // Total time if you join now
            peopleWaiting: bookings.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/salons/:id/visitors — Get Instagram Story style visitors list for today
exports.getTodayVisitors = async (req, res) => {
    try {
        const { id: salonId } = req.params;
        const SalonView = require('../models/SalonView');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const views = await SalonView.find({
            salonId,
            viewedAt: { $gte: twentyFourHoursAgo }
        })
            .populate('userId', 'name profilePhoto email phone')
            .sort({ viewedAt: -1 });

        const uniqueVisitors = [];
        const seenUserIds = new Set();

        for (const view of views) {
            if (!view.userId) continue;
            const uId = view.userId._id ? view.userId._id.toString() : view.userId.toString();
            if (!seenUserIds.has(uId)) {
                seenUserIds.add(uId);
                uniqueVisitors.push({
                    _id: view._id,
                    user: view.userId,
                    viewedAt: view.viewedAt
                });
            }
        }

        res.status(200).json({
            totalVisitorsToday: uniqueVisitors.length,
            visitors: uniqueVisitors
        });
    } catch (error) {
        console.error('getTodayVisitors error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getSalonHistory = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { period } = req.query; // 'Daily', 'Weekly', 'Monthly'

        let startDate = new Date();
        const now = new Date();

        if (period === 'Daily') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'Weekly') {
            startDate.setDate(now.getDate() - 7);
        } else if (period === 'Monthly') {
            startDate.setMonth(now.getMonth() - 1);
        } else {
            // Default to all history if no period provided, or just use a very old date
            startDate = new Date(0);
        }

        const bookings = await Booking.find({
            salonId,
            status: 'completed',
            updatedAt: { $gte: startDate }
        })
            .populate('userId', 'name profilePhoto phone')
            .sort({ updatedAt: -1 });

        // Fallback for older bookings that might not have updatedAt yet (pre-timestamp update)
        if (bookings.length === 0 && period !== 'Daily') {
            const fallbackBookings = await Booking.find({
                salonId,
                status: 'completed',
                createdAt: { $gte: startDate }
            })
                .populate('userId', 'name profilePhoto phone')
                .sort({ createdAt: -1 });
            return res.status(200).json(fallbackBookings);
        }

        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addService = async (req, res) => {
    try {
        const { salonId, service } = req.body;

        // HARDENING: Validate service structure
        if (!isValidService(service)) {
            return res.status(400).json({ error: 'Invalid service. Must have name (string) and price (number >= 0)' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // DUPLICATE GUARD: If service with same name already exists, update it instead of adding duplicate
        const existingIndex = salon.services.findIndex(
            s => s.name.trim().toLowerCase() === service.name.trim().toLowerCase()
        );

        if (existingIndex !== -1) {
            salon.services[existingIndex] = { ...salon.services[existingIndex].toObject(), ...service };
        } else {
            salon.services.push(service);
        }

        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { salonId, serviceName } = req.params;
        const { name, price, duration, category, photos } = req.body;

        // HARDENING: Validate price if provided
        if (price !== undefined && !isValidPrice(price)) {
            return res.status(400).json({ error: 'Invalid price. Must be a number >= 0' });
        }

        // HARDENING: Validate duration if provided
        if (duration !== undefined && !isValidDuration(duration)) {
            return res.status(400).json({ error: 'Invalid duration. Must be 1-600 minutes' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        const serviceIndex = salon.services.findIndex(s => s.name === serviceName);
        if (serviceIndex === -1) return res.status(404).json({ error: 'Service not found' });

        // Delete old service photos from Cloudinary if photos array is being updated
        if (photos !== undefined && Array.isArray(photos)) {
            const oldPhotos = salon.services[serviceIndex].photos || [];
            const removedPhotos = oldPhotos.filter(oldImg => !photos.includes(oldImg));
            for (const imgUrl of removedPhotos) {
                try {
                    await deleteImage(imgUrl);
                } catch (deleteErr) {
                }
            }
        }

        // Update fields (use !== undefined to allow 0 values)
        if (name !== undefined) salon.services[serviceIndex].name = name;
        if (price !== undefined) salon.services[serviceIndex].price = price;
        if (duration !== undefined) salon.services[serviceIndex].duration = duration;
        if (category !== undefined) salon.services[serviceIndex].category = category;
        if (photos !== undefined) salon.services[serviceIndex].photos = photos;

        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { salonId, serviceName } = req.params;
        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Delete service photos from Cloudinary before removing the service
        const serviceToDelete = salon.services.find(s => s.name === serviceName);
        if (serviceToDelete && serviceToDelete.photos && Array.isArray(serviceToDelete.photos)) {
            for (const imgUrl of serviceToDelete.photos) {
                try {
                    await deleteImage(imgUrl);
                } catch (deleteErr) {
                }
            }
        }

        salon.services = salon.services.filter(s => s.name !== serviceName);
        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCustomerStatus = async (req, res) => {
    try {
        const { bookingId, status } = req.body; // status: 'on_way', 'arrived'

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // Validate status
        const validStatuses = ['on_way', 'arrived', 'delayed', 'prep'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        booking.customerStatus = status;

        await booking.save();

        // Emit to Salon Owner
        const { getIo } = require('../socket');
        const io = getIo();
        io.to(booking.salonId.toString()).emit('customerStatusUpdate', {
            bookingId,
            status,
            customerName: 'Customer'
        });

        res.status(200).json({ message: 'Status updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            { status: 'completed' },
            { new: true }
        );

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // Self-Healing Queue Count: Recalculate to ensure accuracy
        const realQueueCount = await Booking.countDocuments({
            salonId: booking.salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });

        const salon = await Salon.findById(booking.salonId);
        if (salon) {
            salon.liveQueueCount = realQueueCount; // Sync DB with real count

            // Update Staff Queue if assigned
            if (booking.staffId) {
                const staffIndex = salon.staff.findIndex(s => s._id.toString() === booking.staffId.toString());
                if (staffIndex !== -1 && salon.staff[staffIndex].liveQueueCount > 0) {
                    salon.staff[staffIndex].liveQueueCount -= 1; // Keep staff logic simple or refactor similarly later
                }
            }

            await salon.save();
        }

        // Emit update to refresh queue
        const { getIo } = require('../socket');
        const io = getIo();
        // Calculate updated waitTime after completion
        const remainingAfterComplete = await Booking.find({
            salonId: booking.salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });
        const completedWaitTime = remainingAfterComplete.reduce((total, b) => {
            const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 30), 0);
            return total + bDuration;
        }, 0);

        io.emit('queueUpdate', {
            salonId: booking.salonId.toString(), // CRITICAL FIX: Was missing salonId
            type: 'completed',
            bookingId,
            liveQueueCount: realQueueCount,
            waitTime: completedWaitTime
        });

        // 🎰 SCRATCH CARD: Create for non-walk-in bookings
        let scratchCardInfo = null;
        if (booking.userId && !booking.isWalkIn) {
            const { createScratchCard } = require('../controllers/walletController');
            scratchCardInfo = await createScratchCard(booking.userId, booking._id);
        }

        // U3: Send Notification to User (Review + Scratch Card)
        const bookingUser = await User.findById(booking.userId);
        if (bookingUser && bookingUser.fcmToken) {
            const { sendNotification } = require('../services/notificationService');

            // Send scratch card notification first
            if (scratchCardInfo) {
                await sendNotification(
                    bookingUser.fcmToken,
                    "🎉 You won a Scratch Card!",
                    `Your visit to ${salon?.name || 'the salon'} earned you a reward! Scratch to reveal your cashback.`
                );
            }

            // Then review request
            await sendNotification(
                bookingUser.fcmToken,
                "⭐ Rate Your Experience!",
                `How was your visit to ${salon?.name || 'the salon'}? Tap to leave a review.`
            );
        }

        res.status(200).json({ message: 'Booking completed', booking, scratchCard: scratchCardInfo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Add Walk-in Customer to Queue
exports.addWalkIn = async (req, res) => {
    try {
        const { salonId, customerName, services } = req.body;

        if (!salonId || !customerName || !services || services.length === 0) {
            return res.status(400).json({ error: 'salonId, customerName, and services are required' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Calculate total amount and duration
        const totalAmount = services.reduce((sum, s) => sum + (s.price || 0), 0);
        const totalDuration = services.reduce((sum, s) => sum + (s.duration || 30), 0);

        // Generate position-based token number
        const activeCount = await Booking.countDocuments({
            salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });
        const tokenNumber = activeCount + 1;
        salon.lastTokenNumber = tokenNumber; // Keep for backward compat
        salon.liveQueueCount = (salon.liveQueueCount || 0) + 1;
        await salon.save();

        // Create walk-in booking (auto-accepted)
        const walkInBooking = new Booking({
            salonId,
            walkInName: customerName.trim(),
            services: services.map(s => ({
                name: s.name,
                price: s.price,
                duration: s.duration || 30
            })),
            totalAmount,
            status: 'accepted', // Walk-ins are auto-accepted
            isWalkIn: true,
            tokenNumber,
            serviceStartTime: new Date()
        });

        await walkInBooking.save();

        // Emit socket update - Use GLOBAL emit like completeBooking does
        try {
            const io = getIo();
            const roomName = String(salonId);
            // Calculate waitTime with walk-in included
            const walkInActiveBookings = await Booking.find({
                salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const walkInWaitTime = walkInActiveBookings.reduce((total, b) => {
                const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 30), 0);
                return total + bDuration;
            }, 0);

            // Emit globally so all clients update (matches completeBooking pattern)
            io.emit('queueUpdate', {
                salonId: roomName,
                action: 'walk_in_added',
                booking: walkInBooking,
                liveQueueCount: salon.liveQueueCount,
                waitTime: walkInWaitTime
            });

            // Also emit to specific room for clients that joined
            io.to(roomName).emit('newBooking', walkInBooking);
        } catch (e) {
        }

        res.status(201).json({ message: 'Walk-in added to queue', booking: walkInBooking });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 1-CLICK QUICK ADD WALK-IN (Zero Typing Required)
exports.quickAddWalkIn = async (req, res) => {
    try {
        const { salonId, serviceName, duration, price } = req.body;

        if (!salonId) {
            return res.status(400).json({ error: 'salonId is required' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Calculate accurate next token (e.g. 5 active in queue -> Token #6)
        const activeCount = await Booking.countDocuments({
            salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });
        const tokenNumber = activeCount + 1;
        const autoCustomerName = `Customer #${tokenNumber}`;

        // Default or chosen service
        const chosenService = {
            name: serviceName || (salon.services?.[0]?.name || 'Haircut & Grooming'),
            price: price !== undefined ? Number(price) : (salon.services?.[0]?.price || 150),
            duration: duration !== undefined ? Number(duration) : (salon.services?.[0]?.duration || 25)
        };

        salon.lastTokenNumber = tokenNumber;
        salon.liveQueueCount = (salon.liveQueueCount || 0) + 1;
        await salon.save();

        const walkInBooking = new Booking({
            salonId,
            walkInName: autoCustomerName,
            services: [chosenService],
            totalAmount: chosenService.price,
            estimatedDuration: chosenService.duration,
            status: 'accepted',
            isWalkIn: true,
            tokenNumber,
            serviceStartTime: new Date()
        });

        await walkInBooking.save();

        // Emit real-time socket update to all connected clients & dashboard
        try {
            const io = getIo();
            const roomName = String(salonId);

            const walkInActiveBookings = await Booking.find({
                salonId,
                status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
            });
            const walkInWaitTime = walkInActiveBookings.reduce((total, b) => {
                const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 25), 0);
                return total + bDuration;
            }, 0);

            io.emit('queueUpdate', {
                salonId: roomName,
                action: 'walk_in_added',
                booking: walkInBooking,
                liveQueueCount: salon.liveQueueCount,
                waitTime: walkInWaitTime
            });

            io.to(roomName).emit('newBooking', walkInBooking);
        } catch (socketErr) {
            console.error('Socket emit error on quick walk-in:', socketErr.message);
        }

        res.status(201).json({
            success: true,
            message: `✅ Token #${tokenNumber} (${autoCustomerName}) added to queue!`,
            tokenNumber,
            customerName: autoCustomerName,
            booking: walkInBooking
        });
    } catch (error) {
        console.error('quickAddWalkIn error:', error);
        res.status(500).json({ error: error.message });
    }
};

// USER initiates cancellation
exports.cancelBookingByUser = async (req, res) => {
    try {
        const { bookingId, userId, reason } = req.body;
        const Booking = require('../models/Booking');
        const Salon = require('../models/Salon');
        const User = require('../models/User');
        const { getIo } = require('../socket');
        const { sendNotification } = require('../services/notificationService');

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // Verify ownership
        if (booking.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
        }

        if (['cancelled', 'completed', 'rejected'].includes(booking.status)) {
            return res.status(400).json({ error: `Cannot cancel a booking that is already ${booking.status}` });
        }

        const oldStatus = booking.status;
        booking.status = 'cancelled';
        booking.cancelledBy = 'user';
        booking.cancellationReason = reason || 'No reason provided';
        await booking.save();
        // Update counts if it was an active booking
        const salon = await Salon.findById(booking.salonId);
        if (salon && ['pending', 'accepted', 'arrived', 'in_service'].includes(oldStatus)) {
            salon.liveQueueCount = Math.max(0, (salon.liveQueueCount || 0) - 1);

            // Update Staff count if assigned
            if (booking.staffId) {
                const staffMember = salon.staff.id(booking.staffId);
                if (staffMember) {
                    staffMember.liveQueueCount = Math.max(0, (staffMember.liveQueueCount || 0) - 1);
                }
            }

            await salon.save();

            // Notify Owner with reason
            if (salon.ownerId) {
                const owner = await User.findById(salon.ownerId);
                const canceller = await User.findById(userId);
                if (owner && owner.fcmToken) {
                    await sendNotification(
                        owner.fcmToken,
                        "Booking Cancelled ❌",
                        `${canceller?.name || 'A user'} cancelled their booking. Reason: ${reason || 'Not specified'}`
                    );
                }
            }

            // Socket Emit
            try {
                const io = getIo();
                // Calculate waitTime after cancellation
                const afterCancelBookings = await Booking.find({
                    salonId: salon._id,
                    status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
                });
                const cancelWaitTime = afterCancelBookings.reduce((total, b) => {
                    const bDuration = b.services.reduce((sum, s) => sum + (s.duration || 30), 0);
                    return total + bDuration;
                }, 0);

                io.emit('queueUpdate', {
                    salonId: String(salon._id),
                    action: 'user_cancelled',
                    bookingId: String(booking._id),
                    liveQueueCount: salon.liveQueueCount,
                    waitTime: cancelWaitTime
                });
            } catch (err) {
            }
        }

        res.status(200).json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSalon = async (req, res) => {
    try {
        const { salonId } = req.params;

        // HARDENING: Only allow whitelisted fields
        const updates = sanitizeUpdateFields(req.body, SALON_UPDATE_WHITELIST);

        // HARDENING: Validate and sanitize phone number
        if (updates.phone) {
            if (!isValidPhone(updates.phone)) {
                return res.status(400).json({ error: 'Invalid phone number. Must be at least 10 digits.' });
            }
            updates.phone = sanitizePhone(updates.phone); // Keep only digits
        }

        // Delete old images from Cloudinary if images array is being updated
        if (updates.images && Array.isArray(updates.images)) {
            const salon = await Salon.findById(salonId);
            if (salon && salon.images && Array.isArray(salon.images)) {
                // Find images that were removed
                const removedImages = salon.images.filter(oldImg => !updates.images.includes(oldImg));
                // Delete each removed image from Cloudinary
                for (const imgUrl of removedImages) {
                    try {
                        await deleteImage(imgUrl);
                    } catch (deleteErr) {
                    }
                }
            }
        }
        const salon = await Salon.findByIdAndUpdate(salonId, updates, { new: true });
        if (!salon) return res.status(404).json({ error: 'Salon not found' });
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.addStaff = async (req, res) => {
    try {
        const { salonId, staffMember } = req.body;
        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        salon.staff.push(staffMember);
        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeStaff = async (req, res) => {
    try {
        const { salonId, staffId } = req.params;
        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Delete staff photo from Cloudinary before removing
        const staffToRemove = salon.staff.find(s => s._id.toString() === staffId);
        if (staffToRemove && staffToRemove.photo) {
            try {
                await deleteImage(staffToRemove.photo);
            } catch (deleteErr) {
            }
        }

        salon.staff = salon.staff.filter(s => s._id.toString() !== staffId);
        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateStaff = async (req, res) => {
    try {
        const { salonId, staffId } = req.params;
        const updates = req.body;
        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        const staffIndex = salon.staff.findIndex(s => s._id.toString() === staffId);
        if (staffIndex === -1) return res.status(404).json({ error: 'Staff not found' });

        // Delete old staff photo from Cloudinary if photo is being updated
        if (updates.photo && salon.staff[staffIndex].photo && salon.staff[staffIndex].photo !== updates.photo) {
            try {
                await deleteImage(salon.staff[staffIndex].photo);
            } catch (deleteErr) {
            }
        }

        Object.assign(salon.staff[staffIndex], updates);
        await salon.save();
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllSalons = async (req, res) => {
    try {
        const salons = await Salon.find().populate('ownerId', 'name email profilePhoto');
        res.status(200).json(salons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.toggleSalonBlock = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { blocked } = req.body;
        const salon = await Salon.findByIdAndUpdate(salonId, { isBlocked: blocked }, { new: true });
        if (!salon) return res.status(404).json({ error: 'Salon not found' });
        res.status(200).json(salon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// S1: Customer Status Update (On The Way / Delayed)
exports.customerStatus = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { userId, status, eta } = req.body; // status: 'on_the_way' | 'delayed'

        const user = await User.findById(userId);
        const salon = await Salon.findById(salonId);

        if (!salon) return res.status(404).json({ error: 'Salon not found' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Find salon owner
        const owner = await User.findById(salon.ownerId);

        if (owner && owner.fcmToken) {
            const { sendNotification } = require('../services/notificationService');

            if (status === 'on_the_way') {
                await sendNotification(
                    owner.fcmToken,
                    "🚶 Customer On The Way!",
                    `${user.name} is heading to your salon. ETA: ~${eta || 5} mins.`
                );
            } else if (status === 'delayed') {
                await sendNotification(
                    owner.fcmToken,
                    "⏳ Customer Running Late",
                    `${user.name} is delayed by ~${eta || 10} mins.`
                );
            }
        }

        // Also emit socket event for real-time update
        try {
            const io = getIo();
            io.to(salonId).emit('customerStatus', {
                userId,
                userName: user.name,
                status,
                eta: eta || (status === 'on_the_way' ? 5 : 10)
            });
        } catch (e) { }

        res.status(200).json({ message: 'Status sent to salon' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// SALON sends status message to a customer in queue
exports.sendStatusToNextCustomer = async (req, res) => {
    try {
        const { bookingId, salonId, statusMessage } = req.body;
        const Booking = require('../models/Booking');
        const Salon = require('../models/Salon');
        const User = require('../models/User');
        const { getIo } = require('../socket');
        const { sendNotification } = require('../services/notificationService');

        if (!bookingId || !statusMessage) {
            return res.status(400).json({ error: 'bookingId and statusMessage are required' });
        }

        const booking = await Booking.findById(bookingId).populate('userId');
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        const salon = await Salon.findById(salonId || booking.salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // No DB save — notification-only
        // Send push notification to the customer
        if (booking.userId && booking.userId.fcmToken) {
            await sendNotification(
                booking.userId.fcmToken,
                `📢 ${salon.name}`,
                statusMessage
            );
        }

        // Socket emit for real-time update
        try {
            const io = getIo();
            io.emit('queueUpdate', {
                salonId: String(salon._id),
                action: 'status_message',
                bookingId: String(booking._id),
                statusMessage: statusMessage
            });
        } catch (e) {
        }

        res.status(200).json({ message: 'Status sent to customer', statusMessage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// CUSTOMER ANALYTICS — Full Profile for Salon Owners
// ============================================
exports.getCustomerProfile = async (req, res) => {
    try {
        const { salonId, userId } = req.params;

        // 1. Get customer info
        const customer = await User.findById(userId).select('name email phone profilePhoto createdAt');
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // 2. Get all bookings for this customer at this salon
        const allBookings = await Booking.find({ salonId, userId })
            .sort({ createdAt: -1 });

        const completedBookings = allBookings.filter(b => b.status === 'completed');
        const cancelledBookings = allBookings.filter(b => b.status === 'cancelled');

        // 3. Visit Stats
        const totalVisits = completedBookings.length;
        const firstVisit = completedBookings.length > 0
            ? completedBookings[completedBookings.length - 1].createdAt
            : null;
        const lastVisit = completedBookings.length > 0
            ? completedBookings[0].createdAt
            : null;
        const daysSinceLastVisit = lastVisit
            ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Average gap between visits (in days)
        let avgVisitGap = 0;
        if (completedBookings.length >= 2) {
            const gaps = [];
            for (let i = 0; i < completedBookings.length - 1; i++) {
                const gap = Math.floor(
                    (new Date(completedBookings[i].createdAt) - new Date(completedBookings[i + 1].createdAt)) / (1000 * 60 * 60 * 24)
                );
                gaps.push(gap);
            }
            avgVisitGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        }

        // 4. Spending Stats
        const totalSpent = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const avgPerVisit = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;
        const amounts = completedBookings.map(b => b.totalAmount || 0);
        const highestSpent = amounts.length > 0 ? Math.max(...amounts) : 0;
        const lowestSpent = amounts.length > 0 ? Math.min(...amounts) : 0;

        // 5. Loyalty Status
        let loyaltyStatus = 'new';
        if (totalVisits === 0) {
            loyaltyStatus = 'new';
        } else if (totalVisits >= 10) {
            loyaltyStatus = 'vip';
        } else if (totalVisits >= 5) {
            if (daysSinceLastVisit > 90) loyaltyStatus = 'lost';
            else if (daysSinceLastVisit > 30) loyaltyStatus = 'at_risk';
            else loyaltyStatus = 'loyal';
        } else if (totalVisits >= 2) {
            if (daysSinceLastVisit > 90) loyaltyStatus = 'lost';
            else if (daysSinceLastVisit > 30) loyaltyStatus = 'at_risk';
            else loyaltyStatus = 'regular';
        } else {
            loyaltyStatus = 'new';
        }

        // 6. Favorite Services
        const serviceMap = {};
        completedBookings.forEach(b => {
            (b.services || []).forEach(s => {
                if (!serviceMap[s.name]) {
                    serviceMap[s.name] = { name: s.name, count: 0, totalSpent: 0 };
                }
                serviceMap[s.name].count++;
                serviceMap[s.name].totalSpent += (s.price || 0);
            });
        });
        const totalServiceCount = Object.values(serviceMap).reduce((sum, s) => sum + s.count, 0);
        const favoriteServices = Object.values(serviceMap)
            .sort((a, b) => b.count - a.count)
            .map(s => ({
                ...s,
                percentage: totalServiceCount > 0 ? Math.round((s.count / totalServiceCount) * 100) : 0
            }));

        // 7. Recent Bookings (last 10)
        const recentBookings = allBookings.slice(0, 10).map(b => ({
            id: b._id,
            date: b.createdAt,
            services: (b.services || []).map(s => s.name),
            amount: b.totalAmount || 0,
            status: b.status
        }));

        // 8. Review for this salon
        const Review = require('../models/Review');
        const review = await Review.findOne({ salonId, userId }).sort({ createdAt: -1 });

        // 9. Customer Notes
        const salon = await Salon.findById(salonId).select('customerNotes');
        const noteEntry = salon?.customerNotes?.find(n => String(n.userId) === String(userId));

        res.status(200).json({
            customer: {
                name: customer.name,
                phone: customer.phone || null,
                email: customer.email || null,
                profilePhoto: customer.profilePhoto || null,
                memberSince: customer.createdAt
            },
            visitStats: {
                totalVisits,
                firstVisit,
                lastVisit,
                daysSinceLastVisit,
                avgVisitGap,
                cancelledCount: cancelledBookings.length,
                totalBookings: allBookings.length
            },
            spendingStats: {
                totalSpent,
                avgPerVisit,
                highestSpent,
                lowestSpent
            },
            loyaltyStatus,
            favoriteServices,
            recentBookings,
            review: review ? {
                rating: review.rating,
                comment: review.comment,
                date: review.createdAt
            } : null,
            customerNote: noteEntry?.note || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Save/Update Customer Note (Salon Owner's private note)
exports.saveCustomerNote = async (req, res) => {
    try {
        const { salonId, userId, note } = req.body;
        if (!salonId || !userId) return res.status(400).json({ error: 'salonId and userId are required' });

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Find existing note index
        const existingIdx = salon.customerNotes.findIndex(n => String(n.userId) === String(userId));

        if (existingIdx >= 0) {
            // Update existing note
            salon.customerNotes[existingIdx].note = note;
            salon.customerNotes[existingIdx].updatedAt = new Date();
        } else {
            // Add new note
            salon.customerNotes.push({ userId, note, updatedAt: new Date() });
        }

        await salon.save();
        res.status(200).json({ message: 'Note saved', note });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// APPOINTMENT SLOT FEATURE
// ============================================

// Get available appointment slots for a given date
exports.getAvailableSlots = async (req, res) => {
    try {
        const { salonId } = req.params;
        const { date, totalDuration } = req.query;

        if (!date || !totalDuration) {
            return res.status(400).json({ error: 'date and totalDuration are required' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        const slotDuration = parseInt(totalDuration) || 30;
        const slotGap = salon.appointmentSettings?.slotGap || 0;
        const maxPerSlot = salon.appointmentSettings?.maxAppointmentsPerSlot || 1;

        // Get salon open/close times
        const openTime = salon.timings?.open || '09:00';
        const closeTime = salon.timings?.close || '21:00';

        // Check if salon is open on the requested day
        const requestedDate = new Date(date);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const requestedDay = days[requestedDate.getDay()];

        if (salon.timings?.days && salon.timings.days.length > 0) {
            const isOpenOnDay = salon.timings.days.some(d => d.toLowerCase() === requestedDay.toLowerCase());
            if (!isOpenOnDay) {
                return res.status(200).json({ slots: [], message: `Salon is closed on ${requestedDay}s` });
            }
        }

        // Generate all possible slots
        const slots = [];
        const [openH, openM] = openTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);

        let currentMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        while (currentMinutes + slotDuration <= closeMinutes) {
            const startH = Math.floor(currentMinutes / 60);
            const startM = currentMinutes % 60;
            const endMinutes = currentMinutes + slotDuration;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;

            const start = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
            const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

            slots.push({ start, end });

            currentMinutes = endMinutes + slotGap;
        }

        // Get existing bookings for this date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBookings = await Booking.find({
            salonId,
            bookingType: 'appointment',
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['cancelled', 'rejected'] }
        });

        // Mark slots as booked or available
        const slotsWithAvailability = slots.map(slot => {
            const bookedCount = existingBookings.filter(b =>
                b.appointmentSlot && b.appointmentSlot.start === slot.start
            ).length;

            return {
                ...slot,
                isBooked: bookedCount >= maxPerSlot,
                bookedCount
            };
        });

        // For today, filter out past slots
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const requestedDateStr = requestedDate.toISOString().slice(0, 10);

        let finalSlots = slotsWithAvailability;
        if (todayStr === requestedDateStr) {
            // Use IST for current time
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istNow = new Date(today.getTime() + istOffset);
            const currentTimeStr = istNow.toISOString().slice(11, 16);

            finalSlots = slotsWithAvailability.filter(slot => slot.start > currentTimeStr);
        }

        res.status(200).json({ slots: finalSlots, date, slotDuration });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Book an appointment slot
exports.bookAppointment = async (req, res) => {
    try {
        let { userId, salonId, services, staffId, appointmentDate, appointmentSlot } = req.body;

        if (!appointmentDate || !appointmentSlot || !appointmentSlot.start || !appointmentSlot.end) {
            return res.status(400).json({ error: 'appointmentDate and appointmentSlot (start, end) are required' });
        }

        // Resolve User ID if it's a Firebase UID
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            let user = await User.findOne({ firebaseUid: userId });
            if (!user && userId === 'GUEST_USER') {
                user = await User.findOne({ email: 'guest@smartsalon.com' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            userId = user._id;
        }

        const salon = await Salon.findById(salonId);
        if (!salon) return res.status(404).json({ error: 'Salon not found' });

        // Check if slot is already booked
        const startOfDay = new Date(appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(appointmentDate);
        endOfDay.setHours(23, 59, 59, 999);

        const maxPerSlot = salon.appointmentSettings?.maxAppointmentsPerSlot || 1;
        const existingCount = await Booking.countDocuments({
            salonId,
            bookingType: 'appointment',
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            'appointmentSlot.start': appointmentSlot.start,
            status: { $nin: ['cancelled', 'rejected'] }
        });

        if (existingCount >= maxPerSlot) {
            return res.status(400).json({ error: 'This slot is already booked. Please choose another time.' });
        }

        // Monthly booking limit check
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthlyBookingCount = await Booking.countDocuments({
            userId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $nin: ['cancelled', 'rejected'] }
        });
        if (monthlyBookingCount >= MONTHLY_BOOKING_LIMIT) {
            return res.status(400).json({
                error: `Monthly booking limit reached! You can only book ${MONTHLY_BOOKING_LIMIT} times per month.`
            });
        }

        // Calculate totals
        let totalAmount = 0;
        let totalDuration = 0;
        services.forEach(s => {
            totalAmount += s.price;
            totalDuration += (s.duration || 30);
        });

        // Token number
        const activeCount = await Booking.countDocuments({
            salonId,
            status: { $in: ['pending', 'accepted', 'arrived', 'in_service'] }
        });
        const newToken = activeCount + 1;

        const newBooking = new Booking({
            userId,
            salonId,
            staffId: staffId || null,
            services,
            tokenNumber: newToken,
            totalAmount,
            estimatedDuration: totalDuration,
            status: 'scheduled', // Scheduled — not in live queue until time arrives
            bookingType: 'appointment',
            appointmentDate: new Date(appointmentDate),
            appointmentSlot: {
                start: appointmentSlot.start,
                end: appointmentSlot.end
            }
        });

        await newBooking.save();

        // NOTE: Do NOT update liveQueueCount — appointments are scheduled, not in live queue
        // Queue count only updates when appointment is started by salon owner

        // Send notification to salon owner
        try {
            const owner = await User.findById(salon.ownerId);
            if (owner && owner.fcmToken) {
                const { sendNotification } = require('../services/notificationService');
                const bookingUser = await User.findById(userId);
                await sendNotification(
                    owner.fcmToken,
                    "📅 New Appointment Booked!",
                    `${bookingUser?.name || 'A customer'} booked for ${appointmentSlot.start} - ${appointmentSlot.end} on ${new Date(appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                );
            }
        } catch (notifErr) { }

        // Socket emit
        try {
            const { getIo } = require('../socket');
            const io = getIo();
            io.emit('queueUpdate', {
                salonId: String(salonId),
                action: 'appointment_booked',
                booking: newBooking,
                liveQueueCount: salon.liveQueueCount
            });
            io.to(String(salonId)).emit('newBooking', newBooking);
        } catch (e) { }

        res.status(201).json({
            message: 'Appointment booked successfully',
            bookingId: newBooking._id,
            tokenNumber: newToken,
            appointmentSlot,
            appointmentDate,
            booking: newBooking
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get upcoming appointments for a salon (today and future)
exports.getUpcomingAppointments = async (req, res) => {
    try {
        const { salonId } = req.params;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const appointments = await Booking.find({
            salonId,
            bookingType: 'appointment',
            status: 'scheduled',
            appointmentDate: { $gte: today }
        })
            .populate('userId', 'name profilePhoto phone phoneNumber')
            .sort({ appointmentDate: 1, 'appointmentSlot.start': 1 });

        res.status(200).json({ appointments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
