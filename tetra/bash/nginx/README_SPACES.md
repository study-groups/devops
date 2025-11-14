# Tetra Nginx Spaces Proxy

Generate and deploy nginx configurations for DigitalOcean Spaces proxying.

## File Locations

### Where Configs Are Stored

**NO tetra.toml modifications** - nginx configs are stored separately:

```
~/tetra/orgs/<org-name>/nginx/
├── devpages.conf
├── tau.conf
├── pja-docs.conf
└── ...
```

Example for pixeljam-arcade org:
```
~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
```

### Remote Server Files (After Deploy)

```
/etc/nginx/sites-available/devpages.conf    # Config file
/etc/nginx/sites-enabled/devpages.conf      # Symlink to above
```

## Quick Reference

### Generate Config (Local Only)

```bash
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
```

**What it does:**
- Creates `~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf`
- NO remote changes
- NO tetra.toml changes

### Dry Run Deploy

```bash
tetra_nginx_spaces_deploy --dry-run devpages prod
```

**Shows:**
- Local file to be uploaded
- Remote paths that will be created
- Actions that would be performed
- NO actual changes

### Real Deploy

```bash
tetra_nginx_spaces_deploy devpages prod
```

**What it does:**
1. Uploads `~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf`
2. To remote: `/etc/nginx/sites-available/devpages.conf`
3. Creates symlink: `/etc/nginx/sites-enabled/devpages.conf`
4. Tests nginx: `nginx -t`
5. Reloads nginx: `systemctl reload nginx`

## Complete Example

```bash
# 1. Generate config (local)
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# Output shows:
#   ✓ Generated nginx config: ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
#   NO tetra.toml changes

# 2. Review the generated config
cat ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

# 3. Dry run to see what will happen
tetra_nginx_spaces_deploy --dry-run devpages prod

# Output shows:
#   LOCAL FILES:
#     Source config: ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
#   REMOTE SERVER: prod (root@137.x.x.x)
#     Target config: /etc/nginx/sites-available/devpages.conf
#     Symlink: /etc/nginx/sites-enabled/devpages.conf
#   NO tetra.toml CHANGES

# 4. Deploy for real
tetra_nginx_spaces_deploy devpages prod

# Output shows:
#   Deploying devpages.conf to prod...
#   ✓ Successfully deployed
```

## Generated Config Format

Each generated config follows this structure (matching your docs.conf):

```nginx
server {
    listen 80;
    listen 443 ssl;

    server_name devpages.pixeljamarcade.com;

    ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;

    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    location = / {
        return 301 /index.html;
    }

    location / {
        proxy_pass https://devpages.sfo3.digitaloceanspaces.com/;
        proxy_set_header Host devpages.sfo3.digitaloceanspaces.com;
        # ... proxy headers ...
    }
}
```

## SSL Certificates

All configs use the pixeljamarcade.com wildcard certificate:
```
ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;
```

This works for all `*.pixeljamarcade.com` subdomains.

## Multiple Configs

Create multiple configs for different doc sites:

```bash
# DevPages
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# Tau docs
tetra_nginx_spaces_config tau tau.pixeljamarcade.com sfo3

# PJA docs
tetra_nginx_spaces_config pja-docs docs.pixeljamarcade.com sfo3

# List all configs
tetra_nginx_spaces_list
```

All stored in: `~/tetra/orgs/pixeljam-arcade/nginx/*.conf`

## Environment Info

Environments are read from `tetra.toml`:
- SSH host, user, key
- NO nginx config stored in toml
- Toml only provides connection info

## Functions

- `tetra_nginx_spaces_config` - Generate config locally
- `tetra_nginx_spaces_deploy` - Deploy to remote server
- `tetra_nginx_spaces_list` - List local configs
- `tetra_nginx_spaces_wizard` - Interactive setup
- `tetra_nginx_spaces_proxy` - Output raw config (no file)
