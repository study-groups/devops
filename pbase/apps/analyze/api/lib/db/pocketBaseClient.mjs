import PocketBase from 'pocketbase';
import os from 'os';
import fetch from 'node-fetch';

// Helper function for human readable memory size
const formatBytes = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return {
        value: Math.round(size * 1000) / 1000,
        unit: units[unitIndex],
        readable: `${(Math.round(size * 1000) / 1000)}${units[unitIndex]}`
    };
};

class PocketBaseClient {
    static pb = new PocketBase(process.env.PB_URL || 'http://localhost:8090');
    static isAuthenticated = false;

    static async ensureAuthenticated() {
        if (this.isAuthenticated) {
            return;
        }

        const email = process.env.PB_EMAIL;
        const password = process.env.PB_PASSWORD;

        if (!email || !password) {
            throw new Error('PocketBase admin credentials not configured. Please set PB_EMAIL and PB_PASSWORD');
        }

        try {
            await this.pb.admins.authWithPassword(email, password);
            this.isAuthenticated = true;
            console.log('Successfully authenticated with PocketBase');
        } catch (error) {
            console.error('PocketBase authentication failed:', error);
            throw new Error('Failed to authenticate with PocketBase');
        }
    }

    static async getAllCollections(type = 'all') {
        try {
            await this.ensureAuthenticated();
            const collections = await this.pb.collections.getFullList({
                fields: '*,schema.*,indexes.*'
            });

            const filteredCollections = collections.filter(collection => {
                switch(type) {
                    case 'system':
                        return collection.system;
                    case 'user':
                        return !collection.system;
                    case 'all':
                    default:
                        return true;
                }
            });

            return filteredCollections.map(collection => ({
                id: collection.id,
                name: collection.name,
                type: collection.type,
                system: collection.system,
                schema: collection.schema,
                indexes: collection.indexes,
                listRule: collection.listRule,
                viewRule: collection.viewRule,
                createRule: collection.createRule,
                updateRule: collection.updateRule,
                deleteRule: collection.deleteRule,
                options: {
                    allowEmailAuth: collection.options?.allowEmailAuth,
                    allowOAuth2Auth: collection.options?.allowOAuth2Auth,
                    allowUsernameAuth: collection.options?.allowUsernameAuth,
                    minPasswordLength: collection.options?.minPasswordLength
                }
            }));
        } catch (error) {
            console.error('Error fetching collections:', error);
            throw error;
        }
    }

