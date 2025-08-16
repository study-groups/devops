// server/routes/routeUtils.js

/**
 * Helper function to create an auth token from a request object.
 * This is used to gather a user's full capabilities and mounts for an API response.
 * @param {object} req - The Express request object, containing req.user and req.pdata.
 * @returns {Promise<object>} An object containing the user's username, roles, capabilities, and mounts.
 */
export async function createAuthToken(req) {
    if (!req.user || !req.user.username) {
        throw new Error('User authentication data is missing from the request.');
    }
    const username = req.user.username;
    const userRoles = req.pdata.getUserRoles(username);
    return {
        username: username,
        roles: userRoles,
        caps: req.pdata.capabilityManager.expandRolesToCapabilities(userRoles),
        mounts: await req.pdata._createUnifiedMounts(username, userRoles)
    };
}
