#!/usr/bin/env bash

# tdocs Publish Module
# Publishes documentation to configured endpoints (Spaces, S3, etc.)

# Strong globals
: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"

# ═══════════════════════════════════════════════════════════
# TOML CONFIGURATION PARSER
# ═══════════════════════════════════════════════════════════

tdocs_load_publish_config() {
    local org_name="${1:-}"
    local target="${2:-docs}"  # Default to publish.docs

    # Determine org toml path
    local org_toml=""
    if [[ -n "$org_name" ]]; then
        org_toml="$TETRA_DIR/orgs/$org_name/tetra.toml"
    elif [[ -n "$TETRA_ORG" ]]; then
        org_toml="$TETRA_DIR/orgs/$TETRA_ORG/tetra.toml"
    else
        echo "Error: No organization specified. Set TETRA_ORG or pass org name" >&2
        return 1
    fi

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: Organization TOML not found: $org_toml" >&2
        return 1
    fi

    # Source TOML parser if available
    if [[ -f "$TETRA_SRC/bash/deploy/toml.sh" ]]; then
        source "$TETRA_SRC/bash/deploy/toml.sh"
        toml_parse "$org_toml" "PUB_CFG" 2>/dev/null || {
            echo "Error: Failed to parse $org_toml" >&2
            return 1
        }
    else
        echo "Error: TOML parser not found" >&2
        return 1
    fi

    # Extract publish configuration for target
    # Section name format: publish.docs -> publish_docs
    local section_name="publish_${target//./_}"

    # Access the associative array for this section
    local -n config_array="PUB_CFG_${section_name}"

    # Export config variables
    export TDOCS_PUBLISH_BUCKET="${config_array[bucket]}"
    export TDOCS_PUBLISH_PATH="${config_array[path]:-/}"
    export TDOCS_PUBLISH_ENDPOINT="${config_array[endpoint]}"
    export TDOCS_PUBLISH_REGION="${config_array[region]}"
    export TDOCS_PUBLISH_PUBLIC_URL="${config_array[public_url]}"
    export TDOCS_PUBLISH_ACCESS_KEY="${config_array[access_key]}"
    export TDOCS_PUBLISH_SECRET_KEY="${config_array[secret_key]}"
    export TDOCS_PUBLISH_SOURCE="${config_array[source]}"

    # Validate required fields
    if [[ -z "$TDOCS_PUBLISH_BUCKET" ]] || [[ -z "$TDOCS_PUBLISH_ENDPOINT" ]]; then
        echo "Error: Incomplete publish configuration for '$target'" >&2
        echo "Required: bucket, endpoint" >&2
        return 1
    fi

    return 0
}

# ═══════════════════════════════════════════════════════════
# NGINX CONFIG GENERATOR
# ═══════════════════════════════════════════════════════════