    static async storeAnalysisResult(url, analysisResult) {
        try {
            await this.ensureAuthenticated();

            // Validate required fields
            if (!url) {
                throw new Error('URL is required');
            }
            if (!analysisResult.treeMap) {
                throw new Error('treeMap is required');
            }
            if (!analysisResult.nodes) {
                throw new Error('nodes is required');
            }

            const record = await this.pb.collection('html_objects').create({
                pageUrl: url,
                treeMap: analysisResult.treeMap,
                nodes: analysisResult.nodes,
                meta: analysisResult.meta || {} // Provide default empty object for optional field
            });

            return record;
        } catch (error) {
            console.error('Error storing analysis result:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }

    static async getMostRecentAnalysis() {
        console.log('Fetching most recent analysis...');
        try {
            await this.ensureAuthenticated();
            const records = await this.pb.collection('html_objects').getList(1, 1, {
                sort: '-created'
            });
            return records.items[0] || null;
        } catch (error) {
            console.error('Error getting recent analysis:', error);
            throw error;
        }
    }

    static async getCollectionSchema(identifier) {
        try {
            await this.ensureAuthenticated();
            
            console.log('Fetching schema for:', identifier);
            
            let collection;
            try {
                // Use the Admin API to get full collection details
                const response = await fetch(`${process.env.PB_URL}/api/collections/${identifier}`, {
                    headers: {
                        'Authorization': this.pb.authStore.token
                    }
                });
                
                if (!response.ok) {
                    // Try finding by name if ID lookup fails
                    const collections = await this.pb.collections.getFullList();
                    collection = collections.find(c => c.name === identifier);
                    if (!collection) {
                        throw new Error('Collection not found');
                    }
                    // Get full details for the found collection
                    const detailResponse = await fetch(`${process.env.PB_URL}/api/collections/${collection.id}`, {
                        headers: {
                            'Authorization': this.pb.authStore.token
                        }
                    });
                    collection = await detailResponse.json();
                } else {
                    collection = await response.json();
                }
            } catch (error) {
                console.error('Error fetching collection:', error);
                throw new Error('Failed to fetch collection details');
            }

            console.log('Raw collection data:', collection);

            // Get the full schema details, using fields instead of schema
            const schemaDetails = {
                id: collection.id,
                name: collection.name,
                type: collection.type || 'base',
                system: collection.system || false,
                schema: collection.fields ? collection.fields.map(field => ({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    system: field.system || false,
                    required: field.required || false,
                    unique: field.primaryKey || false,
                    options: {
                        hidden: field.hidden,
                        presentable: field.presentable,
                        ...field
                    }
                })) : [],
                indexes: collection.indexes || [],
                created: collection.created,
                updated: collection.updated,
                rules: {
                    listRule: collection.listRule,
                    viewRule: collection.viewRule,
                    createRule: collection.createRule,
                    updateRule: collection.updateRule,
                    deleteRule: collection.deleteRule
                }
            };

            console.log('Returning schema details for:', collection.name, {
                schemaFieldCount: schemaDetails.schema.length,
                indexCount: schemaDetails.indexes.length,
                fieldNames: schemaDetails.schema ? schemaDetails.schema.map(f => f.name) : []
            });

            return schemaDetails;

        } catch (error) {
            console.error('Error fetching collection schema:', error);
            throw error;
        }
    }

    static async getCollectionSummary(identifier) {
        try {
            const schema = await this.getCollectionSchema(identifier);
            
            // Create a simplified summary with field details
            const summary = {
                name: schema.name,
                fields: schema.schema.map(field => ({
                    name: field.name,
                    type: field.type,
                    required: field.required,
                    system: field.system
                })),
                stats: {
                    totalFields: schema.schema.length,
                    requiredFields: schema.schema.filter(f => f.required).length,
                    systemFields: schema.schema.filter(f => f.system).length,
                    typeCount: schema.schema.reduce((acc, field) => {
                        acc[field.type] = (acc[field.type] || 0) + 1;
                        return acc;
                    }, {})
                },
                rules: {
                    hasListRule: !!schema.rules.listRule,
                    hasViewRule: !!schema.rules.viewRule,
                    hasCreateRule: !!schema.rules.createRule,
                    hasUpdateRule: !!schema.rules.updateRule,
                    hasDeleteRule: !!schema.rules.deleteRule
                }
            };

            return summary;

        } catch (error) {
            console.error('Error getting collection summary:', error);
            throw error;
        }
    }

    static async updateCollection(identifier, updates) {
        try {
            await this.ensureAuthenticated();
            
            // First get the current collection
            const currentSchema = await this.getCollectionSchema(identifier);
            
            // Find the field to rename
            const updatedFields = currentSchema.schema.map(field => {
                if (field.name === 'dataStore') {
                    return {
                        ...field,
                        name: 'nodes'
                    };
                }
                return field;
            });

            // Prepare the update payload
            const updateData = {
                name: currentSchema.name,
                type: currentSchema.type,
                system: currentSchema.system,
                schema: updatedFields,
                listRule: currentSchema.rules.listRule,
                viewRule: currentSchema.rules.viewRule,
                createRule: currentSchema.rules.createRule,
                updateRule: currentSchema.rules.updateRule,
                deleteRule: currentSchema.rules.deleteRule
            };

            // Send update request
            const response = await fetch(`${process.env.PB_URL}/api/collections/${currentSchema.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': this.pb.authStore.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`Failed to update collection: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating collection:', error);
            throw error;
        }
    }
}

export default PocketBaseClient; 