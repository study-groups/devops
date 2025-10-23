import PocketBase from 'pocketbase';

// Singleton connection management
let pbInstance = null;

export function getPocketBaseInstance() {
    if (!pbInstance) {
        const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
        pbInstance = new PocketBase(pbUrl);
    }
    return pbInstance;
}

// Enhanced authentication with retry logic
export async function authenticatePocketBase(retries = 3) {
    const pb = getPocketBaseInstance();
    const email = process.env.PB_EMAIL;
    const password = process.env.PB_PASSWORD;

    if (!email || !password) {
        throw new Error('PB_EMAIL or PB_PASSWORD not set in environment.');
    }

    for (let i = 0; i < retries; i++) {
        try {
            if (!pb.authStore.isValid) {
                await pb.admins.authWithPassword(email, password);
            }
            return pb;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Improved error handling wrapper with detailed logging
export const withErrorHandling = (fn) => async (...args) => {
    try {
        return await fn(...args);
    } catch (error) {
        console.error(`Error in ${fn.name}:`, {
            message: error.message,
            stack: error.stack,
            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
        });
        throw error;
    }
};

// Collection management functions
export const createCollection = async (config) => {
    const pb = await authenticatePocketBase();
    return await pb.collections.create(config);
};

export const exists = async (collectionName) => {
    try {
        const pb = await authenticatePocketBase();
        await pb.collections.getOne(collectionName);
        return true;
    } catch (error) {
        return false;
    }
};

export const getSchema = async (collectionName) => {
    const pb = await authenticatePocketBase();
    const collection = await pb.collections.getOne(collectionName);
    return {
        name: collection.name,
        schema: collection.schema,
        listRule: collection.listRule,
        viewRule: collection.viewRule,
        createRule: collection.createRule,
        updateRule: collection.updateRule,
        deleteRule: collection.deleteRule
    };
};

export const updateCollection = async (config) => {
    const pb = await authenticatePocketBase();
    const existing = await pb.collections.getOne(config.name);
    return await pb.collections.update(existing.id, config);
};

// Collection configurations
export const Collections = {
    HTML_OBJECTS: {
        name: 'html_objects',
        type: 'base',
        fields: [
            { name: 'pageUrl', type: 'url', required: true, unique: true },
            { name: 'treeMap', type: 'json', required: true },
            { name: 'nodes', type: 'json', required: true },
            { name: 'meta', type: 'json', required: true }
        ],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null
    }
};

// Database operations
export const DatabaseOperations = {
    createRecord: withErrorHandling(async (collectionName, data) => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).create(data);
    }),

    getRecord: withErrorHandling(async (collectionName, id) => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).getOne(id);
    }),

    updateRecord: withErrorHandling(async (collectionName, id, data) => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).update(id, data);
    }),

    deleteRecord: withErrorHandling(async (collectionName, id) => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).delete(id);
    }),

    listRecords: withErrorHandling(async (collectionName, page = 1, perPage = 50, options = {}) => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).getList(page, perPage, options);
    }),

    queryRecords: withErrorHandling(async (collectionName, filter, sort = '-created') => {
        const pb = await authenticatePocketBase();
        return await pb.collection(collectionName).getList(1, 50, {
            filter,
            sort
        });
    })
};
 
