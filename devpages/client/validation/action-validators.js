// Generated from meta-language/core/actionSchema.yaml
// DO NOT EDIT MANUALLY - Run 'npm run generate-validators' to regenerate

/**
 * Runtime action and event validators
 */

class ActionValidationError extends Error {
    constructor(actionType, message) {
        super(`Invalid action '${actionType}': ${message}`);
        this.actionType = actionType;
    }
}

// ===== PAYLOAD VALIDATORS =====

export function validateFS_SET_TOP_DIRSPayload(payload) {
  // Validate payload for FS_SET_TOP_DIRS
  if (!Array.isArray(payload) || !payload.every(item => typeof item === 'string')) {
    throw new ActionValidationError(type, 'Payload must be an array of strings');
  }
  return true;
}

export function validateFS_LOAD_LISTING_STARTPayload(payload) {
  // Validate payload for FS_LOAD_LISTING_START
  // TODO: Add validation for type: { pathname: string }
  return true;
}

export function validateFS_LOAD_LISTING_SUCCESSPayload(payload) {
  // Validate payload for FS_LOAD_LISTING_SUCCESS
  // TODO: Add validation for type: { pathname: string, dirs: string[], files: string[] }
  return true;
}

export function validateFS_LOAD_LISTING_ERRORPayload(payload) {
  // Validate payload for FS_LOAD_LISTING_ERROR
  // TODO: Add validation for type: { pathname: string, error: string }
  return true;
}

export function validateFS_LOAD_FILE_STARTPayload(payload) {
  // Validate payload for FS_LOAD_FILE_START
  // TODO: Add validation for type: { pathname: string }
  return true;
}

export function validateFS_LOAD_FILE_SUCCESSPayload(payload) {
  // Validate payload for FS_LOAD_FILE_SUCCESS
  // TODO: Add validation for type: { pathname: string, content: string }
  return true;
}

export function validateFS_LOAD_FILE_ERRORPayload(payload) {
  // Validate payload for FS_LOAD_FILE_ERROR
  // TODO: Add validation for type: { pathname: string, error: string }
  return true;
}

export function validateFS_SAVE_FILE_STARTPayload(payload) {
  // Validate payload for FS_SAVE_FILE_START
  // TODO: Add validation for type: { pathname: string }
  return true;
}

export function validateFS_SAVE_FILE_SUCCESSPayload(payload) {
  // Validate payload for FS_SAVE_FILE_SUCCESS
  // TODO: Add validation for type: { pathname: string }
  return true;
}

export function validateFS_SAVE_FILE_ERRORPayload(payload) {
  // Validate payload for FS_SAVE_FILE_ERROR
  // TODO: Add validation for type: { pathname: string, error: string }
  return true;
}

export function validateFS_SET_CURRENT_PATHPayload(payload) {
  // Validate payload for FS_SET_CURRENT_PATH
  // TODO: Add validation for type: { pathname: string, isDirectory: boolean }
  return true;
}

export function validateFS_SET_CONTENTPayload(payload) {
  // Validate payload for FS_SET_CONTENT
  if (typeof payload !== 'string') throw new ActionValidationError(type, 'Payload must be a string');
  return true;
}

export function validateFS_CLEAR_ERRORPayload(payload) {
  // Validate payload for FS_CLEAR_ERROR
  // No payload validation needed
  return true;
}

export function validateFS_INIT_STARTPayload(payload) {
  // Validate payload for FS_INIT_START
  // No payload validation needed
  return true;
}

export function validateFS_INIT_COMPLETEPayload(payload) {
  // Validate payload for FS_INIT_COMPLETE
  // No payload validation needed
  return true;
}

export function validateAUTH_LOGIN_SUCCESSPayload(payload) {
  // Validate payload for AUTH_LOGIN_SUCCESS
  if (typeof payload !== 'object' || payload === null) {
    throw new ActionValidationError(type, 'Payload must be an object');
  }
  return true;
}

export function validateUI_SET_VIEW_MODEPayload(payload) {
  // Validate payload for UI_SET_VIEW_MODE
  if (typeof payload !== 'string') throw new ActionValidationError(type, 'Payload must be a string');
  return true;
}

// ===== MAIN VALIDATOR =====

export function validateAction(action) {
    if (!action || typeof action !== 'object') {
        throw new ActionValidationError('unknown', 'Action must be an object');
    }
    
    if (!action.type) {
        throw new ActionValidationError('unknown', 'Action must have a type property');
    }
    
    const { type, payload } = action;
    
    switch (type) {
        case 'FS_SET_TOP_DIRS':
            return validateFS_SET_TOP_DIRSPayload(payload);
        case 'FS_LOAD_LISTING_START':
            return validateFS_LOAD_LISTING_STARTPayload(payload);
        case 'FS_LOAD_LISTING_SUCCESS':
            return validateFS_LOAD_LISTING_SUCCESSPayload(payload);
        case 'FS_LOAD_LISTING_ERROR':
            return validateFS_LOAD_LISTING_ERRORPayload(payload);
        case 'FS_LOAD_FILE_START':
            return validateFS_LOAD_FILE_STARTPayload(payload);
        case 'FS_LOAD_FILE_SUCCESS':
            return validateFS_LOAD_FILE_SUCCESSPayload(payload);
        case 'FS_LOAD_FILE_ERROR':
            return validateFS_LOAD_FILE_ERRORPayload(payload);
        case 'FS_SAVE_FILE_START':
            return validateFS_SAVE_FILE_STARTPayload(payload);
        case 'FS_SAVE_FILE_SUCCESS':
            return validateFS_SAVE_FILE_SUCCESSPayload(payload);
        case 'FS_SAVE_FILE_ERROR':
            return validateFS_SAVE_FILE_ERRORPayload(payload);
        case 'FS_SET_CURRENT_PATH':
            return validateFS_SET_CURRENT_PATHPayload(payload);
        case 'FS_SET_CONTENT':
            return validateFS_SET_CONTENTPayload(payload);
        case 'FS_CLEAR_ERROR':
            return validateFS_CLEAR_ERRORPayload(payload);
        case 'FS_INIT_START':
            return validateFS_INIT_STARTPayload(payload);
        case 'FS_INIT_COMPLETE':
            return validateFS_INIT_COMPLETEPayload(payload);
        case 'AUTH_LOGIN_SUCCESS':
            return validateAUTH_LOGIN_SUCCESSPayload(payload);
        case 'UI_SET_VIEW_MODE':
            return validateUI_SET_VIEW_MODEPayload(payload);
        default:
            console.warn(`Unknown action type: ${type}`);
            return true; // Don't fail for unknown actions
    }
}

export { ActionValidationError };
