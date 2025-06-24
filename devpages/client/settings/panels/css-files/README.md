# 🎨 CSS Files Panel

Modern PanelKit-based CSS file management panel for DevPages.

## 🚀 **Features**

### **Theme Files Management**
- **Auto-detection** of theme-related CSS files and inline styles
- **Toggle functionality** to enable/disable theme files
- **Visual indicators** for disabled files
- **Smart categorization** based on file paths and content

### **All Loaded CSS Browser**
- **Real-time scanning** of all CSS files loaded on the page
- **Statistics dashboard** showing total files, enabled files, and theme files
- **File type indicators** (link vs inline styles)
- **Theme file badges** for easy identification

### **CSS Viewer**
- **Modal viewer** for CSS file content
- **Syntax highlighting** with monospace font
- **Copy to clipboard** functionality
- **Responsive design** for mobile devices

## 🏗️ **Architecture**

### **PanelKit Integration**
- Uses modern PanelKit component system
- Registered with `panelRegistry`
- Integrates with `panelEventBus` for communication
- Custom components: `theme-file-manager` and `css-file-browser`

### **File Detection**
The panel intelligently detects theme files using:

**Path Patterns:**
- `/styles/` - Style directories
- `/theme` - Theme-related paths
- `design-system` - Design system files
- `settings*.css` - Settings CSS files
- `mermaid*.css` - Mermaid theme files
- `classic.css`, `system.css` - System theme files

**Content Keywords:**
- `:root` - CSS custom properties
- `--color`, `--theme` - CSS variables
- `design-token` - Design tokens
- `color-scheme` - Color scheme declarations
- `@media (prefers-color-scheme` - Dark mode queries

### **Real-time Updates**
- **Periodic scanning** every 5 seconds for dynamically loaded CSS
- **Event-driven updates** when files are toggled
- **State synchronization** with PanelKit system

## 🎯 **Usage**

### **Access the Panel**
1. Open DevPages Settings Panel
2. Navigate to **"CSS Files"** section
3. Expand **"Theme Files"** or **"All Loaded CSS Files"** subsections

### **Theme File Management**
- **Toggle switches** to enable/disable theme files
- **Eye icon** to view CSS content in modal
- **Visual feedback** for disabled files
- **File path display** with monospace font

### **CSS File Browser**
- **Statistics at top** showing file counts
- **Theme badges** for theme-related files
- **File type indicators** (LINK/INLINE)
- **Toggle and view controls** for each file

### **CSS Viewer Modal**
- **Click eye icon** on any file to view content
- **Copy button** to copy CSS to clipboard
- **Close button** or click outside to close
- **Keyboard accessible** with focus management

## 🎨 **Styling**

### **Theme Support**
- **CSS custom properties** for theming
- **Dark mode support** via `prefers-color-scheme`
- **Responsive design** for mobile devices
- **Hover effects** and smooth transitions

### **Visual Indicators**
- **Disabled files** show with reduced opacity and "DISABLED" badge
- **Theme files** have green left border and corner triangle
- **File types** are color-coded (LINK vs INLINE)
- **Toggle switches** with smooth animations

## 🔧 **Technical Details**

### **File Structure**
```
css-files/
├── CssFilesPanel.js     # Main panel logic (449 lines)
├── CssFilesPanel.css    # Panel styling (504 lines)
└── README.md           # This documentation
```

### **Key Classes**
- `CssFilesPanel` - Main panel class
- Custom components registered with PanelKit:
  - `theme-file-manager` - Theme files section
  - `css-file-browser` - All files browser

### **Data Structure**
```javascript
fileInfo = {
  element: HTMLElement,    // DOM element reference
  href: string,           // File URL or identifier
  id: string,             // Element ID
  type: 'link'|'inline',  // File type
  enabled: boolean,       // Current state
  isTheme: boolean,       // Theme file flag
  size: number|string,    // File size info
  loadTime: string        // Load timing info
}
```

### **Events**
- `css-file-toggled` - Fired when file is enabled/disabled
- `panel-data-changed` - Fired when panel data updates

## 🚦 **Comparison to Legacy System**

| Feature | Legacy CSS Panel | New CSS Files Panel |
|---------|------------------|---------------------|
| Architecture | Pre-PanelKit, compatibility issues | Modern PanelKit integration |
| File Detection | Manual configuration | Automatic scanning |
| Theme Support | Limited | Comprehensive theme detection |
| UI/UX | Basic functionality | Modern, responsive design |
| Real-time Updates | No | 5-second scanning interval |
| CSS Viewer | No | Full-featured modal viewer |
| Maintenance | High complexity | Clean, documented code |

## 🎉 **Benefits**

1. **Modern Architecture** - Built with PanelKit from the ground up
2. **Automatic Detection** - No manual CSS file configuration needed
3. **Real-time Monitoring** - Continuously scans for new CSS files
4. **Better UX** - Professional UI with smooth interactions
5. **Theme Awareness** - Intelligent theme file detection and management
6. **Developer Friendly** - Clean code with comprehensive documentation
7. **Mobile Responsive** - Works on all device sizes
8. **Accessibility** - Proper ARIA labels and keyboard navigation

This panel replaces the legacy CssSettingsPanel with a modern, feature-rich solution that provides everything you need for CSS file management in DevPages! 