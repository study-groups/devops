// Generated from meta-language/core/actionSchema.yaml
// DO NOT EDIT MANUALLY - Run 'npm run generate-types' to regenerate

/* eslint-disable */

// ===== STATE SHAPES =====

export interface FileState {
  currentPathname: string | null;
  currentContent: string;
  isDirectorySelected: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isInitialized: boolean;
  currentListing: any;
  parentListing: any;
  availableTopLevelDirs: string[];
  error: string | null;
  navigationHistory: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: Record<string, any> | null;
  isInitializing: boolean;
}

// ===== ACTION TYPES =====

export type FileActionType = 'FS_SET_TOP_DIRS' | 'FS_LOAD_LISTING_START' | 'FS_LOAD_LISTING_SUCCESS' | 'FS_LOAD_LISTING_ERROR' | 'FS_LOAD_FILE_START' | 'FS_LOAD_FILE_SUCCESS' | 'FS_LOAD_FILE_ERROR' | 'FS_SAVE_FILE_START' | 'FS_SAVE_FILE_SUCCESS' | 'FS_SAVE_FILE_ERROR' | 'FS_SET_CURRENT_PATH' | 'FS_SET_CONTENT' | 'FS_CLEAR_ERROR' | 'FS_INIT_START' | 'FS_INIT_COMPLETE';
export type AuthActionType = 'AUTH_LOGIN_SUCCESS';
export type UiActionType = 'UI_SET_VIEW_MODE';

export type AllActionTypes = FileActionType | AuthActionType | UiActionType;

// ===== ACTION PAYLOADS =====

export interface FS_SET_TOP_DIRSPayload {
  payload: string[];
}

export interface FS_LOAD_LISTING_STARTPayload {
  payload: any;
}

export interface FS_LOAD_LISTING_SUCCESSPayload {
  payload: any;
}

export interface FS_LOAD_LISTING_ERRORPayload {
  payload: any;
}

export interface FS_LOAD_FILE_STARTPayload {
  payload: any;
}

export interface FS_LOAD_FILE_SUCCESSPayload {
  payload: any;
}

export interface FS_LOAD_FILE_ERRORPayload {
  payload: any;
}

export interface FS_SAVE_FILE_STARTPayload {
  payload: any;
}

export interface FS_SAVE_FILE_SUCCESSPayload {
  payload: any;
}

export interface FS_SAVE_FILE_ERRORPayload {
  payload: any;
}

export interface FS_SET_CURRENT_PATHPayload {
  payload: any;
}

export interface FS_SET_CONTENTPayload {
  payload: string;
}

export interface FS_CLEAR_ERRORPayload {
  payload: any;
}

export interface FS_INIT_STARTPayload {
  payload: any;
}

export interface FS_INIT_COMPLETEPayload {
  payload: any;
}

export interface AUTH_LOGIN_SUCCESSPayload {
  payload: any;
}

export interface UI_SET_VIEW_MODEPayload {
  payload: string;
}

// ===== EVENT PAYLOADS =====

export interface FileTopDirsLoadedEventPayload {
  payload: any;
}

export interface FileListingLoadedEventPayload {
  payload: any;
}

export interface FileFileLoadedEventPayload {
  payload: any;
}

export interface FileFileSavedEventPayload {
  payload: any;
}

export interface FilePathChangedEventPayload {
  payload: any;
}

export interface FileErrorEventPayload {
  payload: any;
}

export interface AuthLoginSuccessEventPayload {
  payload: any;
}

// ===== ROOT STATE =====

export interface RootState {
  file: FileState;
  auth: AuthState;
}

