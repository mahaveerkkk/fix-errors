const mongoose = require('mongoose');

/**
 * Validation Utility Functions for Backend Hardening
 * RULE: These functions add security without breaking existing flow
 */

// Valid MongoDB ObjectId check
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Valid user roles (admin can only be set manually in DB)
const VALID_USER_ROLES = ['user', 'owner'];
const isValidRole = (role) => {
    return VALID_USER_ROLES.includes(role);
};

// Salon status validation
const VALID_SALON_STATUSES = ['draft', 'open', 'closed'];
const isValidSalonStatus = (status) => {
    return VALID_SALON_STATUSES.includes(status);
};

// Rating validation (1-5)
const isValidRating = (rating) => {
    const num = Number(rating);
    return !isNaN(num) && num >= 1 && num <= 5;
};

// Phone number validation - only digits, 10+ characters
const isValidPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    const digitsOnly = phone.replace(/\D/g, ''); // Remove non-digits
    return digitsOnly.length >= 10;
};

// Sanitize phone - extract only digits
const sanitizePhone = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/\D/g, ''); // Remove all non-digit characters
};

// Email format validation
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Price validation - must be non-negative number
const isValidPrice = (price) => {
    const num = Number(price);
    return !isNaN(num) && num >= 0;
};

// Duration validation - must be positive number (minutes)
const isValidDuration = (duration) => {
    const num = Number(duration);
    return !isNaN(num) && num > 0 && num <= 600; // Max 10 hours
};

// Latitude validation (-90 to 90, excluding 0,0 placeholder)
const isValidLatitude = (lat) => {
    const num = Number(lat);
    return !isNaN(num) && num >= -90 && num <= 90;
};

// Longitude validation (-180 to 180, excluding 0,0 placeholder)
const isValidLongitude = (lng) => {
    const num = Number(lng);
    return !isNaN(num) && num >= -180 && num <= 180;
};

// Strict Coordinates validation — rejects null, undefined, NaN, and 0,0 placeholder
const isValidCoordinates = (lat, lng) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (isNaN(latitude) || isNaN(longitude)) return false;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
    // Reject (0,0) placeholder — Null Island (GPS failed)
    if (latitude === 0 && longitude === 0) return false;
    return true;
};

// Service object validation
const isValidService = (service) => {
    if (!service || typeof service !== 'object') return false;
    if (!service.name || typeof service.name !== 'string' || service.name.trim() === '') return false;
    if (!isValidPrice(service.price)) return false;
    if (service.duration && !isValidDuration(service.duration)) return false;
    return true;
};

// Services array validation
const validateServicesArray = (services) => {
    if (!Array.isArray(services)) return { valid: false, error: 'Services must be an array' };
    for (let i = 0; i < services.length; i++) {
        if (!isValidService(services[i])) {
            return { valid: false, error: `Invalid service at index ${i}. Each service must have name (string) and price (number >= 0)` };
        }
    }
    return { valid: true };
};

// Field whitelisting for user profile updates
const USER_UPDATE_WHITELIST = ['name', 'phone', 'profilePhoto', 'location', 'fcmToken'];

// Field whitelisting for salon updates
const SALON_UPDATE_WHITELIST = [
    'name', 'description', 'address', 'phone', 'email',
    'location', 'services', 'staff', 'timings', 'images',
    'status', 'isBookingPaused', 'facilities'
];

/**
 * Sanitize updates to only allow whitelisted fields
 * Returns object with only allowed fields
 */
const sanitizeUpdateFields = (updates, whitelist) => {
    const sanitized = {};
    const rejected = [];

    Object.keys(updates).forEach(key => {
        if (whitelist.includes(key)) {
            sanitized[key] = updates[key];
        } else {
            rejected.push(key);
        }
    });

    if (rejected.length > 0) {
        console.log('[SECURITY] Rejected fields:', rejected.join(', '));
    }

    return sanitized;
};

/**
 * Validate ObjectId and return 400 response if invalid
 * Returns true if valid, false if responded with error
 */
const validateObjectIdParam = (id, paramName, res) => {
    if (!isValidObjectId(id)) {
        res.status(400).json({ error: `Invalid ${paramName}` });
        return false;
    }
    return true;
};

module.exports = {
    isValidObjectId,
    isValidRole,
    isValidSalonStatus,
    isValidRating,
    isValidPhone,
    sanitizePhone,
    isValidEmail,
    isValidPrice,
    isValidDuration,
    isValidLatitude,
    isValidLongitude,
    isValidCoordinates,
    isValidService,
    validateServicesArray,
    sanitizeUpdateFields,
    validateObjectIdParam,
    USER_UPDATE_WHITELIST,
    SALON_UPDATE_WHITELIST,
    VALID_USER_ROLES,
    VALID_SALON_STATUSES
};
