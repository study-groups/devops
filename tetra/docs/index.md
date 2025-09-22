# Tetra Documentation Index

Welcome to the Tetra infrastructure management system documentation.

## 📋 **Core Documentation**

### Current Status
- **[changes.md](changes.md)** - Current changes and recent implementations
- **[changes-past.md](changes-past.md)** - Historical change log and past developments
- **[next.md](next.md)** - Future roadmap, priorities, and planned features

## 🤖 **Assistant Resources**

### Core Guides
- **[guide.md](guide.md)** - LLM assistant interaction guide and workflow
- **[architecture.md](architecture.md)** - System architecture with tmod module focus

## 📂 **Documentation Sections**

### 🗂️ **Reference Materials**
**[reference/](reference/)** - Reference documentation
- **[manual/](reference/manual/)** - Complete user manual and guides
  - Module system documentation
  - Command references
  - Configuration guides
  - API documentation
- **[development/](reference/development/)** - Development guidance and patterns
  - Code request structuring
  - Anthropic + Tetra terminology
  - Module development patterns

### 🔧 **Workflow Documentation**
**[workflow/](workflow/)** - Process and workflow guides
- Deployment workflows
- Environment management processes
- Service lifecycle management
- Multi-organization workflows

### 📚 **Legacy Documentation**
**[legacy/](legacy/)** - Historical and legacy documentation
- Original documentation files
- Deprecated guides
- Archive materials

## 🎯 **Quick Start**

### Core Systems
- **tmod (Module Manager)** - System orchestrator with lazy loading and dependency management
- **TSM (Tetra Service Manager)** - Service lifecycle management with named ports
- **TDash** - Modal dashboard interface with dual-axis control
- **Organization Management** - Multi-client infrastructure support
- **Environment Management** - dev → staging → prod promotion workflow

### Key Commands
```bash
# Service Management
tsm start <service>              # Start service with auto-port resolution
tsm ports list                   # List named port registry
tsm enable <service>             # Enable service for automatic startup

# Dashboard
tdash                           # Launch modal dashboard

# Environment Management
tetra env promote dev staging    # Promote environment with adaptations
tetra org switch <organization>  # Switch between organizations
```

## 🏗️ **System Architecture**

### Module Structure
```
tetra/
├── bash/                   # Core modules and scripts
│   ├── tsm/               # Tetra Service Manager
│   ├── tdash/             # Dashboard system
│   ├── utils/             # Utility functions
│   └── boot/              # Bootloader and initialization
├── bin/                   # Executables and daemons
├── systemd/               # SystemD service files
├── templates/             # Service and configuration templates
└── tests/                 # Test suite
```

### Environment Structure
```
$TETRA_DIR/
├── config/
│   ├── tetra.toml         # Active organization config (symlink)
│   └── tetra/             # Tetra module storage
├── orgs/                  # Organization management
├── services/              # TSM service definitions
│   └── enabled/           # Enabled services (symlinks)
├── env/                   # Environment files
└── tsm/                   # TSM runtime data
    ├── logs/
    ├── pids/
    └── processes/
```

## 🔧 **Integration Points**

### Named Port Registry
Standard port assignments for consistent service management:
- **devpages: 4000** - Development pages
- **tetra: 4444** - Tetra system services
- **arcade: 8400** - Arcade gaming platform
- **pbase: 2600** - PocketBase database

### SystemD Integration
Production-ready daemon with:
- Automatic service discovery
- Graceful shutdown handling
- Service persistence across reboots
- Security hardening

### Multi-Organization Support
- Organization-specific configurations
- Seamless organization switching
- Environment-specific deployments
- Infrastructure isolation

## 🧪 **Testing**

### Test Suites
- **Systemd Integration** - Daemon and service management
- **TSM Service Management** - nginx-style enable/disable
- **Environment Management** - Promotion and validation
- **Template Validation** - Security and syntax checking

Run tests:
```bash
./tests/run_all_comprehensive_tests.sh
```

## 🚀 **Production Deployment**

### Linux SystemD Setup
```bash
# Install service
sudo ln -s $TETRA_SRC/systemd/tetra.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tetra.service
sudo systemctl start tetra.service

# Monitor
sudo systemctl status tetra.service
sudo journalctl -u tetra.service -f
```

### Development Setup
```bash
# Initialize Tetra environment
tetra setup

# Create development environment
tetra env init dev

# Start services
tsm start <service>

# Launch dashboard
tdash
```

---

## 📖 **Additional Resources**

- **Change History**: [changes-past.md](changes-past.md)
- **Future Plans**: [next.md](next.md)
- **Current Updates**: [changes.md](changes.md)
- **Workflow Guides**: [workflow/](workflow/)
- **Reference Manual**: [reference/manual/](reference/manual/)

*Last updated: 2025-09-21*