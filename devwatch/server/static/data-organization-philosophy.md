# 📁 Data Organization Philosophy

## 🎯 The Challenge

We have **competing data placement philosophies** that need to be reconciled:

### 1. Standard Linux Convention (XDG Base Directory)
```bash
~/.local/share/pixeljam/          # Standard location
├── logs/                         # Application logs
├── screenshots/                  # Screenshot artifacts
└── screenshots-staging/          # Staging screenshots
```
**Pros:** Follows Linux standards, user-agnostic
**Cons:** Mixed with other app data, less organized for multi-project scenarios

### 2. org/type Convention (User Preference)  
```bash
~/pj/                            # ~user/org/type pattern
├── pd/ (primary data)           # User data, roles, uploads
├── pw/ (playwright data)        # Test reports, logs, screenshots
├── nvm/ (node version mgr)      # Node.js versions
├── pbase/ (database)            # Database-related files
└── pbvm/ (browser vm)           # Browser/VM related files
```
**Pros:** Clear separation by project type, easy to understand, scalable
**Cons:** Non-standard, requires documentation

## 🔧 Current Implementation

### What We Have:
- **PD_DIR** = `/home/dev/pj/pd` ✅ (properly set)
- **PW_DIR** = `(not set)` ❌ (defaults to source directory)
- **LOG_DIR** = `~/.local/share/pixeljam/logs` (mixed approach)

### What We Need:
- **PW_SRC** = `/home/dev/src/pixeljam/pja/arcade/playwright` (source/code)
- **PW_DIR** = `/home/dev/pj/pw` (data/artifacts)

## 🎯 Recommended Solution

**Follow the org/type convention for project-specific data:**

```bash
# Environment Variables
export PD_DIR=/home/dev/pj/pd      # Primary application data
export PW_DIR=/home/dev/pj/pw      # Playwright artifacts/data  
export LOG_DIR=/home/dev/pj/logs   # Unified logging (or keep ~/.local/share)

# Implicit Source Locations
PW_SRC=/home/dev/src/pixeljam/pja/arcade/playwright  # Source code
```

## 📊 Directory Mapping

### Data Directories (Artifacts, Results, User Data)
```bash
/home/dev/pj/
├── pd/                          # PD_DIR - Primary Data
│   ├── data/                    # Application data files
│   ├── uploads/                 # User uploads
│   ├── users.csv               # User database
│   └── roles.csv               # Role definitions
├── pw/                          # PW_DIR - Playwright Data  
│   ├── test-results/           # Test execution results
│   ├── reports/                # HTML reports
│   ├── screenshots/            # Test screenshots
│   ├── logs/                   # Playwright-specific logs
│   └── saved-tests/            # Saved test configurations
└── logs/                        # Unified logging (optional)
    ├── audit/                  # Audit trails
    ├── error/                  # Error logs
    └── access/                 # Access logs
```

### Source Directories (Code, Configuration)
```bash
/home/dev/src/pixeljam/pja/arcade/
├── playwright/                  # PW_SRC - Playwright Source
│   ├── tests/                  # Test source files
│   ├── server/                 # Admin server code
│   ├── reporters/              # Custom reporters
│   └── playwright.config.js   # Configuration
├── src/                        # Main application source
└── env/                        # Environment configurations
    ├── .env.dev                # Development environment
    ├── .env.staging            # Staging environment
```

## 🚀 Migration Strategy

### Phase 1: Fix Environment
```bash
# Add to env/dev.env
export PW_DIR=/home/dev/pj/pw
```

### Phase 2: Update Code References
- Ensure all Playwright tools use `PW_DIR` for data storage
- Use `process.cwd() + '/playwright'` or explicit paths for source references

### Phase 3: Consolidate Logging (Optional)
```bash
# Consider unifying logs
export LOG_DIR=/home/dev/pj/logs
```

## 🔍 Verification Commands

```bash
# Check current setup
echo "PW_DIR: $PW_DIR"
echo "PD_DIR: $PD_DIR" 
ls -la /home/dev/pj/pw/
ls -la /home/dev/pj/pd/

# Verify separation
echo "Source: /home/dev/src/pixeljam/pja/arcade/playwright"
echo "Data: $PW_DIR"
```

## 📝 Philosophy Decision: org/type Convention

**Chosen Approach:** Use the org/type convention (`~/pj/`) for project-specific data because:

1. **Clear Separation**: Each project type has its own directory
2. **Scalable**: Easy to add new project types (pb/, ska/, etc.)
3. **Intuitive**: Developers immediately understand the organization
4. **User-Centric**: Fits the multi-project development workflow
5. **Backup-Friendly**: Easy to backup/sync specific project data

**Exception:** Keep system-level logs in `~/.local/share/pixeljam/logs` if they're truly application-wide rather than project-specific.

---
**Decision Date:** 2024  
**Status:** Recommended Implementation  
**Next Review:** After implementation and user feedback