const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// GET /api/config/appData
router.get('/appData', async (req, res) => {
    try {
        let config = await AppConfig.findOne();

        // If no config found in DB, return defaults or create one
        if (!config) {
            config = {
                latestVersion: '1.0.0',
                forceUpdate: false,
                updateUrl: 'market://details?id=com.smartsalon.app',
                updateMessage: 'A new version of SmartSalon is available. Update now to enjoy new features and improvements!'
            };
        }

        res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/config/admin/appData (Admin Only)
router.post('/admin/appData', verifyToken, isAdmin, async (req, res) => {
    try {
        const { latestVersion, forceUpdate, updateUrl, updateMessage } = req.body;

        let config = await AppConfig.findOne();
        if (config) {
            // Update existing
            config.latestVersion = latestVersion || config.latestVersion;
            if (forceUpdate !== undefined) config.forceUpdate = forceUpdate;
            config.updateUrl = updateUrl || config.updateUrl;
            config.updateMessage = updateMessage !== undefined ? updateMessage : config.updateMessage;
            await config.save();
        } else {
            // Create new
            config = await AppConfig.create({
                latestVersion: latestVersion || '1.0.0',
                forceUpdate: forceUpdate || false,
                updateUrl: updateUrl || 'market://details?id=com.smartsalon.app',
                updateMessage: updateMessage || 'A new version is available.'
            });
        }

        res.status(200).json({
            success: true,
            data: config,
            message: 'App settings updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error updating config' });
    }
});

module.exports = router;
