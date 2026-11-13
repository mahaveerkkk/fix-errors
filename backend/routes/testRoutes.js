const express = require('express');
const router = express.Router();

// Simple ping endpoint to check if server is reachable
router.get('/ping', (req, res) => {
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString(),
        status: 'online'
    });
});

module.exports = router;
