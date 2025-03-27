const basicAuth = require('basic-auth');
const { validateUser, hashPassword } = require('../utils/userUtils');

const authMiddleware = (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate using stored hash
    if (!validateUser(credentials.name, credentials.pass)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Set both auth and user objects
    req.auth = credentials;
    req.user = { username: credentials.name };
    next();
};

module.exports = { authMiddleware }; 