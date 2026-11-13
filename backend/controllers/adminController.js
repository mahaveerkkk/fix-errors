const Salon = require('../models/Salon');
const User = require('../models/User');
const Booking = require('../models/Booking');

exports.getAllSalons = async (req, res) => {
    try {
        const salons = await Salon.find({});
        res.status(200).json(salons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSalonStatus = async (req, res) => {
    try {
        const { salonId, isBlocked } = req.body;

        // Update the isBlocked field directly
        await Salon.findByIdAndUpdate(salonId, { isBlocked });

        res.status(200).json({ message: `Salon ${isBlocked ? 'blocked' : 'unblocked'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPlatformEarnings = async (req, res) => {
    try {
        // Platform earns from Subscription fees (e.g. 20 Rs per month per owner)
        // Count active owners
        const totalOwners = await User.countDocuments({ role: 'owner', isPaymentActive: true });

        // Mock calculation: 20 Rs * totalOwners
        const estimatedEarnings = totalOwners * 20;

        res.status(200).json({
            totalOwners,
            estimatedEarnings
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Subscription Plan Management
const SubscriptionPlan = require('../models/SubscriptionPlan');

exports.createPlan = async (req, res) => {
    try {
        const { name, price, interval, features } = req.body;
        const newPlan = new SubscriptionPlan({ name, price, interval, features });
        await newPlan.save();
        res.status(201).json(newPlan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({});
        res.status(200).json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json(updatedPlan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        await SubscriptionPlan.findByIdAndDelete(id);
        res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
