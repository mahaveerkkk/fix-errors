const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const crmController = require('../controllers/crmController');

// GET /api/crm/:salonId/customers?filter=all|vip|regular|new|one_time|at_risk|lost|birthdays|top_spenders|viewers
router.get('/:salonId/customers', verifyToken, crmController.getSalonCustomers);

// POST /api/crm/:salonId/log-view — Log when a user views a salon profile
router.post('/:salonId/log-view', verifyToken, crmController.logSalonView);

module.exports = router;
