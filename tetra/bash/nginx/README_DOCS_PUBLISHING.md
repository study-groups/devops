# Authenticated Docs Publishing System

Publish documentation to private DigitalOcean Spaces with nginx basic auth proxy.

## Architecture

```
DevPages → Spaces (private) → Nginx Proxy (auth) → Public Subdomain
           pja-docs            /etc/nginx/.htpasswd   docs.pixeljamarcade.com
                              gridranger:gridranger
```

## Quick Start

### 1. Configure Publishing Targets (Already Done)

Your `tetra.toml` has three doc publishing configs:

```toml
[publishing.pja-docs]     → docs.pixeljamarcade.com
[publishing.tau-docs]     → tau.pixeljamarcade.com
[publishing.devpages-docs] → devpages.pixeljamarcade.com
```

All use:
- **Bucket**: `pja-docs`
- **Auth**: `/etc/nginx/.htpasswd` (gridranger:gridranger)
- **Secrets**: `${DO_SPACES_KEY}` from `secrets.env`

### 2. Generate Nginx Configs

```bash
# Set org context
export TETRA_ORG=pixeljam-arcade
source $TETRA_DIR/orgs/pixeljam-arcade/secrets.env

# Generate configs for each subdomain
source $TETRA_SRC/bash/nginx/docs_proxy.sh

nginx_docs_generate_config pja-docs
nginx_docs_generate_config tau-docs
nginx_docs_generate_config devpages-docs
```

Output:
```
$TETRA_DIR/orgs/pixeljam-arcade/nginx/
├── docs.pixeljamarcade.com.conf
├── tau.pixeljamarcade.com.conf
└── devpages.pixeljamarcade.com.conf
```

### 3. Deploy to Server

```bash
# Deploy to prod server (reads server_ip from tetra.toml [environments.prod])
nginx_docs_deploy_config pja-docs prod
nginx_docs_deploy_config tau-docs prod
nginx_docs_deploy_config devpages-docs prod
```

This:
1. ✓ Uploads nginx configs to `/etc/nginx/sites-available/`
2. ✓ Symlinks to `/etc/nginx/sites-enabled/`
3. ✓ Tests nginx config
4. ✓ Reloads nginx

### 4. Publish from DevPages

In DevPages UI:
1. Write your doc in markdown
2. Select publishing target: `@pja-docs`, `@tau-docs`, or `@devpages-docs`
3. Click "Publish"
4. File uploads to `s3://pja-docs/<prefix>/your-doc.html`

### 5. Access Your Docs

Visit: `https://docs.pixeljamarcade.com/your-doc.html`

Browser prompts for:
- **Username**: gridranger
- **Password**: gridranger

## Org Module Commands

```bash
# Using org action interface
source $TETRA_SRC/bash/org/actions.sh

# List configured doc subdomains
org_action_nginx_docs_list

# Show specific config
org_action_nginx_docs_show pja-docs

# Generate nginx config
org_action_nginx_docs_generate pja-docs

# Deploy to server
org_action_nginx_docs_deploy pja-docs prod
```

## Configuration Details

### tetra.toml Publishing Sections

```toml
[publishing.pja-docs]
symbol = "@pja-docs"
type = "spaces"
bucket = "pja-docs"                  # Private Spaces bucket
prefix = ""                          # Root of bucket
subdomain = "docs.pixeljamarcade.com"
auth_required = true
auth_realm = "Documentation"
auth_users_var = "PJA_DOCS_USERS"    # Optional override
access_key = "${DO_SPACES_KEY}"      # From secrets.env
secret_key = "${DO_SPACES_SECRET}"
```

### secrets.env

```bash
# Spaces credentials
DO_SPACES_KEY=DO00GXQ243FCVDLQT9CF
DO_SPACES_SECRET=+kH1E4zhaaisTmKwQRoJS9nfDRK2j9ZOigXmm0PJygY

# Org-wide basic auth (uses existing server file)
BASIC_AUTH_FILE="/etc/nginx/.htpasswd"

# Optional: Per-doc credentials (overrides BASIC_AUTH_FILE)
# PJA_DOCS_USERS="admin:$apr1$..."
```

### Generated Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name docs.pixeljamarcade.com;

    # SSL (wildcard cert)
    ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;

    # HTTP Basic Auth (org-wide)
    auth_basic "Documentation";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Proxy to Spaces
    location / {
        proxy_pass https://pja-docs.sfo3.digitaloceanspaces.com/;
        proxy_set_header Host pja-docs.sfo3.digitaloceanspaces.com;

        # Hide Spaces headers (prevents XML responses)
        proxy_hide_header x-amz-*;

        # Handle directory indexes
        index index.html;

        # Custom error pages
        error_page 404 /404.html;
    }
}
```

## Publishing Workflow

### Notion-Clone Pattern (Manual Gate)

```
1. Write → DevPages editor
2. Publish → Uploads to private Spaces
3. Review → Access via Spaces CDN (no nginx yet)
4. Approve → Run nginx_docs_generate + deploy
5. Live → Public subdomain with auth
```

### Commands

```bash
# Step 1-2: Write and publish in DevPages UI

