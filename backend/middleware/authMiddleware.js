const { admin } = require('../config/firebaseConfig');
const User = require('../models/User');
const Salon = require('../models/Salon');

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken; // Firebase User

        // Optional: Attach Role from MongoDB if needed for role-based access
        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        if (user) {
            req.user.role = user.role;
            req.user.mongoId = user._id;
        }

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }
};

// NEW: Check if user is an owner
const isOwner = (req, res, next) => {
    if (req.user && (req.user.role === 'owner' || req.user.role === 'admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Forbidden: Owner access only' });
    }
};

// NEW: Verify user owns the salon being modified
// Usage: Call this AFTER verifyToken and pass salonId from req.body or req.params
const verifySalonOwnership = async (req, res, next) => {
    try {
        const salonId = req.body.salonId || req.params.salonId;
        
        if (!salonId) {
            return res.status(400).json({ error: 'Salon ID required' });
        }

        const salon = await Salon.findById(salonId);
        if (!salon) {
            return res.status(404).json({ error: 'Salon not found' });
        }

        // Allow if admin OR owner of this salon
        if (req.user.role === 'admin' || 
            (req.user.mongoId && salon.ownerId.toString() === req.user.mongoId.toString())) {
            req.salon = salon; // Attach salon for later use
            next();
        } else {
            return res.status(403).json({ error: 'Forbidden: You do not own this salon' });
        }
    } catch (error) {
        console.error('Ownership Check Error:', error);
        return res.status(500).json({ error: 'Ownership verification failed' });
    }
};

module.exports = { verifyToken, isAdmin, isOwner, verifySalonOwnership };

