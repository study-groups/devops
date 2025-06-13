# DevPages CSS Handling Protocol

## Overview
This document establishes the comprehensive CSS handling protocol for DevPages, ensuring consistent, persistent, and properly applied CSS management across preview and publishing workflows.

## Core Principles

### 1. Separation of Concerns
- **Preview CSS**: Controls styling during live preview/editing
- **Publish CSS**: Controls styling for published/exported content
- **Settings Persistence**: All CSS settings persist across sessions via localStorage

### 2. CSS Bundling Strategy
- **Bundled Mode**: CSS content is inlined directly into HTML `<style>` tags
- **Linked Mode**: CSS files are referenced via external `<link>` tags with optional URL prefix
- **Default**: Bundling enabled for optimal sharing and portability

### 3. File Management
- **Root CSS**: `styles.css` - System default stylesheet (toggleable)
- **Custom CSS**: User-added CSS files with individual enable/disable controls
- **Active CSS**: Runtime list of currently applied CSS files

## State Structure

```javascript
settings: {
  preview: {
    cssFiles: [                    // Configured CSS files
      { path: "custom.css", enabled: true },
      { path: "theme.css", enabled: false }
    ],
    activeCssFiles: ["styles.css", "custom.css"], // Currently applied files
    enableRootCss: true,           // Include styles.css
    bundleCss: true,               // Bundle vs link mode
    cssPrefix: ""                  // URL prefix for linked mode
  },
  publish: {
    mode: "local",                 // "local" or "spaces"
    bundleCss: true               // Publish-specific bundling control
  }
}
```

## Implementation Components

### 1. Settings Panels
- **CssSettingsPanel**: Manages preview CSS configuration
- **PublishSettingsPanel**: Manages publish-specific CSS settings
- Both panels provide real-time UI updates and immediate persistence

### 2. State Management
- **ActionTypes**: Dedicated actions for all CSS operations
- **settingsReducer**: Handles state updates with localStorage persistence
- **appStore**: Central state management with subscription support

### 3. CSS Application
- **css.js plugin**: Applies CSS to preview in real-time
- **staticHtmlGenerator**: Handles CSS for published content
- **Automatic sync**: Settings changes immediately affect preview and publishing

## Workflow Processes

### Preview Workflow
1. User modifies CSS settings via CssSettingsPanel
2. Settings dispatched to reducer with immediate localStorage persistence
3. css.js plugin receives state update and applies changes to preview
4. Visual feedback provided through UI state updates

### Publishing Workflow
1. User initiates publish action
2. staticHtmlGenerator reads current CSS settings
3. **Bundled Mode**: CSS content fetched and inlined in `<style>` tags
4. **Linked Mode**: `<link>` tags generated with optional prefix
5. Complete HTML generated with appropriate CSS handling

## Persistence Strategy

### localStorage Keys
- `devpages_preview_css_files`: Configured CSS files array
- `devpages_enable_root_css`: Root CSS enable state
- `devpages_css_bundling_enabled`: Bundling preference
- `devpages_css_prefix`: URL prefix for linked mode
- `devpages_publish_mode`: Publish mode selection

### Initialization
- Settings loaded from localStorage on app startup
- Defaults applied for missing values
- State immediately synchronized with UI components

## CSS Processing Logic

### Bundled Mode (bundleCss: true)
```javascript
// Generate inline styles
const cssContent = await bundleActiveCss();
const htmlWithInlineCSS = `
<head>
  <style>
    ${cssContent}
  </style>
</head>`;
```

### Linked Mode (bundleCss: false)
```javascript
// Generate external links
const cssLinks = activeCssFiles.map(cssPath => {
  const fullPath = cssPrefix ? `${cssPrefix}${cssPath}` : cssPath;
  return `<link rel="stylesheet" href="${fullPath}">`;
}).join('\n');
```

## Error Handling

### CSS File Loading
- Failed CSS loads logged but don't break the process
- Missing files gracefully skipped
- User notified of loading issues via console/logs

### Settings Persistence
- localStorage failures logged but don't prevent operation
- Fallback to in-memory state if persistence fails
- Settings validation prevents invalid state

## UI/UX Guidelines

### Settings Panel Design
- Clear visual hierarchy with collapsible sections
- Real-time feedback for all setting changes
- Consistent styling with DevPages design language
- Intuitive controls with helpful descriptions

### Visual Indicators
- Color-coded status indicators for configuration states
- Smooth animations for state transitions
- Clear labeling and contextual help text
- Responsive design for various screen sizes

## API Integration

### CSS File Management
- Files loaded via `/api/file/read` endpoint
- Relative paths resolved against current working directory
- Content cached for performance optimization
- Error handling for network/file system issues

### Publishing Integration
- Settings respected during publish operations
- CSS handling mode determines output format
- Prefix application for external hosting scenarios
- Validation of CSS content before publishing

## Testing Strategy

### Unit Tests
- Settings reducer state transitions
- CSS bundling logic validation
- localStorage persistence verification
- Error handling edge cases

### Integration Tests
- End-to-end CSS application workflow
- Settings panel UI interactions
- Preview-to-publish consistency
- Cross-browser compatibility

## Migration & Compatibility

### Backward Compatibility
- Existing CSS files automatically migrated to new structure
- Default settings preserve current behavior
- Graceful handling of legacy localStorage data

### Version Updates
- Settings schema versioning for future changes
- Migration scripts for breaking changes
- Deprecation warnings for obsolete features

## Performance Considerations

### CSS Loading
- Parallel fetching of multiple CSS files
- Content caching to avoid redundant requests
- Debounced updates to prevent excessive re-rendering
- Lazy loading for large CSS files

### State Management
- Minimal state updates to prevent unnecessary re-renders
- Efficient diffing for array-based settings
- Subscription optimization for UI components

## Security Considerations

### CSS Content Validation
- Sanitization of user-provided CSS paths
- Prevention of path traversal attacks
- Content-type validation for CSS files
- XSS prevention in CSS content

### Settings Storage
- Validation of localStorage data integrity
- Prevention of malicious settings injection
- Secure handling of URL prefixes and paths

## Future Enhancements

### Planned Features
- CSS preprocessing support (SCSS, LESS)
- CSS minification for published content
- Theme management system
- CSS variable management
- Import/export of CSS configurations

### Extensibility
- Plugin architecture for CSS processors
- Custom CSS validation rules
- Third-party CSS library integration
- Advanced CSS optimization features

## Conclusion

This protocol ensures DevPages provides a robust, user-friendly, and maintainable CSS handling system that scales with user needs while maintaining simplicity and reliability. All implementations should adhere to these guidelines to ensure consistency and quality across the platform. 