# Step 3: Review (optional - use Spaces CDN URL)
# https://pja-docs.sfo3.cdn.digitaloceanspaces.com/my-doc.html

# Step 4: Make live
nginx_docs_generate_config pja-docs
nginx_docs_deploy_config pja-docs prod

# Step 5: Access
# https://docs.pixeljamarcade.com/my-doc.html
```

## Advanced Usage

### Per-Doc Custom Auth

Override org-wide auth for specific docs:

```bash
# In secrets.env
TAU_DOCS_USERS="devteam:$apr1$xyz..."

# Generate htpasswd hash
htpasswd -nb devteam mypassword
# Copy output to secrets.env as TAU_DOCS_USERS
```

Then regenerate:
```bash
nginx_docs_generate_config tau-docs  # Creates tau.pixeljamarcade.com.htpasswd
nginx_docs_deploy_config tau-docs prod
```

### Adding New Doc Type

```bash
# Interactive setup
org_action_nginx_docs_init api-docs api-docs.pixeljamarcade.com

# Prompts for:
# - Bucket name
# - Prefix
# - Auth required?
# - Auth realm
# - Credentials variable name

# Adds to tetra.toml automatically
```

### Multiple Environments

```bash
# Deploy to dev server instead of prod
nginx_docs_deploy_config pja-docs dev

# Deploy to staging
nginx_docs_deploy_config pja-docs staging
```

## Troubleshooting

### Nginx Shows XML Instead of HTML

**Problem**: Visiting subdomain returns XML directory listing

**Cause**: Nginx not hiding Spaces headers

**Fix**: Regenerate config (includes `proxy_hide_header x-amz-*`)

```bash
nginx_docs_generate_config pja-docs
nginx_docs_deploy_config pja-docs prod
```

### Auth Not Working

**Problem**: No password prompt or wrong credentials

**Check**:
```bash
# Verify htpasswd file exists on server
ssh root@server 'ls -l /etc/nginx/.htpasswd'

# Verify config references correct file
cat $TETRA_DIR/orgs/pixeljam-arcade/nginx/docs.pixeljamarcade.com.conf | grep auth_basic_user_file

# Should show: auth_basic_user_file /etc/nginx/.htpasswd;
```

### SSL Certificate Error

**Problem**: Browser shows SSL warning

**Cause**: Wildcard cert doesn't cover subdomain

**Fix**: Ensure subdomain matches wildcard pattern

```bash
# Check cert covers *.pixeljamarcade.com
ssh root@server 'certbot certificates'

# If not, add subdomain:
ssh root@server 'certbot --expand -d pixeljamarcade.com -d *.pixeljamarcade.com'
```

### File Not Found (404)

**Problem**: Doc published but shows 404

**Check**:
1. **File uploaded to Spaces?**
   ```bash
   spaces_list pja-docs | grep my-doc.html
   ```

2. **Correct prefix in tetra.toml?**
   ```bash
   # If publishing.pja-docs has prefix = "docs/"
   # File is at: s3://pja-docs/docs/my-doc.html
   # URL is: https://docs.pixeljamarcade.com/my-doc.html
   # Nginx proxies to: https://pja-docs.sfo3.digitaloceanspaces.com/docs/my-doc.html
   ```

3. **Nginx config correct?**
   ```bash
   ssh root@server 'cat /etc/nginx/sites-enabled/docs.pixeljamarcade.com.conf | grep proxy_pass'
   # Should show: proxy_pass https://pja-docs.sfo3.digitaloceanspaces.com/;
   ```

## Files Reference

```
Tetra Source:
/Users/mricos/src/devops/tetra/bash/nginx/
├── docs_proxy.sh              # Generator functions
└── README_DOCS_PUBLISHING.md  # This file

/Users/mricos/src/devops/tetra/bash/org/
├── nginx_docs.sh              # Org action wrappers
└── actions.sh                 # Registered org_action_nginx_docs_*

Org Config:
/Users/mricos/tetra/orgs/pixeljam-arcade/
├── tetra.toml                 # Publishing configs
├── secrets.env                # BASIC_AUTH_FILE, Spaces keys
└── nginx/
    ├── docs.pixeljamarcade.com.conf
    ├── tau.pixeljamarcade.com.conf
    └── devpages.pixeljamarcade.com.conf

Server Files (deployed):
/etc/nginx/
├── .htpasswd                  # gridranger:gridranger
├── sites-available/
│   ├── docs.pixeljamarcade.com.conf
│   ├── tau.pixeljamarcade.com.conf
│   └── devpages.pixeljamarcade.com.conf
└── sites-enabled/  (symlinks)
```

## Next Steps

1. **Test**: Generate and deploy one subdomain first
   ```bash
   nginx_docs_generate_config pja-docs
   nginx_docs_deploy_config pja-docs prod
   ```

2. **Publish**: Upload a test doc from DevPages

3. **Verify**: Visit https://docs.pixeljamarcade.com/test.html

4. **Scale**: Deploy remaining subdomains (tau, devpages)

5. **Integrate**: Add post-publish hooks to DevPages (optional)
