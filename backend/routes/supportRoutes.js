const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// All support routes require authentication
router.use(verifyToken);

// Create a new support ticket
router.post('/create', async (req, res) => {
    try {
        const { userId, userName, userEmail, userPhone, category, subject, description } = req.body;
        if (!userId || !subject || !description) {
            return res.status(400).json({ error: 'userId, subject and description are required' });
        }

        const ticket = new SupportTicket({
            userId, userName, userEmail, userPhone, category, subject, description
        });
        await ticket.save();
        res.status(201).json({ message: 'Support ticket created successfully', ticket });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all tickets for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get all tickets (Admin only)
router.get('/all', isAdmin, async (req, res) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 }).populate('userId', 'name email phone');
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

