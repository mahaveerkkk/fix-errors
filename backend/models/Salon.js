const mongoose = require('mongoose');
const salonSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName: { type: String }, // Added to allow editing owner name directly
    name: { type: String, required: true, index: true },
    description: { type: String }, // Added description (About)
    address: { type: String, required: true },
    phone: { type: String },
    email: { type: String }, // Added email field
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    images: [String],
    services: [{
        name: String,
        price: Number,
        category: String,
        duration: { type: Number, default: 30 }, // Duration in minutes
        photos: [String] // URLs of service examples (e.g. types of haircuts)
    }],
    staff: [{
        name: String,
        photo: String,
        role: String,
        isAvailable: { type: Boolean, default: true },
        liveQueueCount: { type: Number, default: 0 } // Queue for specific staff
    }],
    isBookingPaused: { type: Boolean, default: false },
    settings: {
        autoAcceptTime: { type: Number, default: 60 } // seconds
    },
    timings: {
        open: { type: String, default: '09:00' },
        close: { type: String, default: '21:00' },
        days: [String]
    },
    liveQueueCount: { type: Number, default: 0 }, // Current people waiting
    lastTokenNumber: { type: Number, default: 0 }, // Last issued token (for uniqueness)
    status: { type: String, enum: ['open', 'closed', 'draft', 'active'], default: 'draft', index: true }, // Default to draft for onboarding
    isBlocked: { type: Boolean, default: false, index: true },

    // Break Feature
    breakInfo: {
        isOnBreak: { type: Boolean, default: false, index: true },
        breakEndTime: { type: Date, default: null },
        breakDuration: { type: Number, default: 0 } // in minutes
    },

    profileViews: { type: Number, default: 0 }, // Analytics: Track how many times profile is viewed

    // Facilities offered by salon
    facilities: [{
        name: { type: String },
        icon: { type: String, default: 'checkmark-circle' }
    }],

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    // Social Media Links
    socialLinks: {
        instagram: { type: String, default: '' },
        facebook: { type: String, default: '' },
        youtube: { type: String, default: '' },
        website: { type: String, default: '' }
    },

    // Subscription Fields
    isPaymentActive: { type: Boolean, default: false },
    currentPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    subscriptionEndDate: { type: Date },
    razorpaySubscriptionId: { type: String },

    // Appointment Settings
    appointmentSettings: {
        enabled: { type: Boolean, default: true },
        advanceDays: { type: Number, default: 7 },
        slotGap: { type: Number, default: 0 },
        maxAppointmentsPerSlot: { type: Number, default: 1 }
    },

    // Customer Notes (salon owner's private notes about customers)
    customerNotes: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
        updatedAt: { type: Date, default: Date.now }
    }],

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Salon', salonSchema);
