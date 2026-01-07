# 🗂️ Filesystem & Environment Monitor

A comprehensive monitoring system that provides complete visibility into your Playwright server's file system, environment variables, and runtime health.

## 🎯 Purpose

This monitoring system addresses the need for **data provenance transparency** - understanding exactly where your data lives on the file system and how environment variables connect to actual paths.

### Key Problems Solved:
- ❓ **"Where does pw_data actually live?"** - Now you see the exact resolved paths
- ❓ **"What does PW_DIR=/some/path mean?"** - See the full directory structure and contents  
- ❓ **"Which files were recently modified?"** - View the last 3 edited files under each directory
- ❓ **"Is the server healthy?"** - Real-time system health metrics

## 🚀 Features

### 1. Environment Configuration
- **Complete visibility** into all environment variables
- **Path resolution** - see exactly where env vars point on disk
- **Key variable highlighting** (PD_DIR, PW_DIR, LOG_DIR, PORT, etc.)
- **Security filtering** - sensitive values are hidden

### 2. Data Provenance 
- **Full file system mapping** with resolved paths
- **Directory existence verification** 
- **File and size statistics** for each key directory
- **Subdirectory analysis** with file counts and sizes

### 3. File Activity Monitoring
- **Recent file tracking** - last 3 edited files per directory
- **Cross-directory activity summary** - top 10 most recent files across all locations
- **File metadata** including size and modification time
- **Real-time updates** with auto-refresh capability

### 4. System Health Monitoring
- **Memory usage** with percentage and thresholds (warning >60%, error >80%)
- **Disk usage** with available space and usage percentages  
- **CPU information** including core count and architecture
- **System uptime** and load averages
- **Network interface details**

### 5. Process Information
- **Process details** (PID, parent PID, working directory)
- **Memory usage breakdown** (RSS, heap used/total)
- **Runtime versions** for all Node.js components
- **Environment summary** and command-line arguments

## 📁 File Structure

```
playwright/server/static/
├── filesystem-monitor.js        # Main monitoring module
├── filesystem-monitor.html      # Standalone HTML interface  
└── README-filesystem-monitor.md # This documentation

src/routes/api/admin/
└── filesystem/
    └── +server.js              # Comprehensive filesystem API endpoint
```

## 🔧 Technical Architecture

### Client-Side (`filesystem-monitor.js`)
- **Modular design** with separate sections for each monitoring area
- **Efficient caching** - single API call populates all data
- **Auto-refresh capability** with configurable intervals
- **Responsive UI** with real-time updates
- **Error handling** with user-friendly error messages

### Server-Side (`/api/admin/filesystem/+server.js`)
- **Comprehensive data collection** in a single API endpoint
- **Security filtering** for sensitive environment variables
- **Real file system analysis** with stats and recent file tracking
- **Performance optimized** with efficient directory scanning
- **Cross-platform compatibility** (Linux focus with fallbacks)

## 🌐 Usage

### Standalone Interface
Access the complete monitoring interface at:
```
http://your-server:port/playwright/server/static/filesystem-monitor.html
```

### Integration with Admin Dashboard
Include the monitoring module in existing admin interfaces:
```javascript
// Include the script
<script src="filesystem-monitor.js"></script>

// Initialize
const monitor = new FilesystemMonitor();
```

### API Endpoint
Get raw monitoring data:
```
GET /api/admin/filesystem
```

Returns comprehensive JSON with environment, directories, system health, and process information.

## 🎨 User Interface

### Key Features:
- **Dark theme** optimized for terminal/admin use
- **Color-coded status indicators** (green=good, orange=warning, red=error)
- **Collapsible sections** for organized information display
- **Keyboard shortcuts** (Ctrl+R refresh, Ctrl+A auto-refresh toggle)
- **Responsive design** that works on desktop and mobile

### Visual Indicators:
- 📁 **Directories** with full path resolution
- 📄 **Files** with size and modification time
- ✅ **Healthy status** / ❌ **Error conditions** 
- 📊 **Real-time metrics** with threshold-based coloring
- 🔄 **Loading states** and refresh indicators

