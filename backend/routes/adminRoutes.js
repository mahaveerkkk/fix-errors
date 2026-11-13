const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Public Routes
router.get('/plans', adminController.getPlans);

// PROTECTED ROUTES (Admin Only)
// Apply verifyToken first, then isAdmin
router.use(verifyToken);
router.use(isAdmin);

router.get('/salons', adminController.getAllSalons);
router.post('/block-salon', adminController.updateSalonStatus);
router.get('/earnings', adminController.getPlatformEarnings);

// Plan Routes (Access restricted for modification)
router.post('/plans', adminController.createPlan);
// router.get('/plans', adminController.getPlans); // MOVED UP
router.put('/plans/:id', adminController.updatePlan);

router.delete('/plans/:id', adminController.deletePlan);

module.exports = router;
