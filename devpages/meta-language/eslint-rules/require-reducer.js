/**
 * ESLint Rule: require-reducer
 * Prevents dispatching actions that don't have corresponding reducer cases
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

let actionSchema = null;
let reducerCache = new Map();

function loadActionSchema() {
    if (actionSchema) return actionSchema;
    
    try {
        const schemaPath = path.resolve(process.cwd(), 'meta-language/core/actionSchema.yaml');
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        actionSchema = yaml.load(schemaContent);
        return actionSchema;
    } catch (error) {
        console.warn('Could not load action schema for ESLint rule:', error.message);
        return null;
    }
}

function findReducerForAction(actionName) {
    if (reducerCache.has(actionName)) {
        return reducerCache.get(actionName);
    }

    const schema = loadActionSchema();
    if (!schema?.domains) {
        reducerCache.set(actionName, null);
        return null;
    }

    // Find which domain this action belongs to
    for (const [domainName, domain] of Object.entries(schema.domains)) {
        if (domain.actions && domain.actions[actionName]) {
            const result = {
                domain: domainName,
                config: domain.actions[actionName]
            };
            reducerCache.set(actionName, result);
            return result;
        }
    }

    reducerCache.set(actionName, null);
    return null;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'enforce that dispatched actions have corresponding reducer cases',
            category: 'Possible Errors',
            recommended: true
        },
        fixable: null,
        schema: []
    },

    create(context) {
        return {
            CallExpression(node) {
                // Check for dispatch calls
                if (
                    node.callee.name === 'dispatch' ||
                    (node.callee.type === 'MemberExpression' && 
                     node.callee.property.name === 'dispatch')
                ) {
                    const actionArg = node.arguments[0];
                    if (!actionArg) return;

                    let actionType = null;

                    // Extract action type from different patterns
                    if (actionArg.type === 'ObjectExpression') {
                        // dispatch({ type: 'ACTION_NAME', ... })
                        const typeProp = actionArg.properties.find(
                            prop => prop.key && prop.key.name === 'type'
                        );
                        if (typeProp && typeProp.value.type === 'Literal') {
                            actionType = typeProp.value.value;
                        } else if (typeProp && typeProp.value.type === 'MemberExpression') {
                            // dispatch({ type: ActionTypes.ACTION_NAME })
                            if (typeProp.value.object.name === 'ActionTypes') {
                                actionType = typeProp.value.property.name;
                            }
                        }
                    } else if (actionArg.type === 'CallExpression') {
                        // dispatch(actionCreator())
                        const functionName = actionArg.callee.name;
                        if (functionName) {
                            // Try to map action creator to action type
                            // This is a simplified mapping - could be more sophisticated
                            actionType = functionName.toUpperCase();
                        }
                    }

                    if (actionType) {
                        const reducerInfo = findReducerForAction(actionType);
                        
                        if (reducerInfo && reducerInfo.config.reducer_required) {
                            // This action requires a reducer - verify it exists
                            const hasReducer = checkReducerExists(reducerInfo.domain, actionType);
                            
                            if (!hasReducer) {
                                context.report({
                                    node,
                                    message: `Action '${actionType}' is dispatched but has no reducer case in ${reducerInfo.domain} domain. Add a case for this action or mark reducer_required: false in schema.`
                                });
                            }
                        } else if (!reducerInfo) {
                            // Action not found in schema
                            context.report({
                                node,
                                message: `Action '${actionType}' is not defined in action schema. Add it to client/meta/actionSchema.yaml or use a defined action.`
                            });
                        }
                    }
                }
            }
        };
    }
};

function checkReducerExists(domainName, actionType) {
    try {
        // Look for reducer file
        const reducerPath = path.resolve(process.cwd(), `client/store/reducers/${domainName}Reducer.js`);
        
        if (!fs.existsSync(reducerPath)) {
            return false;
        }

        const reducerContent = fs.readFileSync(reducerPath, 'utf8');
        
        // Check if action is handled in reducer
        const patterns = [
            `case ActionTypes.${actionType}`,
            `case '${actionType}'`,
            `case "${actionType}"`,
            `'${actionType}':`,
            `"${actionType}":`
        ];

        return patterns.some(pattern => reducerContent.includes(pattern));
    } catch (error) {
        return false;
    }
} 