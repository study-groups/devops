/**
 * Admin Routes - User and permission management
 * Works with PData for user management
 */

import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { getAllPermissions } from '../lib/permissions.js';

export function createAdminRoutes(pdata) {
    const router = Router();

    /**
     * GET /api/admin/users
     * List all users
     */
    router.get('/users', requirePermission(pdata, 'can_admin'), (req, res) => {
        try {
            const usersWithRoles = pdata.listUsersWithRoles();
            const users = Object.entries(usersWithRoles).map(([username, role]) => ({
                username,
                role,
            }));
            res.json({ count: users.length, users });
        } catch (err) {
            console.error('[Admin] List users error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * POST /api/admin/users
     * Add new user
     */
    router.post('/users', requirePermission(pdata, 'can_admin'), async (req, res) => {
        try {
            const { username, password, role } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'username and password required',
                });
            }

            await pdata.addUser(username, password, role || 'user');

            res.status(201).json({
                success: true,
                message: 'User created',
                user: { username, role: role || 'user' },
            });
        } catch (err) {
            console.error('[Admin] Add user error:', err);
            res.status(400).json({
                error: 'Bad Request',
                message: err.message,
            });
        }
    });

    /**
     * PUT /api/admin/users/:username
     * Update user (password or role)
     */
    router.put('/users/:username', requirePermission(pdata, 'can_admin'), async (req, res) => {
        try {
            const { username } = req.params;
            const { password, role } = req.body;

            if (password) {
                await pdata.updatePassword(username, password);
            }

            if (role) {
                await pdata.setUserRole(username, role);
            }

            res.json({
                success: true,
                message: 'User updated',
                username,
            });
        } catch (err) {
            console.error('[Admin] Update user error:', err);
            res.status(400).json({
                error: 'Bad Request',
                message: err.message,
            });
        }
    });

    /**
     * DELETE /api/admin/users/:username
     * Delete user
     */
    router.delete('/users/:username', requirePermission(pdata, 'can_admin'), async (req, res) => {
        try {
            const { username } = req.params;

            // Prevent deleting self
            if (req.user.username === username) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Cannot delete yourself',
                });
            }

            await pdata.deleteUser(username);

            res.json({
                success: true,
                message: 'User deleted',
                username,
            });
        } catch (err) {
            console.error('[Admin] Delete user error:', err);
            res.status(400).json({
                error: 'Bad Request',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/admin/permissions
     * List all permission sets (from permissions.csv)
     */
    router.get('/permissions', requirePermission(pdata, 'can_admin'), (req, res) => {
        res.json({ permissions: getAllPermissions(), roles: pdata.getAllowedRoles() });
    });

    return router;
}
