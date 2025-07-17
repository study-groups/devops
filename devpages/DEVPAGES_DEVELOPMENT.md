# DevPages Package Development Guide

This guide explains how to develop and update the DevPages package within your monorepo.

## 🚀 Quick Start

```bash
# Build the package
npm run devpages:build

# Update your app with latest changes
npm run devpages:update

# Start development with watch mode
npm run devpages:dev
```

## 📦 Available Scripts

### **Core Development Scripts**

| Script | Description | Usage |
|--------|-------------|--------|
| `npm run package:build` | Build the StateKit package | After making changes |
| `npm run package:dev` | Watch mode for development | During active development |
| `npm run package:test` | Run package tests | Before committing |
| `npm run package:update` | Update GitHub package in your app | After building changes |
| `npm run package:check` | Verify package is working | Troubleshooting |

### **Convenience Scripts**

| Script | Description | Equivalent To |
|--------|-------------|---------------|
| `npm run devpages:build` | Build package | `package:build` |
| `npm run devpages:update` | Build + Update | `package:build && package:update` |
| `npm run devpages:dev` | Watch mode | `package:dev` |

## 🔄 Development Workflow

### **1. Regular Development**
```bash
# Make changes to packages/devpages-statekit/src/
npm run devpages:update    # Build and update your app
# Test your changes in the app
```

### **2. Active Development (Watch Mode)**
```bash
npm run devpages:dev       # Starts watch mode
# Edit packages/devpages-statekit/src/ files
# Files rebuild automatically
# Run `npm run package:update` when ready to test
```

### **3. Testing Package Integration**
```bash
npm run package:check      # Verify package is working
npm run package:test       # Run package unit tests
npm test                   # Run app tests
```

## 📁 Project Structure

```
devpages/
├── package.json                    # 📦 Contains devpages dependency + scripts
├── packages/
│   └── devpages-statekit/         # 🔧 Your package development
│       ├── src/                   # ← Edit here
│       ├── dist/                  # ← Built by npm run package:build
│       └── package.json           # Individual package config
├── node_modules/
│   └── devpages/                  # 📚 Installed npm package
│       └── dist/                  # ← Used by your app
└── client/
    └── appState.js                # ← Imports from node_modules/devpages/
```

## ⚡ Quick Commands

```bash
# Build and test everything
npm run devpages:update && npm run package:check

# Start development session
npm run devpages:dev

# Check package is working
npm run package:check

# Full rebuild and update
npm run devpages:update
```

## 🚀 Publishing Workflow (GitHub)

```bash
# 1. Develop and test locally
npm run devpages:update
npm run package:check

# 2. Commit your changes to devops repo
git add packages/devpages-statekit/
git commit -m "feat: add new StateKit feature"

# 3. Push to devpages-package repo (via subtree when unified package is ready)
# This will push to: git@github.com:study-groups/devpages-package.git

# 4. Update your app to use new GitHub version
npm run package:update     # Reinstalls from GitHub
```

## 🔧 Troubleshooting

### **Package not updating?**
```bash
npm run package:check    # Verify current package
npm run devpages:update  # Force rebuild and update
```

### **Import errors?**
```bash
# Verify the import path in your app:
import { statekit } from 'devpages/dist/index.esm.js';
```

### **Build issues?**
```bash
cd packages/devpages-statekit/
npm install              # Ensure dependencies
npm run build           # Manual build
```

## 💡 Tips

- Use `npm run devpages:dev` for active development
- Use `npm run devpages:update` when you want to test changes
- Use `npm run package:check` to verify everything is working
- Your app automatically uses the package from `node_modules/devpages/` 