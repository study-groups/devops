# TSM Caddy Integration

Caddy reverse proxy integration for TSM services. Routes `servicename.localhost` to TSM-managed ports.

## Overview

```
Browser → driftbox.localhost:80 → Caddy → 127.0.0.1:4004 (TSM service)
```

Each org maintains its own Caddyfile, and a master Caddyfile imports all org configs.

## Structure

```
~/tetra/
├── caddy/
│   └── Caddyfile                    # Master config (imports org configs)
└── orgs/
    ├── tetra/
    │   └── caddy/
    │       ├── Caddyfile            # Org-specific routes
    │       └── domain.conf          # Org domain settings
    └── plenith/
        └── caddy/
            ├── Caddyfile
            └── domain.conf
```

## Quick Start

```bash
# 1. Install Caddy
brew install caddy

# 2. Initialize for your org
tsm caddy init tetra

# 3. Start some services
tsm start http              # Starts on port 8000
tsm start quasar            # Starts on port 1985

# 4. Sync routes from running services
tsm caddy sync tetra

# 5. Start Caddy
tsm caddy start

# 6. Access via hostname
curl http://http.localhost
curl http://quasar.localhost
```

## Commands

| Command | Description |
|---------|-------------|
| `tsm caddy init [org]` | Initialize caddy structure for org |
| `tsm caddy sync [org]` | Generate Caddyfile from running services |
| `tsm caddy sync-all` | Sync all orgs |
| `tsm caddy add <svc> <port> [org]` | Add single route |
| `tsm caddy rm <svc> [org]` | Remove route |
| `tsm caddy status [org]` | Show current routes |
| `tsm caddy edit [org]` | Edit org's Caddyfile in $EDITOR |
| `tsm caddy start` | Start Caddy daemon |
| `tsm caddy stop` | Stop Caddy daemon |
| `tsm caddy reload` | Reload Caddy config |

## Configuration

### Master Caddyfile

`~/tetra/caddy/Caddyfile`:
```caddy
{
    auto_https off
    admin localhost:2019
}

# Import all org configs
import ../orgs/*/caddy/Caddyfile
```

### Org Caddyfile

`~/tetra/orgs/tetra/caddy/Caddyfile`:
```caddy
# Caddy routes for org: tetra
# Domain: localhost
# Auto-generated: 2024-12-18T10:30:00

driftbox.localhost {
    reverse_proxy localhost:4004
}

quasar.localhost {
    reverse_proxy localhost:1985
}
```

### Domain Configuration

`~/tetra/orgs/tetra/caddy/domain.conf`:
```bash
# Development
CADDY_DOMAIN="localhost"

# Staging
# CADDY_DOMAIN="tetra.dev"

# Production
# CADDY_DOMAIN="example.com"
```

When `CADDY_DOMAIN` changes, regenerate with `tsm caddy sync`.

## Workflows

### Development (localhost)

```bash
# Default domain is localhost
tsm caddy init tetra
tsm caddy sync tetra
tsm caddy start

# Access services
open http://myapp.localhost
```

### Staging/Production

```bash
# Edit domain config
echo 'CADDY_DOMAIN="staging.example.com"' > ~/tetra/orgs/tetra/caddy/domain.conf

# Regenerate routes
tsm caddy sync tetra

# Routes now use staging domain
# myapp.staging.example.com → localhost:8000
```

### Manual Route Management

```bash
# Add route without full sync
tsm caddy add myapp 8080 tetra

# Remove route
tsm caddy rm myapp tetra

# Edit directly
tsm caddy edit tetra
```

### Multi-Org Setup

```bash
# Initialize multiple orgs
tsm caddy init tetra
tsm caddy init plenith
tsm caddy init clientA

# Each org can have different domains
echo 'CADDY_DOMAIN="localhost"' > ~/tetra/orgs/tetra/caddy/domain.conf
echo 'CADDY_DOMAIN="plenith.local"' > ~/tetra/orgs/plenith/caddy/domain.conf

# Sync all at once
tsm caddy sync-all

# Single Caddy instance serves all orgs
tsm caddy start
```

## How It Works

### Route Generation

When you run `tsm caddy sync`, the module:

1. Reads the org's `domain.conf` for the base domain
2. Scans `$TSM_PROCESSES_DIR` for running services
3. Matches services to the org's `services-available/*.tsm` definitions
4. Generates Caddyfile entries: `{service}.{domain} → localhost:{port}`
5. Reloads Caddy if running

### Service Matching

Only services defined in the org's `services-available/` directory are included. This prevents cross-org route pollution.

```
~/tetra/orgs/tetra/tsm/services-available/
├── http.tsm          → http.localhost
├── quasar.tsm        → quasar.localhost
└── driftbox.tsm      → driftbox.localhost
```

### Browser DNS Resolution

Modern browsers (Chrome, Firefox) resolve `*.localhost` to `127.0.0.1` automatically per RFC 6761. No `/etc/hosts` editing required.

For custom domains like `.local` or `.dev`, you may need:
- dnsmasq for wildcard DNS
- Manual `/etc/hosts` entries

## Advanced Configuration

### Custom Caddyfile Entries

Edit the org's Caddyfile directly for advanced config:

```bash
tsm caddy edit tetra
```

```caddy
# Auto-generated routes above...

# Custom: WebSocket support
myapp.localhost {
    reverse_proxy localhost:3000

    @websockets {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websockets localhost:3000
}

# Custom: Static files with caching
static.localhost {
    root * /var/www/static
    file_server
    header Cache-Control "max-age=3600"
}
```

### HTTPS in Development

```caddy
{
    # Enable auto HTTPS with local CA
    local_certs
}

myapp.localhost {
    tls internal
    reverse_proxy localhost:3000
}
```

### Load Balancing

```caddy
api.localhost {
    reverse_proxy localhost:3001 localhost:3002 localhost:3003 {
        lb_policy round_robin
        health_uri /health
    }
}
```

## Troubleshooting

### Caddy won't start

```bash
# Check if port 80 is in use
tsm doctor port 80

# Start on different port
caddy run --config ~/tetra/caddy/Caddyfile --adapter caddyfile --watch &
```

### Routes not working

```bash
# Check Caddy status
tsm caddy status

# Verify service is running
tsm ls

# Test direct connection
curl http://localhost:8000

# Test via Caddy
curl -H "Host: myapp.localhost" http://localhost:80
```

### Browser not resolving *.localhost

Some browsers or systems don't resolve `*.localhost`. Options:

1. Add to `/etc/hosts`:
   ```
   127.0.0.1  myapp.localhost
   ```

2. Use nip.io (no config needed):
   ```
   http://myapp.127.0.0.1.nip.io
   ```

3. Install dnsmasq for wildcard:
   ```bash
   brew install dnsmasq
   echo "address=/localhost/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf
   sudo brew services start dnsmasq
   ```

### Sync not finding services

Services must be:
1. Defined in `~/tetra/orgs/{org}/tsm/services-available/*.tsm`
2. Currently running (visible in `tsm ls`)
3. Have a valid port in metadata

```bash
# Check service definition exists
ls ~/tetra/orgs/tetra/tsm/services-available/

# Check service is running
tsm ls

# Check metadata has port
cat ~/tetra/tsm/runtime/processes/myapp-8000/meta.json | jq .port
```

## Integration with Deploy

For production deployments, Caddy config can be generated as part of the deploy process:

```bash
# In deploy script
deploy_generate_caddy() {
    local app="$1"
    local port="$2"
    local domain="$3"

    tsm caddy add "$app" "$port" "$ORG"
}
```

See `deploy/deploy_transport.sh` for full integration.
