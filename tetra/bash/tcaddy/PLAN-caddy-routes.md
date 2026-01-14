# Plan: Adding Routes to Connect Caddy to Backend Services

## Overview

Connect Caddy reverse proxy to backend services (e.g., arcade on port 8081) so they're accessible via domain names with automatic HTTPS.

## Current State

- **Caddy**: Running on dev.pixeljamarcade.com (v2.10.2, systemd)
- **Config**: `/etc/caddy/Caddyfile` with 8+ subdomains configured
- **Arcade**: Running on port 8081 via TSM (`arcade-8081`)
- **Pattern**: Manual Caddyfile entries, no automated route management on remote

## Goal

1. Add `arcade` route: `dev.pixeljamarcade.com` → `localhost:8081`
2. Establish repeatable pattern for adding new services
3. Integrate with deploy workflow

---

## Implementation Steps

### Step 1: Update Remote Caddyfile for Arcade

Edit `/etc/caddy/Caddyfile` on dev server to route main domain to arcade:

```caddy
dev.pixeljamarcade.com {
    # Arcade SvelteKit app (port 8081)
    reverse_proxy localhost:8081

    # Existing routes can be preserved or migrated
    # handle /admin/tetra/* { ... }

    log {
        output file /var/log/caddy/dev.pixeljamarcade.com.log {
            roll_size 10mb
            roll_keep 5
        }
        format json
    }
}
```

### Step 2: Create Route Management Script

Add `scripts/caddy-routes.sh` or extend `caddy.sh` module:

```bash
# Add a route to remote Caddyfile
caddy_add_route() {
    local domain="$1"      # e.g., dev.pixeljamarcade.com
    local upstream="$2"    # e.g., localhost:8081
    local ssh="$3"         # e.g., root@dev.pixeljamarcade.com

    # Generate route block
    # Append to Caddyfile
    # Validate and reload
}
```

### Step 3: Define Service-to-Route Mapping

In each service's `.tsm` file or in `tetra-deploy.toml`:

```toml
# arcade tetra-deploy.toml
[caddy]
domain = "dev.pixeljamarcade.com"
upstream = "localhost:8081"
```

Or in `arcade.tsm`:
```bash
TSM_CADDY_DOMAIN="dev.pixeljamarcade.com"
TSM_CADDY_UPSTREAM="localhost:8081"
```

### Step 4: Integrate with Deploy Pipeline

Update `scripts/deploy.sh` to include Caddy route setup:

```bash
# After service restart
case "$PIPELINE" in
    default)
        # ... existing steps ...
        run_remote "caddy reload"  # or route-specific update
        ;;
esac
```

### Step 5: Support Multiple Environments

Route mapping per environment:

| Env | Domain | Upstream |
|-----|--------|----------|
| dev | dev.pixeljamarcade.com | localhost:8081 |
| staging | staging.pixeljamarcade.com | localhost:8081 |
| prod | pixeljamarcade.com | localhost:8081 |

---

## Implementation Options

### Option A: Manual Caddyfile Management (Simple)

- Edit Caddyfile directly on server
- Use `caddy validate` and `caddy reload`
- Pros: Simple, full control
- Cons: Manual, no automation

### Option B: Template-Based Generation (Moderate)

- Store route templates in repo
- Generate Caddyfile from templates + service configs
- Deploy via `scp` + `caddy reload`
- Pros: Version controlled, repeatable
- Cons: Requires template system

### Option C: Caddy API Integration (Advanced)

- Use Caddy's admin API (localhost:2019)
- Add/remove routes dynamically via JSON
- Pros: No file editing, instant updates
- Cons: More complex, state not in files

**Recommendation**: Start with Option A, evolve to Option B.

---

## Specific Changes for Arcade

### Current: Port 8480 (old SvelteKit)
```caddy
dev.pixeljamarcade.com {
    reverse_proxy localhost:8480
}
```

### Target: Port 8081 (arcade via TSM)
```caddy
dev.pixeljamarcade.com {
    reverse_proxy localhost:8081
}
```

### Commands to Execute

```bash
# 1. SSH to server
ssh root@dev.pixeljamarcade.com

# 2. Edit Caddyfile
vim /etc/caddy/Caddyfile
# Change: localhost:8480 → localhost:8081

# 3. Validate
caddy validate --config /etc/caddy/Caddyfile

# 4. Reload
systemctl reload caddy

# 5. Verify
curl -I https://dev.pixeljamarcade.com/
```

---

## Future Enhancements

1. **Auto-discovery**: TSM services auto-register Caddy routes
2. **Health checks**: Caddy health_uri integration with TSM
3. **SSL per-service**: Separate certs for different services
4. **Load balancing**: Multiple upstreams for HA
5. **Metrics**: Caddy metrics exposed to monitoring

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/etc/caddy/Caddyfile` (remote) | Modify | Update arcade upstream |
| `bash/tcaddy/caddy.sh` | Enhance | Add `caddy route add/rm` commands |
| `arcade/tetra-deploy.toml` | Add | `[caddy]` section for route config |
| `arcade/scripts/deploy.sh` | Add | Caddy reload step |

## Success Criteria

- [ ] `https://dev.pixeljamarcade.com/` serves arcade app
- [ ] `caddy route list` shows arcade mapping
- [ ] Deploy script includes Caddy reload
- [ ] Pattern documented for adding new services
