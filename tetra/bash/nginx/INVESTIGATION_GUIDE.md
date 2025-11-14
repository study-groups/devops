# Investigation Guide - Preview Before You Deploy

Complete guide for investigating what commands will do before executing them.

## Three-Stage Preview Process

### Stage 1: Preview Config Generation (No Files Written)

```bash
# Preview what config would be generated
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com sfo3
```

**Output shows:**
- What bucket/domain/region will be used
- The Spaces host that will be proxied
- Where the config file would be written
- Whether it will create or overwrite
- **The actual nginx config content** (full preview)
- NO FILES ARE WRITTEN

**Example output:**
```
=== Nginx Config Generation ===

CONFIGURATION:
  Bucket:      devpages
  Domain:      devpages.pixeljamarcade.com
  Region:      sfo3
  Config name: devpages

SPACES HOST:
  devpages.sfo3.digitaloceanspaces.com

OUTPUT LOCATION (LOCAL):
  File: ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
  Dir:  ~/tetra/orgs/pixeljam-arcade/nginx

FILE STATUS:
  ✓ Will CREATE new file

IMPORTANT:
  • NO tetra.toml changes
  • NO remote changes
  • NOT deployed yet

=== DRY RUN MODE - Preview Config ===

Config that would be written to: ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

────────────────────────────────────────────────────────
server {
    listen 80;
    listen 443 ssl;

    server_name devpages.pixeljamarcade.com;

    ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;

    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    # Redirect root to index.html
    location = / {
        return 301 /index.html;
    }

    # Proxy to DigitalOcean Spaces
    location / {
        proxy_pass https://devpages.sfo3.digitaloceanspaces.com/;
        ...
    }
}
────────────────────────────────────────────────────────

NO FILES WRITTEN - This was a preview only
```

### Stage 2: Generate Config Locally (Local File Only)

```bash
# Actually write the config file locally
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
```

**What happens:**
- Creates `~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf`
- NO tetra.toml changes
- NO remote server changes
- Just a local file you can review

**Then review it:**
```bash
# Read the generated config
cat ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

# Or use your editor
vim ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

# Compare with existing if updating
diff ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf.backup \
     ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
```

### Stage 3: Preview Deployment (No Remote Changes)

```bash
# Preview what deployment would do
tetra_nginx_spaces_deploy --dry-run devpages prod
```

**Output shows:**
- Local file that will be uploaded
- Remote server connection info (from tetra.toml)
- Remote paths that will be created/modified
- Actions that would be performed
- NO ACTUAL DEPLOYMENT

**Example output:**
```
=== DRY RUN MODE - No changes will be made ===

LOCAL FILES:
  Source config: ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
    ✓ File exists (52 lines)

REMOTE SERVER: prod (root@137.184.226.163)
  Target config: /etc/nginx/sites-available/devpages.conf
  Symlink:       /etc/nginx/sites-enabled/devpages.conf -> ../sites-available/devpages.conf

ACTIONS THAT WOULD BE PERFORMED:
  1. Upload ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf
     to root@137.184.226.163:/etc/nginx/sites-available/devpages.conf
  2. Create symlink (if not exists)
     /etc/nginx/sites-enabled/devpages.conf
  3. Test nginx config (nginx -t)
  4. Reload nginx (systemctl reload nginx)

NO tetra.toml CHANGES - nginx configs are stored locally at:
  ~/tetra/orgs/pixeljam-arcade/nginx/*.conf

To execute: tetra_nginx_spaces_deploy devpages prod
```

### Stage 4: Actual Deployment

```bash
# Deploy for real
tetra_nginx_spaces_deploy devpages prod
```

**What happens:**
1. Uploads config to `/etc/nginx/sites-available/devpages.conf`
2. Creates symlink in `/etc/nginx/sites-enabled/`
3. Tests nginx config (`nginx -t`)
4. Reloads nginx (`systemctl reload nginx`)

## Investigation Workflow Examples

### Example 1: Completely New Config

```bash
# 1. Preview what would be generated (nothing written)
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com sfo3

# Review the output, check:
# - Is the Spaces host correct?
# - Is the domain correct?
# - Does the config look right?

# 2. Generate locally if preview looks good
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# 3. Review the generated file
cat ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

# 4. Preview deployment (nothing deployed)
tetra_nginx_spaces_deploy --dry-run devpages prod

# Review:
# - Is it going to the right server?
# - Are the remote paths correct?

# 5. Deploy for real
tetra_nginx_spaces_deploy devpages prod
```

