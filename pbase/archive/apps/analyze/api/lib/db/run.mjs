import CollectionHelper from './collectionHelper.mjs';
import { Collections } from './db.mjs';

async function runVerification() {
    try {
        const results = await CollectionHelper.verifyCollections([Collections.HTML_OBJECTS]);
        console.log('Verification Results:', results);
    } catch (error) {
        console.error('Error during verification:', error);
    }
}

runVerification();