tdocs_generate_nginx_config() {
    local target="${1:-docs}"
    local org_name="${2:-$TETRA_ORG}"

    # Load config
    if ! tdocs_load_publish_config "$org_name" "$target"; then
        return 1
    fi

    # Extract domain from public_url
    local domain="${TDOCS_PUBLISH_PUBLIC_URL#https://}"
    domain="${domain#http://}"
    domain="${domain%%/*}"

    # Extract Space bucket name and construct full endpoint
    local spaces_host="${TDOCS_PUBLISH_ENDPOINT#https://}"
    spaces_host="${spaces_host#http://}"

    # If endpoint doesn't include bucket, prepend it
    if [[ "$spaces_host" != "$TDOCS_PUBLISH_BUCKET."* ]]; then
        spaces_host="${TDOCS_PUBLISH_BUCKET}.${spaces_host}"
    fi

    # Construct proxy path
    local proxy_path="${TDOCS_PUBLISH_PATH}"
    [[ "$proxy_path" != */ ]] && proxy_path="${proxy_path}/"

    cat <<EOF
# ═══════════════════════════════════════════════════════════
# Nginx configuration for: $domain
# Target: publish.$target
# Generated: $(date)
# ═══════════════════════════════════════════════════════════

# HTTP server (port 80) - redirects to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    # Redirect all HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server (port 443)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $domain;

    # SSL certificates (run: sudo certbot --nginx -d $domain)
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # Redirect root to index.html
    location = / {
        return 301 /index.html;
    }

    # Proxy to DigitalOcean Spaces
    location / {
        proxy_pass https://${spaces_host}${proxy_path};
        proxy_set_header Host ${spaces_host};
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

    # Logging
    access_log /var/log/nginx/${domain}_access.log;
    error_log /var/log/nginx/${domain}_error.log;
}

# ═══════════════════════════════════════════════════════════
# Installation Instructions:
# ═══════════════════════════════════════════════════════════
#
# 1. Save this config:
#    sudo tee /etc/nginx/sites-available/$domain
#
# 2. Enable the site:
#    sudo ln -s /etc/nginx/sites-available/$domain /etc/nginx/sites-enabled/
#
# 3. Test configuration:
#    sudo nginx -t
#
# 4. Get SSL certificate:
#    sudo certbot --nginx -d $domain
#
# 5. Reload nginx:
#    sudo systemctl reload nginx
#
EOF
}

# ═══════════════════════════════════════════════════════════
# S3CMD PUBLISH FUNCTION
# ═══════════════════════════════════════════════════════════

tdocs_publish() {
    local source_path="${1:-.}"
    local target="${2:-docs}"
    local org_name="${3:-$TETRA_ORG}"

    # Load config
    if ! tdocs_load_publish_config "$org_name" "$target"; then
        return 1
    fi

    echo "📤 Publishing to: $target"
    echo "   Source: $source_path"
    echo "   Bucket: $TDOCS_PUBLISH_BUCKET"
    echo "   Path: $TDOCS_PUBLISH_PATH"
    echo "   URL: $TDOCS_PUBLISH_PUBLIC_URL"
    echo ""

    # Check if source exists
    if [[ ! -d "$source_path" ]] && [[ ! -f "$source_path" ]]; then
        echo "Error: Source not found: $source_path" >&2
        return 1
    fi

    # Check for s3cmd
    if ! command -v s3cmd >/dev/null 2>&1; then
        echo "Error: s3cmd not installed" >&2
        echo "Install: brew install s3cmd" >&2
        return 1
    fi

    # Build s3 destination (ensure trailing slash for directory)
    local s3_dest="s3://${TDOCS_PUBLISH_BUCKET}${TDOCS_PUBLISH_PATH}"
    [[ "$s3_dest" != */ ]] && s3_dest="${s3_dest}/"

    # Extract host from endpoint
    local s3_host="${TDOCS_PUBLISH_ENDPOINT#https://}"
    s3_host="${s3_host#http://}"

    echo "Debug Info:"
    echo "   Source (resolved): $(cd "$source_path" && pwd)"
    echo "   S3 Destination: $s3_dest"
    echo "   Host: $s3_host"
    echo "   Host-bucket: ${TDOCS_PUBLISH_BUCKET}.${TDOCS_PUBLISH_REGION}.digitaloceanspaces.com"
    echo ""

    # Check if bucket path exists first (creates it if needed)
    echo "Checking bucket access..."
    if ! s3cmd ls \
        --access_key="$TDOCS_PUBLISH_ACCESS_KEY" \
        --secret_key="$TDOCS_PUBLISH_SECRET_KEY" \
        --host="$s3_host" \
        --host-bucket="${TDOCS_PUBLISH_BUCKET}.${TDOCS_PUBLISH_REGION}.digitaloceanspaces.com" \
        "$s3_dest" >/dev/null 2>&1; then
        echo "   Bucket path is empty or doesn't exist yet (this is OK for first upload)"
    else
        echo "   Bucket path exists"
    fi
    echo ""

    # Use put --recursive with proper path handling
    # Strip trailing slash from source to upload contents, not directory
    local source_clean="${source_path%/}"

    # Fix host-bucket template for DigitalOcean Spaces
    local host_bucket_template="%(bucket)s.${TDOCS_PUBLISH_REGION}.digitaloceanspaces.com"

    echo "Uploading..."
    # Change to source directory to upload files without preserving parent dir name
    (
        cd "$source_clean" && \
        s3cmd put \
            --recursive \
            --access_key="$TDOCS_PUBLISH_ACCESS_KEY" \
            --secret_key="$TDOCS_PUBLISH_SECRET_KEY" \
            --host="$s3_host" \
            --host-bucket="$host_bucket_template" \
            --region="$TDOCS_PUBLISH_REGION" \
            --acl-public \
            --no-mime-magic \
            --guess-mime-type \
            --verbose \
            . \
            "$s3_dest"
    )

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo ""
        echo "✅ Published successfully!"
        echo "   View at: $TDOCS_PUBLISH_PUBLIC_URL"
    else
        echo ""
        echo "❌ Publish failed (exit code: $exit_code)"
        return $exit_code
    fi
}