### Example 2: Updating Existing Config

```bash
# 1. Backup existing config
cp ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf \
   ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf.backup

# 2. Preview what would be generated
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com sfo3

# 3. Generate new config
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3

# 4. Compare old vs new
diff ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf.backup \
     ~/tetra/orgs/pixeljam-arcade/nginx/devpages.conf

# 5. Preview deployment
tetra_nginx_spaces_deploy --dry-run devpages prod

# 6. Deploy
tetra_nginx_spaces_deploy devpages prod
```

### Example 3: Just View Config Without Generating

```bash
# Use the raw proxy function to just output config (nothing written)
tetra_nginx_spaces_proxy devpages devpages.pixeljamarcade.com sfo3

# Or pipe to less for review
tetra_nginx_spaces_proxy devpages devpages.pixeljamarcade.com sfo3 | less

# Or save to a temporary file for review
tetra_nginx_spaces_proxy devpages devpages.pixeljamarcade.com sfo3 > /tmp/preview.conf
vim /tmp/preview.conf
```

## What Each Command Touches

### `tetra_nginx_spaces_config --dry-run`
**Touches:** NOTHING (pure preview)
**Shows:** Full nginx config that would be generated

### `tetra_nginx_spaces_config`
**Touches:** Local file only
**Creates:** `~/tetra/orgs/pixeljam-arcade/nginx/<name>.conf`
**Modifies:** NO tetra.toml, NO remote files

### `tetra_nginx_spaces_deploy --dry-run`
**Touches:** NOTHING (pure preview)
**Shows:** What would be deployed to remote server

### `tetra_nginx_spaces_deploy`
**Touches:** Remote server only
**Uploads:** To `/etc/nginx/sites-available/<name>.conf`
**Creates:** Symlink in `/etc/nginx/sites-enabled/`
**Runs:** `nginx -t` and `systemctl reload nginx`
**Modifies:** NO tetra.toml, NO local files

## Quick Reference Table

| Command | Preview Flag | What It Touches | Output |
|---------|-------------|-----------------|--------|
| `tetra_nginx_spaces_proxy` | N/A | Nothing | Stdout only |
| `tetra_nginx_spaces_config --dry-run` | ✓ | Nothing | Full preview |
| `tetra_nginx_spaces_config` | - | Local file | Creates config |
| `tetra_nginx_spaces_deploy --dry-run` | ✓ | Nothing | Deployment plan |
| `tetra_nginx_spaces_deploy` | - | Remote server | Deploys config |

## Safety Features

1. **Multiple preview stages** - Can inspect at each level
2. **No tetra.toml modification** - Configs stored separately
3. **Local generation first** - Review before deploy
4. **Dry-run for deploy** - See exact deployment plan
5. **Nginx test before reload** - Config validated before applying

## Common Investigation Questions

### "What file will be created?"
```bash
# Preview shows exact path
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com
# Look for: "Config that would be written to: <path>"
```

### "What will the nginx config look like?"
```bash
# Dry-run shows full config
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com
# Entire config shown between separator lines
```

### "Where will it be deployed?"
```bash
# Deploy dry-run shows remote paths
tetra_nginx_spaces_deploy --dry-run devpages prod
# Look for: "Remote server" and "Target config" sections
```

### "Will it overwrite existing files?"
```bash
# Both stages show file status
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com
# Look for: "FILE STATUS: ⚠ Will OVERWRITE" or "✓ Will CREATE"

tetra_nginx_spaces_deploy --dry-run devpages prod
# Shows if config already exists on remote
```

### "What server will it connect to?"
```bash
# Deploy dry-run shows connection info
tetra_nginx_spaces_deploy --dry-run devpages prod
# Look for: "REMOTE SERVER: prod (user@ip)"
```

## Troubleshooting Preview

### Preview shows wrong path
```bash
# Check TETRA_ORG is set
echo $TETRA_ORG
echo $TETRA_ROOT

# Should show:
#   TETRA_ORG=pixeljam-arcade
#   TETRA_ROOT=/Users/mricos/tetra
```

### Preview shows wrong server
```bash
# Check tetra.toml environment
cat ~/tetra/orgs/$TETRA_ORG/tetra.toml | grep -A5 "\[environments.prod\]"

# Verify SSH host matches your expectation
```

### Can't find function
```bash
# Make sure functions are loaded
source $TETRA_SRC/bash/nginx/spaces_proxy.sh

# Verify functions exist
type tetra_nginx_spaces_config
type tetra_nginx_spaces_deploy
```
