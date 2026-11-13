const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Optional for walk-ins
    isWalkIn: { type: Boolean, default: false },
    walkInName: { type: String },
    salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    staffId: { type: mongoose.Schema.Types.ObjectId }, // Optional (if 'Any' selected)
    services: [{
        name: String,
        price: Number,
        duration: Number
    }],
    serviceStartTime: { type: Date }, // When status becomes 'accepted'/'serving'
    estimatedDuration: { type: Number }, // In minutes
    tokenNumber: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled', 'scheduled'],
        default: 'pending',
        index: true
    },
    totalAmount: { type: Number, required: true },
    customerStatus: {
        type: String,
        enum: ['on_way', 'arrived', 'delayed', null],
        default: null
    },
    expiresAt: { type: Date },
    cancellationReason: { type: String },
    cancelledBy: { type: String, enum: ['user', 'salon', null], default: null },
    isReviewed: { type: Boolean, default: false },

    // Appointment Slot Feature
    bookingType: { type: String, enum: ['queue', 'appointment'], default: 'queue' },
    appointmentDate: { type: Date },
    appointmentSlot: {
        start: { type: String },
        end: { type: String }
    },

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
