const express = require('express');
const router = express.Router();

/**
 * NH API - Node Holder infrastructure provisioning service
 * Manages server provisioning and infrastructure operations
 */
router.get('/status', (req, res) => {
    res.json({
        service: 'nh',
        status: 'active',
        servers: [],
        message: 'Infrastructure provisioning service'
    });
});

router.get('/servers', (req, res) => {
    res.json({
        servers: [
            {
                name: 'dev.pixeljamarcade.com',
                status: 'running',
                ip: 'pending',
                provider: 'digitalocean'
            }
        ]
    });
});

router.post('/provision', (req, res) => {
    res.json({
        message: 'Server provisioning requested',
        status: 'pending'
    });
});

module.exports = router;