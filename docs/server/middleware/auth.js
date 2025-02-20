const basicAuth = require('basic-auth');
const { validateUser } = require('../utils/userUtils');

const authMiddleware = (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate using stored hash
    if (!validateUser(credentials.name, credentials.pass)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.auth = credentials;
    next();
};

module.exports = { authMiddleware }; 