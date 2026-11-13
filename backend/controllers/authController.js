const User = require('../models/User');
const { admin } = require('../config/firebaseConfig');
const { isValidRole } = require('../utils/validation');

exports.signup = async (req, res) => {
    try {
        const { idToken, role, name, phone } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Missing idToken' });
        }

        // 1. Verify Token with Firebase
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid Firebase Token' });
        }

        const { uid, email } = decodedToken;

        // 2. Check if user already exists in MongoDB (by UID OR Email)
        let existingUser = await User.findOne({
            $or: [{ firebaseUid: uid }, { email: email }]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already registered' });
        }

        // HARDENING: Validate role - only allow 'user' or 'owner', NEVER 'admin'
        let safeRole = 'user'; // Default to user
        if (role && isValidRole(role)) {
            safeRole = role;
        } else if (role) {
        }

        // 3. Create User Document in MongoDB
        const newUser = new User({
            firebaseUid: uid,
            name: name || decodedToken.name || 'No Name',
            email,
            phone: phone || decodedToken.phone_number || '',
            role: safeRole, // Use validated role
            isPaymentActive: true, // TEMPORARY: Make everyone active by default (Free Registration)
            fcmToken: req.body.fcmToken || '',
            profilePhoto: req.body.profilePhoto || decodedToken.picture || '',
            location: req.body.location || null, // { lat, lng }
            salonSetupCompleted: false
        });


        await newUser.save();

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone, // Added phone
                role: newUser.role,
                isPaymentActive: newUser.isPaymentActive,
                profilePhoto: newUser.profilePhoto,
                location: newUser.location,
                salonSetupCompleted: newUser.salonSetupCompleted
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const Salon = require('../models/Salon');

exports.login = async (req, res) => {
    try {
        const { idToken, role } = req.body; // Accept role from frontend (optional)

        if (!idToken) {
            return res.status(400).json({ error: 'Missing idToken' });
        }

        // 1. Verify Token with Firebase
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid Firebase Token' });
        }

        const { uid, email } = decodedToken;

        // 2. Check if user exists in MongoDB (by UID OR Email)
        let user = await User.findOne({
            $or: [{ firebaseUid: uid }, { email: email }]
        });

        // 3. JIT Provisioning (Auto-create if not exists)
        if (!user) {
            if (!email) return res.status(400).json({ error: 'Email is required from token' });

            // HARDENING: Validate role - only allow 'user' or 'owner', NEVER 'admin'
            let assignedRole = 'user'; // Default to user
            if (role && isValidRole(role)) {
                assignedRole = role;
            } else if (role) {
            }

            user = new User({
                firebaseUid: uid,
                name: req.body.name || decodedToken.name || 'New User',
                email,
                phone: req.body.phone || decodedToken.phone_number || '',
                role: assignedRole,
                isPaymentActive: true,
                fcmToken: req.body.fcmToken || '',
                profilePhoto: decodedToken.picture || '',
                location: req.body.location || null,
                salonSetupCompleted: false
            });
            await user.save();
        } else {
            // Update fields on Login
            if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;
            if (req.body.location) user.location = req.body.location;

            // Ensure Firebase UID is up to date (in case of linking)
            if (user.firebaseUid !== uid) {
                user.firebaseUid = uid;
            }

            // Only set photo if missing
            if (!user.profilePhoto && decodedToken.picture) {
                user.profilePhoto = decodedToken.picture;
            }
            if (req.body.profilePhoto) {
                user.profilePhoto = req.body.profilePhoto;
            }

            await user.save();
        }

        // 4. Check if user has a salon
        const salon = await Salon.findOne({ ownerId: user._id });

        // Update salonSetupCompleted if salon exists (Temporarily removed status check to unblock dev)
        if (salon && !user.salonSetupCompleted) {
            user.salonSetupCompleted = true;
            await user.save();
        }

        // DEBUG: Log the user object being returned
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone, // Added phone
                role: user.role,
                isPaymentActive: user.isPaymentActive,
                profilePhoto: user.profilePhoto,
                location: user.location,
                salonSetupCompleted: user.salonSetupCompleted
            },
            salon: salon ? salon : null
        });

    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};