## 🔧 Configuration

### Environment Variables Monitored:
```bash
# Primary data locations
PD_DIR=/home/dev/pj/pd                    # Main data directory
PW_DIR=/home/dev/src/pixeljam/pja/arcade  # Playwright working directory  
LOG_DIR=/home/dev/.local/share/pixeljam/logs  # Application logs

# Server configuration
PORT=8480                                 # Main server port
NODE_ENV=development                      # Runtime environment
USER=dev                                  # System user

# Storage configuration  
DO_SPACES_BUCKET=pja-games               # Game files bucket
AUDIT_BUCKET=pja-logs                    # Audit logs bucket
```

### Directory Structure Monitored:
- **Primary Data (PD_DIR)**: pw_data, logs, uploads, cache
- **Playwright Working (PW_DIR)**: test-results, playwright-report, screenshots, logs  
- **Application Logs (LOG_DIR)**: audit, error, access, archived
- **Workspace Root**: src, playwright, env, static, node_modules
- **System Temp**: OS temporary directory

## 🚀 Installation & Setup

1. **Copy files** to your Playwright server:
   ```bash
   # Copy monitoring files
   cp filesystem-monitor.js playwright/server/static/
   cp filesystem-monitor.html playwright/server/static/
   cp +server.js src/routes/api/admin/filesystem/
   ```

2. **Ensure API endpoint** is accessible:
   ```bash
   # Test the API
   curl http://localhost:8480/api/admin/filesystem
   ```

3. **Access the interface**:
   ```bash
   # Open in browser
   http://localhost:8480/playwright/server/static/filesystem-monitor.html
   ```

## 🔍 Troubleshooting

### Common Issues:

**"Failed to load environment data"**
- Check that `/api/admin/filesystem` endpoint is accessible
- Verify the SvelteKit server is running
- Check browser console for detailed error messages

**"Directory not accessible"**  
- Verify file system permissions for the user running Node.js
- Check that environment variables point to valid paths
- Ensure directories exist and are readable

**"System health data unavailable"**
- Some metrics require Linux/Unix systems
- Disk usage requires `df` command availability
- Memory stats should work on all Node.js platforms

### Debug Commands:
```javascript
// In browser console
fsMonitor.refresh()     // Manual refresh
fsMonitor.cache        // View cached data  
fsMonitor.toggle()     // Toggle auto-refresh
```

## 🔧 Customization

### Adding New Directories:
Edit the `getDirectoryInfo()` function in `+server.js`:
```javascript
directories['Your Custom Dir'] = {
    path: '/your/custom/path',
    description: 'Your directory description',
    envVar: 'YOUR_ENV_VAR',
    subDirs: ['sub1', 'sub2']
};
```

### Modifying Refresh Intervals:
```javascript
// In filesystem-monitor.js
this.refreshInterval = 30000; // 30 seconds (default)
```

### Adding Health Metrics:
Extend the `getSystemHealth()` function with additional metrics:
```javascript
health.yourMetric = await getYourCustomMetric();
```

## 📊 Data Flow

```mermaid
graph TD
    A[Browser Request] --> B[filesystem-monitor.js]
    B --> C[/api/admin/filesystem]
    C --> D[Environment Analysis]
    C --> E[Directory Scanning] 
    C --> F[System Health Check]
    C --> G[Process Information]
    D --> H[JSON Response]
    E --> H
    F --> H  
    G --> H
    H --> B
    B --> I[UI Rendering]
    I --> J[Data Visualization]
```

## 🎯 Future Enhancements

- **Real-time file watching** with WebSocket updates
- **Historical data tracking** and trend analysis
- **Alert system** for threshold breaches
- **Export functionality** for monitoring data
- **Integration with external monitoring** (Prometheus, etc.)
- **Mobile-optimized interface** improvements

---

**Created for:** Pixel Jam Arcade Playwright Administration  
**Purpose:** Complete data provenance and system transparency  
**Maintainer:** System Administration Team