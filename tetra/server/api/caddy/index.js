// Caddy API - Route aggregator
const router = require('express').Router();

router.use('/', require('./status'));
router.use('/', require('./logs'));
router.use('/', require('./config'));
router.use('/', require('./ban'));

module.exports = router;
