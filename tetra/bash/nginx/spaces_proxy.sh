#!/usr/bin/env bash
# spaces_proxy.sh - Generate nginx config for DigitalOcean Spaces proxy
# Part of tetra nginx subsystem
#
# Usage: tetra_nginx_spaces_proxy <bucket_name> <domain> [region]
#        tetra_nginx_spaces_deploy <config_name> <env>

# Generate nginx config for proxying to DO Spaces
tetra_nginx_spaces_proxy() {
    local bucket_name=$1
    local domain=$2
    local region=${3:-sfo3}
    local config_name=${4:-$bucket_name}

    if [[ -z "$bucket_name" ]] || [[ -z "$domain" ]]; then
        echo "Error: bucket_name and domain are required" >&2
        echo "Usage: tetra_nginx_spaces_proxy <bucket_name> <domain> [region] [config_name]" >&2
        return 1
    fi

    local spaces_host="${bucket_name}.${region}.digitaloceanspaces.com"

    cat <<EOF
server {
    listen 80;
    listen 443 ssl;

    server_name $domain;

    ssl_certificate /etc/letsencrypt/live/pixeljamarcade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pixeljamarcade.com/privkey.pem;

    if (\$scheme = http) {
        return 301 https://\$host\$request_uri;
    }

    # Redirect root to index.html
    location = / {
        return 301 /index.html;
    }

    # Proxy to DigitalOcean Spaces
    location / {
        proxy_pass https://$spaces_host/;
        proxy_set_header Host $spaces_host;
        proxy_http_version 1.1;

        # Hide Spaces-specific headers
        proxy_hide_header x-amz-id-2;
        proxy_hide_header x-amz-request-id;
        proxy_hide_header x-amz-meta-s3cmd-attrs;

        # Fix Content-Type for HTML files (Spaces sets binary/octet-stream)
        proxy_hide_header Content-Type;
        types {
            text/html html htm;
            text/css css;
            text/javascript js;
            image/jpeg jpg jpeg;
            image/png png;
            image/gif gif;
        }
        default_type text/html;

        # Cache configuration
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 5m;
        proxy_buffering off;

        # Pass through request info
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
}

# Generate config file to local tetra config directory
tetra_nginx_spaces_config() {
    local dry_run=false

    # Check for --dry-run or --preview flag
    if [[ "$1" == "--dry-run" ]] || [[ "$1" == "--preview" ]]; then
        dry_run=true
        shift
    fi

    local bucket_name=$1
    local domain=$2
    local region=${3:-sfo3}
    local config_name=${4:-$bucket_name}

    if [[ -z "$bucket_name" ]] || [[ -z "$domain" ]]; then
        echo "Error: bucket_name and domain are required" >&2
        echo "Usage: tetra_nginx_spaces_config [--dry-run] <bucket> <domain> [region] [config_name]" >&2
        echo "Example: tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3" >&2
        echo "         tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com" >&2
        return 1
    fi

    local tetra_nginx_dir="$TETRA_ROOT/orgs/$TETRA_ORG/nginx"
    local config_file="$tetra_nginx_dir/${config_name}.conf"

    echo "=== Nginx Config Generation ==="
    echo ""
    echo "CONFIGURATION:"
    echo "  Bucket:      $bucket_name"
    echo "  Domain:      $domain"
    echo "  Region:      $region"
    echo "  Config name: $config_name"
    echo ""
    echo "SPACES HOST:"
    echo "  ${bucket_name}.${region}.digitaloceanspaces.com"
    echo ""
    echo "OUTPUT LOCATION (LOCAL):"
    echo "  File: $config_file"
    echo "  Dir:  $tetra_nginx_dir"
    echo ""
    echo "FILE STATUS:"
    if [[ -f "$config_file" ]]; then
        echo "  ⚠ Will OVERWRITE existing file"
        echo "  Current size: $(wc -l < "$config_file") lines"
        echo "  Last modified: $(stat -f "%Sm" "$config_file" 2>/dev/null || stat -c "%y" "$config_file" 2>/dev/null)"
    else
        echo "  ✓ Will CREATE new file"
    fi
    echo ""
    echo "IMPORTANT:"
    echo "  • NO tetra.toml changes - configs stored separately"
    echo "  • NO remote changes - local generation only"
    echo "  • NOT deployed yet - use tetra_nginx_spaces_deploy after review"
    echo ""

    # Dry run mode - just show what would be generated
    if [[ "$dry_run" == "true" ]]; then
        echo "=== DRY RUN MODE - Preview Config ==="
        echo ""
        echo "Config that would be written to: $config_file"
        echo ""
        echo "────────────────────────────────────────────────────────"
        tetra_nginx_spaces_proxy "$bucket_name" "$domain" "$region" "$config_name"
        echo "────────────────────────────────────────────────────────"
        echo ""
        echo "NO FILES WRITTEN - This was a preview only"
        echo ""
        echo "To write this config:"
        echo "  tetra_nginx_spaces_config $bucket_name $domain $region $config_name"
        return 0
    fi

    # Actually generate the file
    mkdir -p "$tetra_nginx_dir"
    tetra_nginx_spaces_proxy "$bucket_name" "$domain" "$region" "$config_name" > "$config_file"

    echo "✓ Generated nginx config: $config_file"
    echo ""
    echo "NEXT STEPS:"
    echo "  Review:  cat $config_file"
    echo "  Preview: tetra_nginx_spaces_deploy --dry-run $config_name <env>"
    echo "  Deploy:  tetra_nginx_spaces_deploy $config_name <env>"
}

# Deploy nginx config to remote server
tetra_nginx_spaces_deploy() {
    local config_name=$1
    local env=$2
    local dry_run=false

    # Check for --dry-run flag
    if [[ "$1" == "--dry-run" ]]; then
        dry_run=true
        config_name=$2
        env=$3
    elif [[ "$2" == "--dry-run" ]]; then
        dry_run=true
        env=$3
    elif [[ "$3" == "--dry-run" ]]; then
        dry_run=true
    fi

    if [[ -z "$config_name" ]] || [[ -z "$env" ]]; then
        echo "Error: config_name and env are required" >&2
        echo "Usage: tetra_nginx_spaces_deploy [--dry-run] <config_name> <env>" >&2
        echo "Example: tetra_nginx_spaces_deploy devpages prod" >&2
        echo "         tetra_nginx_spaces_deploy --dry-run devpages prod" >&2
        return 1
    fi

    # Source tetra env functions if not already loaded
    if ! type tes_get_ssh_host &>/dev/null; then
        source "$TETRA_SRC/bash/org/tes.sh" || {
            echo "Error: Could not load tes.sh" >&2
            return 1
        }
    fi

    local config_file="$TETRA_ROOT/orgs/$TETRA_ORG/nginx/${config_name}.conf"

    if [[ ! -f "$config_file" ]]; then
        echo "Error: Config file not found: $config_file" >&2
        echo "Generate it first: tetra_nginx_spaces_config <bucket> <domain> [region] [config_name]" >&2
        return 1
    fi

    # Get SSH connection info from tetra.toml
    local ssh_host=$(tes_get_ssh_host "$env")
    local ssh_user=$(tes_get_ssh_user "$env")
    local ssh_key=$(tes_get_ssh_key "$env")

    if [[ -z "$ssh_host" ]]; then
        echo "Error: Could not find environment '$env' in tetra.toml" >&2
        echo "Available environments:" >&2
        tes_list_environments >&2
        return 1
    fi

    # Copy config to remote server
    local remote_config="/etc/nginx/sites-available/${config_name}.conf"
    local remote_symlink="/etc/nginx/sites-enabled/${config_name}.conf"
    local ssh_opts="-i $ssh_key"

    # Dry run mode - show what would be done
    if [[ "$dry_run" == "true" ]]; then
        echo "=== DRY RUN MODE - No changes will be made ==="
        echo ""
        echo "LOCAL FILES:"
        echo "  Source config: $config_file"
        if [[ -f "$config_file" ]]; then
            echo "    ✓ File exists ($(wc -l < "$config_file") lines)"
        else
            echo "    ✗ File NOT found - run tetra_nginx_spaces_config first"
            return 1
        fi
        echo ""
        echo "REMOTE SERVER: $env ($ssh_user@$ssh_host)"
        echo "  Target config: $remote_config"
        echo "  Symlink:       $remote_symlink -> $remote_config"
        echo ""
        echo "ACTIONS THAT WOULD BE PERFORMED:"
        echo "  1. Upload $config_file"
        echo "     to ${ssh_user}@${ssh_host}:${remote_config}"
        echo "  2. Create symlink (if not exists)"
        echo "     $remote_symlink -> $remote_config"
        echo "  3. Test nginx config (nginx -t)"
        echo "  4. Reload nginx (systemctl reload nginx)"
        echo ""
        echo "NO tetra.toml CHANGES - nginx configs are stored locally at:"
        echo "  ~/tetra/orgs/$TETRA_ORG/nginx/*.conf"
        echo ""
        echo "To execute: tetra_nginx_spaces_deploy $config_name $env"
        return 0
    fi

    echo "Deploying $config_name.conf to $env ($ssh_user@$ssh_host)..."

    # Upload config
    scp $ssh_opts "$config_file" "${ssh_user}@${ssh_host}:${remote_config}" || {
        echo "Error: Failed to upload config file" >&2
        return 1
    }

    # Enable site and reload nginx
    ssh $ssh_opts "${ssh_user}@${ssh_host}" bash <<REMOTE_SCRIPT
set -e

# Create symlink if it doesn't exist
if [[ ! -L /etc/nginx/sites-enabled/${config_name}.conf ]]; then
    ln -s $remote_config /etc/nginx/sites-enabled/${config_name}.conf
    echo "Enabled site: ${config_name}.conf"
else
    echo "Site already enabled: ${config_name}.conf"
fi

# Test nginx config
echo "Testing nginx configuration..."
nginx -t || {
    echo "Error: nginx config test failed" >&2
    exit 1
}

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx

echo "Deployment complete!"
REMOTE_SCRIPT

    if [[ $? -eq 0 ]]; then
        echo ""
        echo "✓ Successfully deployed $config_name.conf to $env"
        echo "✓ Nginx reloaded"
    else
        echo "✗ Deployment failed" >&2
        return 1
    fi
}

# List existing nginx configs for this org
tetra_nginx_spaces_list() {
    local tetra_nginx_dir="$TETRA_ROOT/orgs/$TETRA_ORG/nginx"

    if [[ ! -d "$tetra_nginx_dir" ]]; then
        echo "No nginx configs found in: $tetra_nginx_dir"
        return 0
    fi

    echo "Nginx configs for $TETRA_ORG:"
    echo ""
    ls -1 "$tetra_nginx_dir"/*.conf 2>/dev/null | while read -r config; do
        local name=$(basename "$config" .conf)
        echo "  $name"
        grep "# Bucket:" "$config" | sed 's/^/    /'
        grep "# Domain:" "$config" | sed 's/^/    /'
    done
}

# Interactive wizard to create and deploy nginx config
tetra_nginx_spaces_wizard() {
    echo "=== Tetra Nginx Spaces Proxy Wizard ==="
    echo ""

    # Get bucket name
    read -p "Bucket name (e.g., devpages, pja-docs): " bucket_name
    if [[ -z "$bucket_name" ]]; then
        echo "Error: Bucket name is required"
        return 1
    fi

    # Get domain
    read -p "Domain (e.g., devpages.pixeljamarcade.com): " domain
    if [[ -z "$domain" ]]; then
        echo "Error: Domain is required"
        return 1
    fi

    # Get region (default sfo3)
    read -p "Region [sfo3]: " region
    region=${region:-sfo3}

    # Get config name (default to bucket name)
    read -p "Config name [$bucket_name]: " config_name
    config_name=${config_name:-$bucket_name}

    echo ""
    echo "Generating config..."
    tetra_nginx_spaces_config "$bucket_name" "$domain" "$region" "$config_name"

    echo ""
    read -p "Deploy to environment? (leave empty to skip): " deploy_env

    if [[ -n "$deploy_env" ]]; then
        tetra_nginx_spaces_deploy "$config_name" "$deploy_env"
    else
        echo "Config generated but not deployed."
        echo "To deploy later: tetra_nginx_spaces_deploy $config_name <env>"
    fi
}

# Export functions
export -f tetra_nginx_spaces_proxy
export -f tetra_nginx_spaces_config
export -f tetra_nginx_spaces_deploy
export -f tetra_nginx_spaces_list
export -f tetra_nginx_spaces_wizard
