# Nginx - Reverse Proxy & Spaces Management

Nginx reverse proxy configuration for local services and DigitalOcean Spaces integration.

## Quick Start

```bash
# Source tetra first
source ~/tetra/tetra.sh

# Configure reverse proxy for local service
nginx_config_proxy 3000 myapp.local

# Configure Spaces proxy
nginx_config_spaces mybucket nyc3

# Test configuration
nginx -t

# Reload nginx
nginx_reload
```

## Commands

### Proxy Configuration
- `nginx_config_proxy <port> [name]` - Configure reverse proxy for local service
- `nginx_config_spaces <space> [region]` - Configure DigitalOcean Spaces proxy

### Service Management
- `nginx -t` - Test configuration
- `nginx_reload` - Reload nginx
- `nginx_status` - Show nginx status

## REPL Mode

```bash
# Launch interactive REPL
bash nginx/nginx_repl.sh

nginx> config proxy 3000 myapp.local
nginx> test
nginx> reload
nginx> status
nginx> logs
nginx> help
nginx> quit
```

## Module Structure

- `includes.sh` - Module entry point, sets MOD_SRC/MOD_DIR
- `actions.sh` - TCS-compliant actions for TUI integration
- `nginx.sh` - Main nginx configuration functions
- `nginx_helpers.sh` - Helper utilities
- `nginx_repl.sh` - Interactive REPL
- `spaces_proxy.sh` - DigitalOcean Spaces proxy setup

## Configuration

Nginx configs are generated in:
- `$MOD_DIR/conf.d/` - Generated proxy configs
- `$MOD_DIR/logs/` - Module-specific logs

## See Also

- `README_SPACES.md` - DigitalOcean Spaces proxy guide
- `INVESTIGATION_GUIDE.md` - Troubleshooting nginx issues
- `REPL_USAGE.md` - Detailed REPL documentation
