const User = require('../models/User');
const Salon = require('../models/Salon');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const SupportTicket = require('../models/SupportTicket');
const SalonView = require('../models/SalonView');
const { admin } = require('../config/firebaseConfig');

const { deleteImage } = require('../utils/cloudinary');
const { sanitizeUpdateFields, USER_UPDATE_WHITELIST, isValidPhone, sanitizePhone } = require('../utils/validation');

exports.updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        // HARDENING: Only allow whitelisted fields to be updated
        const updates = sanitizeUpdateFields(req.body, USER_UPDATE_WHITELIST);

        // HARDENING: Validate and sanitize phone number
        if (updates.phone) {
            if (!isValidPhone(updates.phone)) {
                return res.status(400).json({ error: 'Invalid phone number. Must be at least 10 digits.' });
            }
            updates.phone = sanitizePhone(updates.phone); // Keep only digits
        }
        // 1. If updating profilePhoto, delete the old one first
        if (updates.profilePhoto) {
            const user = await User.findById(userId);
            if (user && user.profilePhoto && user.profilePhoto !== updates.profilePhoto) {
                await deleteImage(user.profilePhoto);
            }
        }

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile: ' + error.message });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
};

exports.toggleFavorite = async (req, res) => {
    try {
        const { userId } = req.params;
        const { salonId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Robust comparison using String()
        const index = user.favorites.findIndex(fav => fav.toString() === salonId.toString());

        if (index === -1) {
            user.favorites.push(salonId); // Add
        } else {
            user.favorites.splice(index, 1); // Remove
        }

        await user.save();
        res.status(200).json({ favorites: user.favorites });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFavorites = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('favorites');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Filter out any nulls (if salon was deleted)
        const validFavorites = user.favorites.filter(fav => fav !== null);
        res.status(200).json(validFavorites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 1. Delete associated salon if role is salon OWNER
        // BUG FIX: was 'salon' which NEVER matched — role enum is 'owner'
        if (user.role === 'owner') {
            const salon = await Salon.findOne({ ownerId: user._id });
            if (salon) {
                // Collect images to delete from Cloudinary
                const imagesToDelete = [];
                if (salon.images && salon.images.length > 0) {
                    imagesToDelete.push(...salon.images);
                }
                if (salon.services) {
                    salon.services.forEach(service => {
                        if (service.photos && service.photos.length > 0) {
                            imagesToDelete.push(...service.photos);
                        }
                    });
                }
                if (salon.staff) {
                    salon.staff.forEach(s => {
                        if (s.photo) {
                            imagesToDelete.push(s.photo);
                        }
                    });
                }

                // Delete images from Cloudinary
                for (const imgUrl of imagesToDelete) {
                    try {
                        await deleteImage(imgUrl);
                    } catch (imgErr) {
                        console.error('Image delete error (continuing):', imgErr.message);
                    }
                }

                // Delete salon reviews
                await Review.deleteMany({ salonId: salon._id });

                // Delete salon bookings
                await Booking.deleteMany({ salonId: salon._id });

                // Delete salon wallet (salon has separate wallet linked via salonId)
                await Wallet.deleteOne({ salonId: salon._id });

                // Delete salon profile view records
                await SalonView.deleteMany({ salonId: salon._id });

                // Delete referral records where this salon was referred
                await Referral.deleteMany({ referredSalonId: salon._id });

                // Remove this user's customerNotes from other salons
                await Salon.updateMany(
                    { 'customerNotes.userId': user._id },
                    { $pull: { customerNotes: { userId: user._id } } }
                );

                // Delete salon itself
                await Salon.findByIdAndDelete(salon._id);
            }

            // Also delete any bookings/reviews this owner made as a customer
            await Review.deleteMany({ userId: user._id });
            await Booking.deleteMany({ userId: user._id });
        } else {
            // Delete customer reviews
            await Review.deleteMany({ userId: user._id });

            // Delete customer bookings
            await Booking.deleteMany({ userId: user._id });

            // Delete customer's salon view history
            await SalonView.deleteMany({ userId: user._id });

            // Remove this user's customerNotes from salons
            await Salon.updateMany(
                { 'customerNotes.userId': user._id },
                { $pull: { customerNotes: { userId: user._id } } }
            );
        }

        // 2. Delete user wallet
        await Wallet.deleteOne({ userId: user._id });

        // 3. Delete referral records (where user was referrer or was referred)
        await Referral.deleteMany({
            $or: [{ referrerId: user._id }, { referredUserId: user._id }]
        });

        // 4. Delete support tickets
        await SupportTicket.deleteMany({ userId: user._id });

        // 5. Delete user's profile photo from Cloudinary
        if (user.profilePhoto) {
            try {
                await deleteImage(user.profilePhoto);
            } catch (imgErr) {
                console.error('Profile photo delete error (continuing):', imgErr.message);
            }
        }

        // 6. Remove from other users' favorites
        await User.updateMany(
            { favorites: user._id },
            { $pull: { favorites: user._id } }
        );

        // 7. Delete user from Firebase Auth
        if (user.firebaseUid && user.firebaseUid !== 'guest_user_static_uid') {
            try {
                await admin.auth().deleteUser(user.firebaseUid);
                console.log('Firebase user deleted successfully:', user.firebaseUid);
            } catch (fbError) {
                console.error('Firebase Auth Deletion Error:', fbError.message);
                // Continue execution even if Firebase deletion fails
            }
        }

        // 8. Delete User document
        await User.findByIdAndDelete(userId);

        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account: ' + error.message });
    }
};
