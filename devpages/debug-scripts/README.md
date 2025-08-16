# Debug Scripts Directory

This directory contains Chrome DevTools console scripts for debugging DevPages functionality.

## 🚀 Quick Start

Copy and paste any of these scripts into the Chrome DevTools Console to debug specific issues.

## 📁 Available Scripts

### 1. `sidebar-toggle-debug.js`
**Purpose:** Debug sidebar toggle functionality
**Use Case:** When sidebar toggle buttons aren't working
**Key Features:**
- Redux state inspection
- DOM element verification
- Event listener testing
- Manual toggle function
- CSS class analysis

**Usage:**
```javascript
// Copy entire script into console, then use:
debugToggleSidebar()
```

### 2. `redux-state-inspector.js`
**Purpose:** Comprehensive Redux state debugging
**Use Case:** Understanding Redux state structure and changes
**Key Features:**
- Full state overview
- UI slice deep dive
- Action dispatcher testing
- State subscription monitoring
- Quick action tests

**Usage:**
```javascript
// Copy script into console, then use:
testToggleSidebar()
testShowSidebar()
testHideSidebar()
debugDispatch({ type: 'ui/toggleLeftSidebar' })
```

### 3. `dom-element-inspector.js`
**Purpose:** DOM element analysis and CSS debugging
**Use Case:** When elements aren't visible or positioned correctly
**Key Features:**
- Sidebar element inspection
- Toggle button analysis
- Workspace layout verification
- CSS class and style inspection
- Visibility checker

**Usage:**
```javascript
// Copy script into console, then use:
inspectElement('#left-sidebar')
testButtonClick('#sidebar-toggle-btn')
checkSidebarVisibility()
```

### 4. `event-listener-debugger.js`
**Purpose:** Event listener and click handler debugging
**Use Case:** When buttons don't respond to clicks
**Key Features:**
- Event listener tracking
- Click event interception
- Redux action monitoring
- PathManager component debugging
- Manual event triggering

**Usage:**
```javascript
// Copy script into console, then use:
debugButtonClicks()
debugPathManager()
triggerSidebarToggle()
startClickInterception() // Monitor all clicks
```

## 🔧 Common Debugging Workflow

1. **Start with Redux State Inspector**
   ```javascript
   // Check if Redux is working
   testToggleSidebar()
   ```

2. **Check DOM Elements**
   ```javascript
   // Verify elements exist and are styled correctly
   checkSidebarVisibility()
   inspectElement('#left-sidebar')
   ```

3. **Debug Event Listeners**
   ```javascript
   // Check if buttons have event listeners
   debugButtonClicks()
   startClickInterception()
   ```

4. **Test Sidebar Toggle Specifically**
   ```javascript
   // Comprehensive sidebar debugging
   debugToggleSidebar()
   triggerSidebarToggle()
   ```

## 🐛 Common Issues & Solutions

### Issue: Sidebar toggle button not working
**Scripts to use:** `sidebar-toggle-debug.js`, `event-listener-debugger.js`
**Check:**
- Button exists in DOM
- Button has event listeners
- Redux actions are dispatched
- CSS classes are applied

### Issue: Redux state not updating
**Scripts to use:** `redux-state-inspector.js`
**Check:**
- Store is available
- Actions are dispatched correctly
- State changes are reflected

### Issue: Elements not visible
**Scripts to use:** `dom-element-inspector.js`
**Check:**
- Element exists in DOM
- CSS display/visibility properties
- CSS classes are correct

## 💡 Tips

1. **Run scripts in order** - Start with Redux, then DOM, then events
2. **Check console output** - Scripts provide detailed logging
3. **Use browser dev tools** - Combine with Elements panel for CSS debugging
4. **Test incrementally** - Use individual functions to isolate issues

## 🔄 Script Updates

These scripts are designed to be:
- **Self-contained** - No external dependencies
- **Safe to run** - Won't break existing functionality
- **Informative** - Provide detailed console output
- **Interactive** - Expose helper functions for manual testing

Copy any script entirely into the Chrome DevTools Console and follow the usage instructions.
