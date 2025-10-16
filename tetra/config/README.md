# Tetra Configuration

Configuration file examples and documentation.

## Configuration Locations

Tetra uses a two-tier configuration system:

1. **Repo defaults**: `$TETRA_SRC/config/` (this directory)
2. **User overrides**: `$TETRA_DIR/config/` (typically `~/tetra/config/`)

User configs in `$TETRA_DIR/config/` take precedence over repo defaults.

## Configuration Files

### modules.conf

Controls which Tetra modules are loaded at startup.

**Format:**
```bash
module_name=on|off
# Also accepts: true/false, enabled/disabled, yes/no
```

**Location:**
- Example: `config/examples/modules.conf`
- User config: `$TETRA_DIR/config/modules.conf` (typically `~/tetra/config/modules.conf`)

**Essential modules** (always loaded):
- `utils` - Core utilities
- `prompt` - Shell prompt functionality

**Optional modules** (configure as needed):
- `tmod` - Module management
- `tsm` - Tetra Service Manager
- `tkm` - Tetra Key Manager
- `nvm` - Node Version Manager integration
- `python` - Python environment management
- `node` - Node.js integration
- `deploy` - Deployment tools
- `rag` - Retrieval tools (multicat, qpatch, etc.)
- `spaces` - Digital Ocean Spaces integration
- `pb` - Pocketbase integration
- `ssh` - SSH utilities
- `enc` - Encryption tools
- `sync` - Sync utilities

**Example:**
```bash
# Essential (always on)
utils=on
prompt=on

# Development tools
tmod=on
tsm=on
rag=on

# Optional features
deploy=off
tkm=off
```

### ports.toml

TSM (Tetra Service Manager) named port registry configuration.

**Location:**
- Example: `config/examples/ports.toml`
- User config: `$TETRA_DIR/config/ports.toml`

**Sections:**

#### [ports]
Named service port mappings. Allows referencing services by name instead of port number.

```toml
[ports]
devpages-dev = 4000
tetra-dev = 4444
arcade-dev = 5800
```

Usage: `tsm start devpages-dev` (uses port 4000)

#### [port_ranges]
Environment-specific port ranges for automatic allocation.

```toml
[port_ranges]
dev = "5000-5999"
staging = "6000-6999"
prod = "8000-8999"
proxy = "7000-7999"
```

#### [reserved]
Ports to avoid during auto-allocation.

```toml
[reserved]
system = [22, 80, 443, 3306, 5432, 6379, 27017]
development = [3000, 8080, 9000]
```

#### [allocation]
Port allocation strategy configuration.

```toml
[allocation]
min_port = 3000
max_port = 9999
allocation_strategy = "sequential"
auto_allocate = "true"
avoid_system_ports = "true"
```

#### [conflicts]
Conflict resolution settings.

```toml
[conflicts]
check_on_start = "true"
auto_resolve = "false"
prefer_named_services = "true"
```

## Setup

### Initial Configuration

1. Create user config directory:
   ```bash
   mkdir -p ~/tetra/config
   ```

2. Copy example configs:
   ```bash
   cp $TETRA_SRC/config/examples/modules.conf ~/tetra/config/
   cp $TETRA_SRC/config/examples/ports.toml ~/tetra/config/
   ```

3. Edit to match your needs:
   ```bash
   vim ~/tetra/config/modules.conf
   vim ~/tetra/config/ports.toml
   ```

### Module Management

Enable/disable modules without editing files:
```bash
# Enable module
tetra_module_enable tsm

# Disable module
tetra_module_disable deploy

# List enabled modules
tetra_get_enabled_modules
```

### Port Management

Manage named ports via TSM:
```bash
# Register a service with named port
tsm register myapp-dev --port 5555

# Start service by name (uses registered port)
tsm start myapp-dev

# List all named ports
tsm ports list
```

## Configuration Precedence

1. Command-line flags (highest priority)
2. `$TETRA_DIR/config/` user configs
3. `$TETRA_SRC/config/` repo defaults
4. Built-in defaults (lowest priority)

## Environment Variables

Key environment variables that affect configuration:

- `TETRA_DIR` - User data directory (default: `~/tetra`)
- `TETRA_SRC` - Tetra repo location (default: `~/src/devops/tetra`)
- `TETRA_DEBUG` - Enable debug output (set to `1`)
- `TETRA_BOOT_TRACE` - Enable boot tracing (set to `1`)

## Best Practices

1. **Never edit repo configs directly** - Always copy to `~/tetra/config/` and edit there
2. **Version control your user configs** - Consider symlinking `~/tetra/config/` to your dotfiles repo
3. **Start minimal** - Only enable modules you actually use
4. **Use named ports** - Easier to remember and manage than raw port numbers
5. **Document custom configs** - Add comments explaining why specific modules are enabled/disabled
