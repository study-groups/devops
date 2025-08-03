import { NlpManager } from 'node-nlp';
import fs from 'fs/promises';

class LclNlpManager {
    constructor() {
        this.manager = new NlpManager({ languages: ['en'], forceNER: true });
        console.log('[LclNlpManager] Initialized.');
    }

    async addDocument(lang, utterance, intent) {
        this.manager.addDocument(lang, utterance, intent);
    }

    async trainModel() {
        console.log('[LclNlpManager] Starting model training...');
        await this.manager.train();
        console.log('[LclNlpManager] Model training completed.');
    }

    clearDocuments() {
        // This is a bit of a workaround as node-nlp doesn't have a direct clear method
        this.manager.nlp.clear();
        console.log('[LclNlpManager] All documents cleared.');
    }

    listIntents() {
        return this.manager.nlp.getIntentDomainKeys('en');
    }

    listDocuments(intent = null) {
        const docs = this.manager.nlp.findAllDocuments('en');
        if (intent) {
            return docs.filter(d => d.intent === intent);
        }
        return docs;
    }

    async processQuery(text) {
        return this.manager.process('en', text);
    }

    async getIntents(text) {
        const result = await this.manager.process('en', text);
        return result.classifications;
    }
    
    async getEntities(text) {
        const result = await this.manager.process('en', text);
        return result.entities;
    }

    async saveModel(filePath) {
        await this.manager.save(filePath);
        console.log(`[LclNlpManager] Model saved to ${filePath}`);
    }

    async loadModel(filePath) {
        const modelData = await fs.readFile(filePath, 'utf-8');
        await this.manager.import(modelData);
        console.log(`[LclNlpManager] Model loaded from ${filePath}`);
    }

    getStats() {
        const intents = this.listIntents();
        const docs = this.listDocuments();
        return {
            intents: intents.length,
            documents: docs.length,
            languages: ['en']
        };
    }

    getInfo() {
        return this.manager.settings;
    }
    
    dump() {
        return this.manager.export();
    }
}

// Singleton instance
const lclNlpManager = new LclNlpManager();
export { lclNlpManager };
