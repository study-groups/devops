import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthService {
    constructor(config) {
        this.secret = config.jwtSecret;
        this.saltRounds = config.saltRounds || 12;
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    async validatePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    generateToken(userId, role) {
        return jwt.sign(
            { userId, role, iat: Date.now() },
            this.secret,
            { expiresIn: '24h' }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            return null;
        }
    }
}
