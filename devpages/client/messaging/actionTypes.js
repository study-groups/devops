/**
 * client/messaging/actionTypes.js
 *
 * This file centralizes all action type constants for the application's
 * state management. By keeping them in a separate, dependency-free file,
 * we can avoid circular dependencies between reducers and action creators.
 */
export const ActionTypes = {
    // Auth Actions
    AUTH_INIT_START: 'AUTH_INIT_START',
    AUTH_INIT_COMPLETE: 'AUTH_INIT_COMPLETE',
    AUTH_LOGIN_REQUEST: 'AUTH_LOGIN_REQUEST',
    AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
    AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
    AUTH_LOGOUT: 'AUTH_LOGOUT',
    AUTH_SET_USER: 'AUTH_SET_USER',
    AUTH_CHECK_START: 'AUTH_CHECK_START',
    AUTH_CHECK_COMPLETE: 'AUTH_CHECK_COMPLETE',
    AUTH_LOGIN_REQUIRED: 'AUTH_LOGIN_REQUIRED',

    // UI Actions
    UI_SET_THEME: 'UI_SET_THEME',
    UI_SET_LOADING: 'UI_SET_LOADING',
    UI_TOGGLE_LOG: 'UI_TOGGLE_LOG',
    UI_SET_VIEW_MODE: 'UI_SET_VIEW_MODE',
    UI_SET_LOG_VISIBILITY: 'UI_SET_LOG_VISIBILITY',
    UI_SET_LOG_HEIGHT: 'UI_SET_LOG_HEIGHT',
    UI_TOGGLE_LOG_VISIBILITY: 'UI_TOGGLE_LOG_VISIBILITY',
    UI_TOGGLE_LOG_MENU: 'UI_TOGGLE_LOG_MENU',
    UI_TOGGLE_LEFT_SIDEBAR: 'UI_TOGGLE_LEFT_SIDEBAR',
    UI_TOGGLE_RIGHT_SIDEBAR: 'UI_TOGGLE_RIGHT_SIDEBAR',
    UI_TOGGLE_TEXT_VISIBILITY: 'UI_TOGGLE_TEXT_VISIBILITY',
    UI_TOGGLE_PREVIEW_VISIBILITY: 'UI_TOGGLE_PREVIEW_VISIBILITY',
    UI_APPLY_INITIAL_STATE: 'UI_APPLY_INITIAL_STATE',
    UI_SET_COLOR_SCHEME: 'UI_SET_COLOR_SCHEME',
    UI_SET_DESIGN_DENSITY: 'UI_SET_DESIGN_DENSITY',
    UI_TOGGLE_THEME: 'UI_TOGGLE_THEME',
    UI_SET_SIDEBAR_STATE: 'UI_SET_SIDEBAR_STATE',

    // Editor Actions
    EDITOR_SET_CONTENT: 'EDITOR_SET_CONTENT',
    EDITOR_SET_DIRTY: 'EDITOR_SET_DIRTY',

    // File System Actions
    FS_INIT_START: 'FS_INIT_START',
    FS_INIT_COMPLETE: 'FS_INIT_COMPLETE',
    FS_SET_STATE: 'FS_SET_STATE',
    FS_LOAD_TOP_DIRS_START: 'FS_LOAD_TOP_DIRS_START',
    FS_LOAD_TOP_DIRS_ERROR: 'FS_LOAD_TOP_DIRS_ERROR',
    FS_SET_TOP_DIRS: 'FS_SET_TOP_DIRS',
    FS_LOAD_LISTING_START: 'FS_LOAD_LISTING_START',
    FS_LOAD_LISTING_SUCCESS: 'FS_LOAD_LISTING_SUCCESS',
    FS_LOAD_LISTING_ERROR: 'FS_LOAD_LISTING_ERROR',
    FS_LOAD_FILE_START: 'FS_LOAD_FILE_START',
    FS_LOAD_FILE_SUCCESS: 'FS_LOAD_FILE_SUCCESS',
    FS_LOAD_FILE_ERROR: 'FS_LOAD_FILE_ERROR',
    FS_SAVE_FILE_START: 'FS_SAVE_FILE_START',
    FS_SAVE_FILE_SUCCESS: 'FS_SAVE_FILE_SUCCESS',
    FS_SAVE_FILE_ERROR: 'FS_SAVE_FILE_ERROR',
    FS_SET_PARENT_LISTING: 'FS_SET_PARENT_LISTING',
    FS_SET_CURRENT_PATH: 'FS_SET_CURRENT_PATH',
    FS_SET_CONTENT: 'FS_SET_CONTENT',
    FS_CLEAR_ERROR: 'FS_CLEAR_ERROR',

    // Settings Panel Actions
    SETTINGS_PANEL_TOGGLE: 'SETTINGS_PANEL_TOGGLE',
    SETTINGS_PANEL_SET_POSITION: 'SETTINGS_PANEL_SET_POSITION',
    SETTINGS_PANEL_SET_SIZE: 'SETTINGS_PANEL_SET_SIZE',
    SETTINGS_PANEL_SET_STATE: 'SETTINGS_PANEL_SET_STATE',
    SETTINGS_PANEL_TOGGLE_SECTION: 'SETTINGS_PANEL_TOGGLE_SECTION',
    SETTINGS_PANEL_SET_SECTION_STATE: 'SETTINGS_PANEL_SET_SECTION_STATE',
    SETTINGS_OPEN_PANEL: 'SETTINGS_OPEN_PANEL',

    // Debug Panel Actions
    DEBUG_PANEL_TOGGLE: 'DEBUG_PANEL_TOGGLE',
    DEBUG_PANEL_SET_POSITION: 'DEBUG_PANEL_SET_POSITION',
    DEBUG_PANEL_SET_SIZE: 'DEBUG_PANEL_SET_SIZE',
    DEBUG_PANEL_SET_STATE: 'DEBUG_PANEL_SET_STATE',
    DEBUG_PANEL_SET_ACTIVE_PANEL: 'DEBUG_PANEL_SET_ACTIVE_PANEL',
    DEBUG_PANEL_TOGGLE_SECTION: 'DEBUG_PANEL_TOGGLE_SECTION',
    DEBUG_PANEL_SET_PANEL_VISIBILITY: 'DEBUG_PANEL_SET_PANEL_VISIBILITY',
    DEBUG_PANEL_SET_PANEL_ENABLED: 'DEBUG_PANEL_SET_PANEL_ENABLED',
    DEBUG_PANEL_SET_PANEL_ORDER: 'DEBUG_PANEL_SET_PANEL_ORDER',
    DEBUG_PANEL_REORDER_PANELS: 'DEBUG_PANEL_REORDER_PANELS',
    DEBUG_PANEL_ADD_PANEL: 'DEBUG_PANEL_ADD_PANEL',
    DEBUG_PANEL_REMOVE_PANEL: 'DEBUG_PANEL_REMOVE_PANEL',

    // DOM Inspector Actions
    DOM_INSPECTOR_SET_STATE: 'DOM_INSPECTOR_SET_STATE',
    DOM_INSPECTOR_SET_VISIBLE: 'DOM_INSPECTOR_SET_VISIBLE',
    DOM_INSPECTOR_SET_POSITION: 'DOM_INSPECTOR_SET_POSITION',
    DOM_INSPECTOR_SET_SIZE: 'DOM_INSPECTOR_SET_SIZE',
    DOM_INSPECTOR_SET_SPLIT_POSITION: 'DOM_INSPECTOR_SET_SPLIT_POSITION',
    DOM_INSPECTOR_ADD_SELECTOR_HISTORY: 'DOM_INSPECTOR_ADD_SELECTOR_HISTORY',
    DOM_INSPECTOR_REMOVE_SELECTOR_HISTORY: 'DOM_INSPECTOR_REMOVE_SELECTOR_HISTORY',
    DOM_INSPECTOR_SET_SECTION_COLLAPSED: 'DOM_INSPECTOR_SET_SECTION_COLLAPSED',
    DOM_INSPECTOR_SET_TREE_STATE: 'DOM_INSPECTOR_SET_TREE_STATE',
    DOM_INSPECTOR_SET_STYLE_FILTER_GROUP: 'DOM_INSPECTOR_SET_STYLE_FILTER_GROUP',
    DOM_INSPECTOR_SET_STYLE_FILTER_ENABLED: 'DOM_INSPECTOR_SET_STYLE_FILTER_ENABLED',
    DOM_INSPECTOR_SET_HIGHLIGHT: 'DOM_INSPECTOR_SET_HIGHLIGHT',
    DOM_INSPECTOR_SET_SELECTED_ELEMENT: 'DOM_INSPECTOR_SET_SELECTED_ELEMENT',

    // Log Actions
    LOG_ADD_ENTRY: 'LOG_ADD_ENTRY',
    LOG_CLEAR: 'LOG_CLEAR',
    LOG_SET_FILTERS: 'LOG_SET_FILTERS',
    LOG_INIT_TYPES: 'LOG_INIT_TYPES',

    // Plugin Actions
    PLUGINS_SET_STATE: 'PLUGINS_SET_STATE',
    PLUGINS_SET_SETTING: 'PLUGINS_SET_SETTING',
    PLUGINS_RESET_ALL: 'PLUGINS_RESET_ALL',

    // General Settings Actions
    SETTINGS_SET_SELECTED_ORG: 'SETTINGS_SET_SELECTED_ORG',
    SETTINGS_ADD_PREVIEW_CSS: 'SETTINGS_ADD_PREVIEW_CSS',
    SETTINGS_REMOVE_PREVIEW_CSS: 'SETTINGS_REMOVE_PREVIEW_CSS',
    SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED: 'SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED',
    SETTINGS_SET_ACTIVE_PREVIEW_CSS: 'SETTINGS_SET_ACTIVE_PREVIEW_CSS',
    SETTINGS_SET_PREVIEW_CSS_FILES: 'SETTINGS_SET_PREVIEW_CSS_FILES',
    SETTINGS_SET_ROOT_CSS_ENABLED: 'SETTINGS_SET_ROOT_CSS_ENABLED',
    SETTINGS_SET_CSS_BUNDLING_ENABLED: 'SETTINGS_SET_CSS_BUNDLING_ENABLED',
    SETTINGS_SET_PUBLISH_CSS_BUNDLING: 'SETTINGS_SET_PUBLISH_CSS_BUNDLING',
    SETTINGS_SET_CURRENT_CONTEXT: 'SETTINGS_SET_CURRENT_CONTEXT',

    // Theme Settings Actions
    SETTINGS_SET_ACTIVE_DESIGN_THEME: 'SETTINGS_SET_ACTIVE_DESIGN_THEME',
    SETTINGS_SET_DESIGN_THEME_VARIANT: 'SETTINGS_SET_DESIGN_THEME_VARIANT',
    SETTINGS_SET_ACTIVE_ICON_SET: 'SETTINGS_SET_ACTIVE_ICON_SET',
    SETTINGS_SET_THEME_FILE_CORE: 'SETTINGS_SET_THEME_FILE_CORE',
    SETTINGS_SET_THEME_FILE_LIGHT: 'SETTINGS_SET_THEME_FILE_LIGHT',
    SETTINGS_SET_THEME_FILE_DARK: 'SETTINGS_SET_THEME_FILE_DARK',
    SETTINGS_SET_SPACING_VARIANT: 'SETTINGS_SET_SPACING_VARIANT',
    SETTINGS_SET_DESIGN_TOKENS_DIR: 'SETTINGS_SET_DESIGN_TOKENS_DIR',

    // SmartCopy Actions
    SET_SMART_COPY_A: 'SET_SMART_COPY_A',
    SET_SMART_COPY_B: 'SET_SMART_COPY_B',

    // Workspace Actions
    WORKSPACE_SET_PANEL_VISIBILITY: 'WORKSPACE_SET_PANEL_VISIBILITY',
    WORKSPACE_SET_PANEL_WIDTH: 'WORKSPACE_SET_PANEL_WIDTH',

    // Panel Manager Actions
    PANELS_SET_VISIBILITY: 'PANELS_SET_VISIBILITY',
    PANELS_SET_WIDTH: 'PANELS_SET_WIDTH',

    // Panel Actions (for individual panel management)
    PANEL_TOGGLE_VISIBILITY: 'PANEL_TOGGLE_VISIBILITY',
    PANEL_SET_STATE: 'PANEL_SET_STATE',
    PANEL_SET_WIDTH: 'PANEL_SET_WIDTH',
    PANEL_SHOW: 'PANEL_SHOW',
    PANEL_HIDE: 'PANEL_HIDE',

    // Generic state set (use with caution)
    SET_STATE: 'SET_STATE',

    // Settings Actions
    SETTINGS_UPDATE_PREVIEW: 'SETTINGS_UPDATE_PREVIEW',
    SETTINGS_RESET_PREVIEW: 'SETTINGS_RESET_PREVIEW',
}; 