#!/usr/bin/env bash
# docs_proxy.sh - Generate nginx configs for authenticated doc subdomains
# Proxies subdomain → private Spaces bucket with HTTP basic auth

# Strong globals
: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:?TETRA_DIR must be set}"

# Module metadata
MOD_NAME="nginx-docs-proxy"
MOD_DESC="Authenticated doc subdomain nginx config generator"

# Generate nginx config for doc subdomain
# Reads from tetra.toml [publishing.<doc-type>] section
nginx_docs_generate_config() {
    local doc_type="$1"  # e.g., "api-docs", "user-docs", "dev-docs"
    local org_name="${TETRA_ORG:?TETRA_ORG must be set}"

    if [[ -z "$doc_type" ]]; then
        echo "Error: doc-type required" >&2
        echo "Usage: nginx_docs_generate_config <doc-type>" >&2
        echo "Example: nginx_docs_generate_config api-docs" >&2
        return 1
    fi

    local toml_file="$TETRA_DIR/orgs/$org_name/tetra.toml"
    if [[ ! -f "$toml_file" ]]; then
        echo "Error: tetra.toml not found: $toml_file" >&2
        return 1
    fi

    # Load secrets for variable expansion
    local secrets_file="$TETRA_DIR/orgs/$org_name/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        set -a
        source "$secrets_file"
        set +a
    fi

    # Parse publishing section [publishing.<doc-type>]
    local section_name="publishing.$doc_type"
    local section
    section=$(awk "/^\[$section_name\]/ {found=1; next} found && /^\[/ {exit} found {print}" "$toml_file")

    if [[ -z "$section" ]]; then
        echo "Error: No [$section_name] section found in $toml_file" >&2
        echo "Add a section like:" >&2
        cat <<EOF >&2

[$section_name]
type = "spaces"
bucket = "pja-docs-private"
prefix = "api/"
subdomain = "api-docs.pixeljamarcade.com"
auth_required = true
auth_realm = "API Documentation"
auth_users_var = "API_DOCS_USERS"
EOF
        return 1
    fi

    # Extract config values
    local bucket prefix subdomain base_domain auth_realm auth_users_var endpoint region
    bucket=$(echo "$section" | grep '^bucket' | cut -d'=' -f2 | tr -d ' "')
    prefix=$(echo "$section" | grep '^prefix' | cut -d'=' -f2 | tr -d ' "')
    subdomain=$(echo "$section" | grep '^subdomain' | cut -d'=' -f2 | tr -d ' "')
    auth_realm=$(echo "$section" | grep '^auth_realm' | cut -d'=' -f2 | tr -d ' "')
    auth_users_var=$(echo "$section" | grep '^auth_users_var' | cut -d'=' -f2 | tr -d ' "')
    endpoint=$(echo "$section" | grep '^endpoint' | cut -d'=' -f2 | tr -d ' "')
    region=$(echo "$section" | grep '^region' | cut -d'=' -f2 | tr -d ' "')

    # Fallback to storage.spaces for endpoint/region
    if [[ -z "$endpoint" ]] || [[ -z "$region" ]]; then
        local storage_section
        storage_section=$(awk '/^\[storage\.spaces\]/ {found=1; next} found && /^\[/ {exit} found {print}' "$toml_file")
        [[ -z "$endpoint" ]] && endpoint=$(echo "$storage_section" | grep '^endpoint' | cut -d'=' -f2 | tr -d ' "')
        [[ -z "$region" ]] && region=$(echo "$storage_section" | grep '^region' | cut -d'=' -f2 | tr -d ' "')
    fi

    # Expand variables
    endpoint=$(eval echo "$endpoint")
    region=$(eval echo "$region")

    # Extract base domain from subdomain for cert path
    base_domain=$(echo "$subdomain" | sed 's/^[^.]*\.//')

    # Extract host from endpoint
    local spaces_host
    spaces_host=$(echo "$endpoint" | sed 's|^https\{0,1\}://||')

    # Build proxy URL
    local proxy_url="https://${bucket}.${spaces_host}/${prefix}"

    # Defaults
    [[ -z "$auth_realm" ]] && auth_realm="Documentation"

    # Org-wide basic auth: check for BASIC_AUTH_FILE or BASIC_AUTH_CREDENTIALS
    local auth_file="${BASIC_AUTH_FILE:-}"
    local auth_users_content="${BASIC_AUTH_CREDENTIALS:-}"

    # Per-doc override: check for doc-specific auth
    local auth_users_var=""
    if [[ -n "$(echo "$section" | grep '^auth_users_var')" ]]; then
        auth_users_var=$(echo "$section" | grep '^auth_users_var' | cut -d'=' -f2 | tr -d ' "')
        auth_users_var="${auth_users_var//[-.]/_}"  # Normalize to valid var name

        # Check if per-doc credentials are set
        if [[ -n "${!auth_users_var:-}" ]]; then
            auth_users_content="${!auth_users_var}"
            auth_file=""  # Use inline credentials, not file
        fi
    fi

    echo "═══════════════════════════════════════════════════════════"
    echo "  NGINX DOC SUBDOMAIN CONFIG GENERATOR"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Doc Type:    $doc_type"
    echo "Subdomain:   $subdomain"
    echo "Bucket:      $bucket"
    echo "Prefix:      $prefix"
    echo "Proxy URL:   $proxy_url"
    echo "Auth Realm:  $auth_realm"

    # Show auth method
    if [[ -n "$auth_file" ]]; then
        echo "Auth Method: Server file ($auth_file)"
    elif [[ -n "$auth_users_content" ]]; then
        echo "Auth Method: Generated htpasswd"
    else
        echo "Auth Method: None (public)"
    fi
    echo ""

    # Output directory
    local output_dir="$TETRA_DIR/orgs/$org_name/nginx"
    mkdir -p "$output_dir"
    local output_file="$output_dir/${subdomain}.conf"

    # Generate htpasswd file if inline auth users provided
    local htpasswd_file=""
    if [[ -n "$auth_users_content" ]]; then
        htpasswd_file="$output_dir/${subdomain}.htpasswd"
        echo "$auth_users_content" > "$htpasswd_file"
        chmod 600 "$htpasswd_file"
        echo "✓ Created htpasswd: $htpasswd_file"
    fi

    # Generate nginx config
    cat > "$output_file" << EOF
# Nginx config for $subdomain
# Generated by tetra nginx.docs.generate on $(date)
# Proxies to DO Spaces: $bucket/$prefix

server {
    listen 443 ssl http2;
    server_name $subdomain;

    # SSL - using wildcard cert for *.$base_domain
    ssl_certificate /etc/letsencrypt/live/$base_domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$base_domain/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
EOF

    # Add basic auth if configured
    if [[ -n "$auth_file" ]]; then
        # Use org-wide auth file on server
        cat >> "$output_file" << EOF

    # HTTP Basic Authentication (org-wide)
    auth_basic "$auth_realm";
    auth_basic_user_file $auth_file;
EOF
    elif [[ -n "$auth_users_content" ]]; then
        # Use generated htpasswd file
        cat >> "$output_file" << EOF

    # HTTP Basic Authentication (doc-specific)
    auth_basic "$auth_realm";
    auth_basic_user_file /etc/nginx/htpasswd/$(basename "$htpasswd_file");
EOF
    fi

    cat >> "$output_file" << EOF

    # Proxy to DigitalOcean Spaces
    location / {
        # Proxy settings
        proxy_pass $proxy_url;
        proxy_set_header Host ${bucket}.${spaces_host};
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Hide Spaces-specific headers (prevents XML responses)
        proxy_hide_header x-amz-id-2;
        proxy_hide_header x-amz-request-id;
        proxy_hide_header x-amz-meta-server-side-encryption;
        proxy_hide_header x-amz-server-side-encryption;
        proxy_hide_header x-amz-bucket-region;
        proxy_hide_header x-amz-access-point-alias;

        # Handle errors gracefully
        proxy_intercept_errors on;

        # Directory index
        index index.html index.htm;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Custom error pages (optional - create these in your bucket)
    error_page 404 /404.html;
    error_page 403 /403.html;
    error_page 500 502 503 504 /50x.html;

    # Logging
    access_log /var/log/nginx/${subdomain}_access.log;
    error_log /var/log/nginx/${subdomain}_error.log;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $subdomain;

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

    echo "✓ Generated: $output_file"
    echo ""
    echo "NEXT STEPS:"
    echo "1. Review the config: cat $output_file"

    if [[ -n "$htpasswd_file" ]]; then
        echo "2. Deploy htpasswd to server:"
        echo "   scp $htpasswd_file root@server:/etc/nginx/htpasswd/"
    fi

    echo "3. Deploy config to server:"
    echo "   scp $output_file root@server:/etc/nginx/sites-available/"
    echo "   ssh root@server 'ln -sf /etc/nginx/sites-available/$(basename "$output_file") /etc/nginx/sites-enabled/'"
    echo "   ssh root@server 'nginx -t && systemctl reload nginx'"
    echo ""
    echo "Or use: org nginx.docs.deploy $doc_type <env>"
}

# Deploy nginx config to remote server
nginx_docs_deploy_config() {
    local doc_type="$1"
    local env="${2:-prod}"
    local org_name="${TETRA_ORG:?TETRA_ORG must be set}"

    if [[ -z "$doc_type" ]]; then
        echo "Error: doc-type required" >&2
        echo "Usage: nginx_docs_deploy_config <doc-type> [env]" >&2
        return 1
    fi

    local toml_file="$TETRA_DIR/orgs/$org_name/tetra.toml"
    local section_name="publishing.$doc_type"
    local section
    section=$(awk "/^\[$section_name\]/ {found=1; next} found && /^\[/ {exit} found {print}" "$toml_file")

    if [[ -z "$section" ]]; then
        echo "Error: No [$section_name] section in tetra.toml" >&2
        return 1
    fi

    # Extract subdomain
    local subdomain
    subdomain=$(echo "$section" | grep '^subdomain' | cut -d'=' -f2 | tr -d ' "')

    if [[ -z "$subdomain" ]]; then
        echo "Error: No subdomain defined in [$section_name]" >&2
        return 1
    fi

    # Get server IP from environments section
    local env_section
    env_section=$(awk "/^\[environments\.$env\]/ {found=1; next} found && /^\[/ {exit} found {print}" "$toml_file")

    local server_ip ssh_user
    server_ip=$(echo "$env_section" | grep '^server_ip' | cut -d'=' -f2 | tr -d ' "')
    ssh_user=$(echo "$env_section" | grep '^ssh_auth_user' | cut -d'=' -f2 | tr -d ' "')

    if [[ -z "$server_ip" ]]; then
        echo "Error: No server_ip in [environments.$env]" >&2
        return 1
    fi

    [[ -z "$ssh_user" ]] && ssh_user="root"

    local nginx_dir="$TETRA_DIR/orgs/$org_name/nginx"
    local config_file="$nginx_dir/${subdomain}.conf"
    local htpasswd_file="$nginx_dir/${subdomain}.htpasswd"

    if [[ ! -f "$config_file" ]]; then
        echo "Error: Config not found: $config_file" >&2
        echo "Run: nginx_docs_generate_config $doc_type" >&2
        return 1
    fi

    echo "═══════════════════════════════════════════════════════════"
    echo "  DEPLOYING NGINX CONFIG"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Doc Type:  $doc_type"
    echo "Subdomain: $subdomain"
    echo "Server:    $ssh_user@$server_ip ($env)"
    echo ""

    # Deploy htpasswd if exists
    if [[ -f "$htpasswd_file" ]]; then
        echo "[1/4] Deploying htpasswd file..."
        ssh "$ssh_user@$server_ip" "mkdir -p /etc/nginx/htpasswd" || return 1
        scp "$htpasswd_file" "$ssh_user@$server_ip:/etc/nginx/htpasswd/" || return 1
        echo "✓ Deployed htpasswd"
    else
        echo "[1/4] No htpasswd file (public docs)"
    fi

    # Deploy nginx config
    echo "[2/4] Deploying nginx config..."
    scp "$config_file" "$ssh_user@$server_ip:/etc/nginx/sites-available/" || return 1
    echo "✓ Deployed config"

    # Enable site
    echo "[3/4] Enabling site..."
    ssh "$ssh_user@$server_ip" "ln -sf /etc/nginx/sites-available/$(basename "$config_file") /etc/nginx/sites-enabled/" || return 1
    echo "✓ Enabled site"

    # Test and reload nginx
    echo "[4/4] Testing and reloading nginx..."
    if ssh "$ssh_user@$server_ip" "nginx -t"; then
        ssh "$ssh_user@$server_ip" "systemctl reload nginx" || return 1
        echo "✓ Nginx reloaded"
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        echo "  DEPLOYMENT COMPLETE"
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo "Your docs are now live at: https://$subdomain"
        echo ""
    else
        echo "❌ Nginx config test failed" >&2
        return 1
    fi
}

# List deployed doc configs
nginx_docs_list() {
    local org_name="${TETRA_ORG:?TETRA_ORG must be set}"
    local nginx_dir="$TETRA_DIR/orgs/$org_name/nginx"

    if [[ ! -d "$nginx_dir" ]]; then
        echo "No nginx configs found at: $nginx_dir"
        return 0
    fi

    echo "═══════════════════════════════════════════════════════════"
    echo "  DOC SUBDOMAIN CONFIGS"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    local found=0
    for conf in "$nginx_dir"/*.conf; do
        [[ ! -f "$conf" ]] && continue

        local filename=$(basename "$conf")
        local subdomain="${filename%.conf}"
        local has_auth=""

        if [[ -f "$nginx_dir/${subdomain}.htpasswd" ]]; then
            has_auth=" [auth]"
        fi

        echo "  • $subdomain$has_auth"
        found=1
    done

    if [[ $found -eq 0 ]]; then
        echo "  (none found)"
        echo ""
        echo "Generate configs with: nginx_docs_generate_config <doc-type>"
    fi
    echo ""
}

# Export functions
export -f nginx_docs_generate_config
export -f nginx_docs_deploy_config
export -f nginx_docs_list
