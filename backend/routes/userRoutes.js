const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// All user routes require authentication
router.use(verifyToken);

router.post('/:userId/favorites', userController.toggleFavorite);
router.get('/:userId/favorites', userController.getFavorites);

router.put('/:userId', userController.updateProfile);
router.get('/:userId', userController.getUserProfile);
router.delete('/:userId', userController.deleteAccount);

module.exports = router;