# ═══════════════════════════════════════════════════════════
# LIST PUBLISH TARGETS
# ═══════════════════════════════════════════════════════════

tdocs_list_publish_targets() {
    local org_name="${1:-$TETRA_ORG}"
    local show_details="${2:-false}"

    # Support --detailed flag
    if [[ "$org_name" == "--detailed" ]] || [[ "$org_name" == "-d" ]]; then
        show_details="true"
        org_name="${2:-$TETRA_ORG}"
    fi
    if [[ "$show_details" == "--detailed" ]] || [[ "$show_details" == "-d" ]]; then
        show_details="true"
    fi

    local org_toml=""
    if [[ -n "$org_name" ]]; then
        org_toml="$TETRA_DIR/orgs/$org_name/tetra.toml"
    else
        echo "Error: No organization specified" >&2
        return 1
    fi

    if [[ ! -f "$org_toml" ]]; then
        echo "Error: Organization TOML not found: $org_toml" >&2
        return 1
    fi

    # Source TOML parser
    if [[ -f "$TETRA_SRC/bash/deploy/toml.sh" ]]; then
        source "$TETRA_SRC/bash/deploy/toml.sh"
        toml_parse "$org_toml" "PUB_LIST" 2>/dev/null || {
            echo "Error: Failed to parse $org_toml" >&2
            return 1
        }
    fi

    echo "📋 Available publish targets:"
    echo ""

    # Get all [publish.*] sections
    local targets=($(grep -E '^\[publish\.' "$org_toml" | sed 's/\[publish\.\(.*\)\]/\1/' | sort))

    for target in "${targets[@]}"; do
        echo "  🎯 $target"

        if [[ "$show_details" == "true" ]]; then
            local section_name="publish_${target//./_}"
            local -n config_array="PUB_LIST_${section_name}"

            [[ -n "${config_array[bucket]}" ]] && echo "     Bucket:     ${config_array[bucket]}"
            [[ -n "${config_array[path]}" ]] && echo "     Path:       ${config_array[path]}"
            [[ -n "${config_array[public_url]}" ]] && echo "     URL:        ${config_array[public_url]}"
            [[ -n "${config_array[endpoint]}" ]] && echo "     Endpoint:   ${config_array[endpoint]}"
            [[ -n "${config_array[region]}" ]] && echo "     Region:     ${config_array[region]}"
            [[ -n "${config_array[source]}" ]] && echo "     Source:     ${config_array[source]}"
            echo ""
        fi
    done

    if [[ "$show_details" != "true" ]]; then
        echo ""
        echo "💡 Use --detailed or -d flag to see full configuration"
    fi

    echo ""
    echo "Usage:"
    echo "  tdocs publish <source> <target>"
    echo "  tdocs nginx-config <target>"
    echo "  tdocs publish-targets --detailed"
}

# Export functions
export -f tdocs_load_publish_config
export -f tdocs_generate_nginx_config
export -f tdocs_publish
export -f tdocs_list_publish_targets
