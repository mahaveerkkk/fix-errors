const mongoose = require('mongoose');

const salonViewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    viewedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index for fast queries
salonViewSchema.index({ salonId: 1, userId: 1 });
salonViewSchema.index({ salonId: 1, viewedAt: -1 });

module.exports = mongoose.model('SalonView', salonViewSchema);
