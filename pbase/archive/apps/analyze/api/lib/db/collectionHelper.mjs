import { exists, createCollection, getSchema, updateCollection } from './db.mjs';

async function verifyCollections(collections) {
    const results = {
        verified: [],
        created: [],
        updated: [],
        failed: []
    };

    for (const collection of collections) {
        try {
            const collectionExists = await exists(collection.name);
            
            if (!collectionExists) {
                await createCollection(collection);
                results.created.push(collection.name);
            } else {
                const currentSchema = await getSchema(collection.name);
                if (needsUpdate(currentSchema, collection)) {
                    await updateCollection(collection);
                    results.updated.push(collection.name);
                } else {
                    results.verified.push(collection.name);
                }
            }
        } catch (error) {
            console.error('Error processing collection:', collection.name, error);
            results.failed.push({
                name: collection.name,
                error: error.message
            });
        }
    }

    return results;
}

function needsUpdate(current, target) {
    const currentFields = new Set(current.schema?.fields?.map(f => `${f.name}:${f.type}`));
    const targetFields = new Set(target.fields?.map(f => `${f.name}:${f.type}`));
    
    if (currentFields.size !== targetFields.size) return true;
    
    for (const field of targetFields) {
        if (!currentFields.has(field)) return true;
    }

    return current.listRule !== target.listRule ||
           current.viewRule !== target.viewRule ||
           current.createRule !== target.createRule ||
           current.updateRule !== target.updateRule ||
           current.deleteRule !== target.deleteRule;
}

const CollectionHelper = {
    verifyCollections,
    needsUpdate
};

export default CollectionHelper;
  