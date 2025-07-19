# Action & Event Reference

*Generated from `meta-language/core/actionSchema.yaml`*

This document provides a complete reference for all actions and events in the DevPages application.

## File Domain

File system operations and directory/file path management

### Actions

#### `FS_SET_TOP_DIRS`

Set available top-level directories from API

- **Type**: dispatch
- **Payload**: `string[]`
- **Reducer Required**: Yes
- **Emits Events**: file:topDirsLoaded

#### `FS_LOAD_LISTING_START`

Start loading directory listing

- **Type**: dispatch
- **Payload**: `{ pathname: string }`
- **Reducer Required**: Yes

#### `FS_LOAD_LISTING_SUCCESS`

Successfully loaded directory listing

- **Type**: dispatch
- **Payload**: `{ pathname: string, dirs: string[], files: string[] }`
- **Reducer Required**: Yes
- **Emits Events**: file:listingLoaded

#### `FS_LOAD_LISTING_ERROR`

Error loading directory listing

- **Type**: dispatch
- **Payload**: `{ pathname: string, error: string }`
- **Reducer Required**: Yes
- **Emits Events**: file:error

#### `FS_LOAD_FILE_START`

Start loading file content

- **Type**: dispatch
- **Payload**: `{ pathname: string }`
- **Reducer Required**: Yes

#### `FS_LOAD_FILE_SUCCESS`

Successfully loaded file content

- **Type**: dispatch
- **Payload**: `{ pathname: string, content: string }`
- **Reducer Required**: Yes
- **Emits Events**: file:fileLoaded

#### `FS_LOAD_FILE_ERROR`

Error loading file content

- **Type**: dispatch
- **Payload**: `{ pathname: string, error: string }`
- **Reducer Required**: Yes
- **Emits Events**: file:error

#### `FS_SAVE_FILE_START`

Start saving file content

- **Type**: dispatch
- **Payload**: `{ pathname: string }`
- **Reducer Required**: Yes

#### `FS_SAVE_FILE_SUCCESS`

Successfully saved file content

- **Type**: dispatch
- **Payload**: `{ pathname: string }`
- **Reducer Required**: Yes
- **Emits Events**: file:fileSaved

#### `FS_SAVE_FILE_ERROR`

Error saving file content

- **Type**: dispatch
- **Payload**: `{ pathname: string, error: string }`
- **Reducer Required**: Yes
- **Emits Events**: file:error

#### `FS_SET_CURRENT_PATH`

Set current pathname and selection type

- **Type**: dispatch
- **Payload**: `{ pathname: string, isDirectory: boolean }`
- **Reducer Required**: Yes
- **Emits Events**: file:pathChanged

#### `FS_SET_CONTENT`

Update current file content in memory

- **Type**: dispatch
- **Payload**: `string`
- **Reducer Required**: Yes

#### `FS_CLEAR_ERROR`

Clear file system error state

- **Type**: dispatch
- **Payload**: `void`
- **Reducer Required**: Yes

#### `FS_INIT_START`

Start file system initialization

- **Type**: dispatch
- **Payload**: `void`
- **Reducer Required**: Yes

#### `FS_INIT_COMPLETE`

Complete file system initialization

- **Type**: dispatch
- **Payload**: `void`
- **Reducer Required**: Yes

### Events

#### `file:topDirsLoaded`

Top-level directories loaded and available

- **Type**: event
- **Payload**: `{ dirs: string[] }`
- **Listeners**: PathManagerComponent, FileBrowserPanel, DirectorySelector

#### `file:listingLoaded`

Directory listing loaded successfully

- **Type**: event
- **Payload**: `{ pathname: string, dirs: string[], files: string[] }`
- **Listeners**: PathManagerComponent, FileBrowserPanel, NavigationBreadcrumbs

#### `file:fileLoaded`

File content loaded successfully

- **Type**: event
- **Payload**: `{ pathname: string, content: string }`
- **Listeners**: EditorPanel, ContentPreview, FileStatusBar

#### `file:fileSaved`

File saved successfully

- **Type**: event
- **Payload**: `{ pathname: string }`
- **Listeners**: EditorPanel, FileStatusBar, NotificationSystem

#### `file:pathChanged`

Current path selection changed

- **Type**: event
- **Payload**: `{ pathname: string, isDirectory: boolean }`
- **Listeners**: PathManagerComponent, NavigationBreadcrumbs, UrlManager

#### `file:error`

File system operation error occurred

- **Type**: event
- **Payload**: `{ operation: string, pathname: string, error: string }`
- **Listeners**: ErrorHandler, NotificationSystem, FileStatusBar

## Auth Domain

Authentication state and operations

### Actions

#### `AUTH_LOGIN_SUCCESS`

No description provided

- **Type**: dispatch
- **Payload**: `{ user: object, token: string }`
- **Reducer Required**: Yes
- **Emits Events**: auth:loginSuccess

### Events

#### `auth:loginSuccess`

User successfully logged in

- **Type**: event
- **Payload**: `{ user: object }`
- **Listeners**: PathManagerComponent, FileBrowserPanel

## Ui Domain

UI state and interactions

### Actions

#### `UI_SET_VIEW_MODE`

No description provided

- **Type**: dispatch
- **Payload**: `string`
- **Reducer Required**: Yes

