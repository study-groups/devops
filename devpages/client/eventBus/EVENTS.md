# DevPages Event Reference Table

This document provides a consolidated reference of all events in the DevPages event system, showing actual handler functions and implementation details.

## Event System Overview

Each row in this table represents an event in the system with detailed information about:
- **Event Name**: The full event name using the `domain:action` pattern
- **Description**: What the event does or represents
- **Publisher**: Which component(s) emit this event and in what circumstances
- **Subscribers**: The actual handler functions that listen for this event
- **Implementation Notes**: Key details about how the event is used in practice

## Complete Event Reference

| Event Name | Description | Publisher | Subscribers | Implementation Notes |
|------------|-------------|-----------|-------------|----------------------|
| `editor:initialized` | Editor component ready | `editor.js` when component mount completes | Preview component initialization | Signals that the editor is ready to accept content |
| `editor:contentChanged` | Content has changed | `editor.js` on keyup, paste events<br>`editorActions.js` after paste operations | `preview.js` → Anonymous handler updating preview<br>`preview.js:handleContentChange()` | Triggers markdown rendering in preview pane<br>Data: `{ content: string }` |
| `editor:save` | Save request | `editor.js` from keyboard shortcut Ctrl+S | `fileManager.js:handleFileSave()` | Doesn't contain file path; current file retrieved from state |
| `editor:focus` | Editor gained focus | `editor.js` on textarea focus event | None identified | Could be used for UI state updates |
| `editor:blur` | Editor lost focus | `editor.js` on textarea blur event | None identified | Could be used for UI state updates |
| `editor:setSelectionStateA` | SmartCopy buffer A set | `editor.js:setSelectionBufferA()` | None identified | Used for SmartCopy feature<br>Data: `{ text, selectionStart, selectionEnd }` |
| `editor:setSelectionStateB` | SmartCopy buffer B set | `editor.js:setSelectionBufferB()` | None identified | Used for SmartCopy feature<br>Data: `{ text, selectionStart, selectionEnd }` |
| `navigate:pathname` | Navigate to path | `ContextManagerComponent.js` file/folder click handlers | `fileManager.js:handleNavigateToPathname()`<br>`publishButton.js` anonymous handler | Used for relative path navigation<br>Data: `{ pathname, isDirectory }` |
| `navigate:absolute` | Navigate with components | `uiManager.js` breadcrumb clicks<br>`deepLink.js` URL parsing | `fileManager.js` handlers | Used for absolute path navigation with separate dir/path/file<br>Data: `{ dir, path, file }` |
| `navigate:root` | Go to root directory | `uiManager.js` home button click | `fileManager.js` handlers | Simple navigation to root with no parameters |
| `file:save` | Save file request | `ContextManagerComponent.js` save button | `fileManager.js:handleFileSave()` | UI-triggered save (vs. editor:save from keyboard) |
| `file:loaded` | File load completed | `fileManager.js` after successful file load | Editor content handlers<br>Preview updaters | Published after file content retrieved<br>Data: `{ content, metadata }` |
| `file:saved` | File save completed | `fileManager.js` after successful save | Editor state updaters<br>Status indicators | Used to update UI after save<br>Data: `{ pathname }` |
| `ui:renderFileList` | Re-render file list | `uiManager.js` navigation updates | UI components | Triggers refresh of directory listings |
| `ui:viewModeChanged` | View mode changed | `uiReducer.js` after viewMode state change | `preview.js` layout handlers | Updates layout between editor/preview/split modes<br>Data: viewMode string |
| `auth:loginRequested` | Login attempt | `LoginForm.js` submit handler<br>`authActions.js` login action | `auth.js` anonymous login handler | Initiates authentication flow<br>Data: `{ username, password }` |
| `image:uploaded` | Image upload success | `imageManager.js` after upload | Editor handlers | Used to insert image markdown<br>Data: `{ url, filename }` |
| `image:uploadError` | Image upload failed | `imageManager.js` on error | Error handlers | Error reporting<br>Data: `{ filename, error }` |
| `image:deleted` | Image deleted | `imageActions.js:deleteImage()` | UI refresh handlers | Triggers page reload to refresh image list<br>Data: `{ imageName }` |
| `image:deleteError` | Image delete failed | `imageActions.js:deleteImage()` | Error handlers | Error reporting<br>Data: `{ imageName, error }` |
| `preview:initialized` | Preview ready | `preview.js` after initialization | None identified | Signals preview component is ready |
| `preview:updated` | Preview content updated | `preview.js` after rendering | None identified | Used for tracking render completion<br>Data: `{ content, frontMatter }` |
| `preview:cssSettingsChanged` | CSS settings changed | `settingsReducer.js` CSS settings update | `preview/index.js:cssSettingsListener()` | Triggers refresh of preview styles |
| `app:ready` | App initialization done | `bootstrap.js` after core load | None identified | Application is fully initialized and ready |
| `layout:logResized` | Log panel resized | `logPanelEvents.js` resize handlers | Layout managers | Updates UI layout when log size changes<br>Data: `{ height }` |
| `context:requestParentListing` | Load parent directory | `ContextManagerComponent.js` navigation | Directory listing handlers | Used for building navigation context<br>Data: `{ parentPath, triggerPath }` |
| `cli:ready` | CLI system initialized | `cli/index.js` initialization | None identified | CLI subsystem is ready for commands<br>Data: `{ timestamp }` |
| `button:clicked` | Button click occurred | `buttons.js` click handlers | Action handlers | Generic button click event<br>Data: `{ buttonId, data }` |
| `publish:request` | Publish current file | Not identified in codebase | `publishButton.js:handlePublishRequest()` | Initiates file publishing process |

## Event Flow Examples

### File Save Flow
```
[User presses Ctrl+S] → editor.js → 'editor:save' → fileManager.js:handleFileSave() 
→ [Save operation] → 'file:saved' → [UI updates]
```

### Content Change Flow
```
[User types in editor] → editor.js → 'editor:contentChanged' → preview.js:handleContentChange() 
→ [Markdown rendering] → 'preview:updated'
```

### Navigation Flow
```
[User clicks directory] → ContextManagerComponent.js → 'navigate:pathname' 
→ fileManager.js:handleNavigateToPathname() → [Load directory] → 'ui:renderFileList'
```

## Best Practices

1. **Consistent Naming**: Follow the `domain:action` pattern
2. **Payload Design**: Include only necessary data, with consistent property names
3. **Error Handling**: Always wrap event handlers in try/catch
4. **Cleanup**: Unsubscribe handlers when components unmount
5. **Documentation**: Update this table when adding new events

## Event Naming Convention

Events in DevPages follow a consistent naming convention:

```
domain:action
```

Where:
- `domain` is the area of functionality (editor, file, auth, etc.)
- `action` is what happened or what is requested (initialized, contentChanged, save, etc.)

## Example Usage

```javascript
// Subscribe to an event
eventBus.on('editor:contentChanged', (data) => {
  console.log('Editor content changed:', data.content);
  updatePreview(data.content);
});

// Emit an event
eventBus.emit('editor:contentChanged', { 
  content: textarea.value,
  timestamp: Date.now()
});
``` 