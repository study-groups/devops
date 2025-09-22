#!/usr/bin/env bash

# NH to TOML Converter
# Converts NodeHolder digocean.json to Tetra organization TOML format

nh_to_toml_parse_digitalocean() {
    local json_file="$1"
    local org_name="$2"
    local output_file="$3"

    if [[ ! -f "$json_file" ]]; then
        echo "Error: DigitalOcean JSON file not found: $json_file" >&2
        return 1
    fi

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    if [[ -z "$output_file" ]]; then
        output_file="${org_name}.toml"
    fi

    # Extract droplet information using jq
    local droplets
    if ! droplets=$(jq -r '.[] | select(.Droplets) | .Droplets[]' "$json_file" 2>/dev/null); then
        echo "Error: Failed to parse DigitalOcean JSON" >&2
        return 1
    fi

    # Extract domain information
    local domains
    domains=$(jq -r '.[] | select(.Domains) | .Domains[]' "$json_file" 2>/dev/null)

    # Extract floating IPs
    local floating_ips
    floating_ips=$(jq -r '.[] | select(.FloatingIPs) | .FloatingIPs[]' "$json_file" 2>/dev/null)

    # Parse droplets and categorize by environment
    local dev_data staging_data prod_data
    local base_domain=""

    # Extract base domain from domains section
    if [[ -n "$domains" ]]; then
        base_domain=$(echo "$domains" | jq -r '.name' | head -1)
    fi

    # Parse each droplet
    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name tags region memory vcpus disk
        local public_ip private_ip floating_ip

        name=$(echo "$droplet" | jq -r '.name')
        tags=$(echo "$droplet" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ' ')
        region=$(echo "$droplet" | jq -r '.region.slug')
        memory=$(echo "$droplet" | jq -r '.memory')
        vcpus=$(echo "$droplet" | jq -r '.vcpus')
        disk=$(echo "$droplet" | jq -r '.disk')

        # Extract network information
        public_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1)
        private_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1)

        # Get floating IP for this droplet
        local droplet_id
        droplet_id=$(echo "$droplet" | jq -r '.id')
        floating_ip=$(echo "$floating_ips" | jq -r --arg id "$droplet_id" 'select(.droplet.id == ($id | tonumber)) | .ip' 2>/dev/null)

        # Categorize by environment based on name and tags
        if [[ "$name" =~ dev || "$tags" =~ dev ]]; then
            dev_data="name=$name,public_ip=$public_ip,private_ip=$private_ip,floating_ip=${floating_ip:-none},region=$region,memory=${memory}MB,vcpus=$vcpus,disk=${disk}GB"
        elif [[ "$name" =~ qa || "$name" =~ staging || "$tags" =~ qa ]]; then
            staging_data="name=$name,public_ip=$public_ip,private_ip=$private_ip,floating_ip=${floating_ip:-none},region=$region,memory=${memory}MB,vcpus=$vcpus,disk=${disk}GB"
        elif [[ "$name" =~ prod || "$tags" =~ production ]]; then
            prod_data="name=$name,public_ip=$public_ip,private_ip=$private_ip,floating_ip=${floating_ip:-none},region=$region,memory=${memory}MB,vcpus=$vcpus,disk=${disk}GB"
        fi
    done <<< "$droplets"

    # Generate TOML file
    cat > "$output_file" << EOF
# ${org_name} Organization Configuration
# Generated from DigitalOcean data on $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# Source: NodeHolder digocean.json

[metadata]
name = "${org_name}"
type = "digitalocean-managed"
description = "${org_name} infrastructure managed via DigitalOcean"
created_from_nh = true
generated_at = "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

[org]
name = "${org_name}"
description = "${org_name} infrastructure"
provider = "digitalocean"
region = "$(echo "$dev_data" | grep -o 'region=[^,]*' | cut -d= -f2)"

EOF

    # Add infrastructure section
    echo "[infrastructure]" >> "$output_file"
    echo "provider = \"digitalocean\"" >> "$output_file"

    if [[ -n "$dev_data" ]]; then
        local dev_name dev_public_ip dev_private_ip dev_floating_ip dev_specs
        dev_name=$(echo "$dev_data" | grep -o 'name=[^,]*' | cut -d= -f2)
        dev_public_ip=$(echo "$dev_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        dev_private_ip=$(echo "$dev_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        dev_floating_ip=$(echo "$dev_data" | grep -o 'floating_ip=[^,]*' | cut -d= -f2)
        dev_specs=$(echo "$dev_data" | grep -o 'memory=[^,]*,vcpus=[^,]*,disk=[^,]*' | tr ',' ' ')

        echo "dev_server_hostname = \"${dev_name}\"" >> "$output_file"
        echo "dev_server_ip = \"${dev_public_ip}\"" >> "$output_file"
        echo "dev_private_ip = \"${dev_private_ip}\"" >> "$output_file"
        [[ "$dev_floating_ip" != "none" ]] && echo "dev_floating_ip = \"${dev_floating_ip}\"" >> "$output_file"
        echo "# Dev specs: ${dev_specs}" >> "$output_file"
    fi

    if [[ -n "$staging_data" ]]; then
        local staging_name staging_public_ip staging_private_ip staging_floating_ip staging_specs
        staging_name=$(echo "$staging_data" | grep -o 'name=[^,]*' | cut -d= -f2)
        staging_public_ip=$(echo "$staging_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        staging_private_ip=$(echo "$staging_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        staging_floating_ip=$(echo "$staging_data" | grep -o 'floating_ip=[^,]*' | cut -d= -f2)
        staging_specs=$(echo "$staging_data" | grep -o 'memory=[^,]*,vcpus=[^,]*,disk=[^,]*' | tr ',' ' ')

        echo "staging_server_hostname = \"${staging_name}\"" >> "$output_file"
        echo "staging_server_ip = \"${staging_public_ip}\"" >> "$output_file"
        echo "staging_private_ip = \"${staging_private_ip}\"" >> "$output_file"
        [[ "$staging_floating_ip" != "none" ]] && echo "staging_floating_ip = \"${staging_floating_ip}\"" >> "$output_file"
        echo "# Staging specs: ${staging_specs}" >> "$output_file"
    fi

    if [[ -n "$prod_data" ]]; then
        local prod_name prod_public_ip prod_private_ip prod_floating_ip prod_specs
        prod_name=$(echo "$prod_data" | grep -o 'name=[^,]*' | cut -d= -f2)
        prod_public_ip=$(echo "$prod_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        prod_private_ip=$(echo "$prod_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        prod_floating_ip=$(echo "$prod_data" | grep -o 'floating_ip=[^,]*' | cut -d= -f2)
        prod_specs=$(echo "$prod_data" | grep -o 'memory=[^,]*,vcpus=[^,]*,disk=[^,]*' | tr ',' ' ')

        echo "prod_server_hostname = \"${prod_name}\"" >> "$output_file"
        echo "prod_server_ip = \"${prod_public_ip}\"" >> "$output_file"
        echo "prod_private_ip = \"${prod_private_ip}\"" >> "$output_file"
        [[ "$prod_floating_ip" != "none" ]] && echo "prod_floating_ip = \"${prod_floating_ip}\"" >> "$output_file"
        echo "# Prod specs: ${prod_specs}" >> "$output_file"
    fi

    # Add environment sections
    cat >> "$output_file" << EOF

[environments.local]
description = "Local development environment"
domain = "localhost"
app_port = 3000
node_env = "development"

EOF

    # Development environment
    if [[ -n "$dev_data" ]]; then
        local dev_public_ip dev_private_ip
        dev_public_ip=$(echo "$dev_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        dev_private_ip=$(echo "$dev_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)

        cat >> "$output_file" << EOF
[environments.dev]
description = "Development server environment"
server_hostname = "\${infrastructure.dev_server_hostname}"
server_ip = "${dev_public_ip}"
private_ip = "${dev_private_ip}"
domain = "dev.${base_domain}"
url = "https://dev.${base_domain}"
app_port = 3000
node_env = "development"
ssh_user = "tetra"
ssh_key_path = "~/.ssh/id_rsa"

EOF
    fi

    # Staging environment
    if [[ -n "$staging_data" ]]; then
        local staging_public_ip staging_private_ip
        staging_public_ip=$(echo "$staging_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        staging_private_ip=$(echo "$staging_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)

        cat >> "$output_file" << EOF
[environments.staging]
description = "Staging/QA environment"
server_hostname = "\${infrastructure.staging_server_hostname}"
server_ip = "${staging_public_ip}"
private_ip = "${staging_private_ip}"
domain = "qa.${base_domain}"
url = "https://qa.${base_domain}"
app_port = 3001
node_env = "staging"
ssh_user = "tetra"
ssh_key_path = "~/.ssh/id_rsa"

EOF
    fi

    # Production environment
    if [[ -n "$prod_data" ]]; then
        local prod_public_ip prod_private_ip prod_floating_ip
        prod_public_ip=$(echo "$prod_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        prod_private_ip=$(echo "$prod_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        prod_floating_ip=$(echo "$prod_data" | grep -o 'floating_ip=[^,]*' | cut -d= -f2)

        # Use floating IP for production if available
        local prod_main_ip="$prod_public_ip"
        if [[ "$prod_floating_ip" != "none" ]]; then
            prod_main_ip="$prod_floating_ip"
        fi

        cat >> "$output_file" << EOF
[environments.prod]
description = "Production environment"
server_hostname = "\${infrastructure.prod_server_hostname}"
server_ip = "${prod_main_ip}"
private_ip = "${prod_private_ip}"
domain = "${base_domain}"
url = "https://${base_domain}"
app_port = 80
node_env = "production"
ssh_user = "tetra"
ssh_key_path = "~/.ssh/id_rsa"

EOF
    fi

    # Add domains section
    cat >> "$output_file" << EOF
[domains]
base_domain = "${base_domain}"
dev = "dev.${base_domain}"
staging = "qa.${base_domain}"
prod = "${base_domain}"

EOF

    # Add variables section for NH compatibility
    cat >> "$output_file" << EOF
[variables]
# NH variable mappings for backwards compatibility
EOF

    if [[ -n "$dev_data" ]]; then
        local dev_public_ip dev_private_ip
        dev_public_ip=$(echo "$dev_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        dev_private_ip=$(echo "$dev_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        echo "pad = \"${dev_public_ip}\"         # NH development server variable" >> "$output_file"
        echo "padp = \"${dev_private_ip}\"       # NH development private IP" >> "$output_file"
    fi

    if [[ -n "$staging_data" ]]; then
        local staging_public_ip staging_private_ip
        staging_public_ip=$(echo "$staging_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        staging_private_ip=$(echo "$staging_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        echo "paq = \"${staging_public_ip}\"     # NH staging server variable" >> "$output_file"
        echo "paqp = \"${staging_private_ip}\"   # NH staging private IP" >> "$output_file"
    fi

    if [[ -n "$prod_data" ]]; then
        local prod_public_ip prod_private_ip prod_floating_ip
        prod_public_ip=$(echo "$prod_data" | grep -o 'public_ip=[^,]*' | cut -d= -f2)
        prod_private_ip=$(echo "$prod_data" | grep -o 'private_ip=[^,]*' | cut -d= -f2)
        prod_floating_ip=$(echo "$prod_data" | grep -o 'floating_ip=[^,]*' | cut -d= -f2)

        local prod_main_ip="$prod_public_ip"
        if [[ "$prod_floating_ip" != "none" ]]; then
            prod_main_ip="$prod_floating_ip"
        fi

        echo "pap = \"${prod_main_ip}\"        # NH production server variable" >> "$output_file"
        echo "papp = \"${prod_private_ip}\"      # NH production private IP" >> "$output_file"
    fi

    # Add services section
    cat >> "$output_file" << EOF

[services.app]
type = "nodejs"
environments = ["dev", "staging", "prod"]

[services.app.dev]
port = 3000
path = "."
start_command = "npm run dev"
env_file = "env/dev.env"

[services.app.staging]
port = 3001
path = "."
start_command = "npm run start"
env_file = "env/staging.env"

[services.app.prod]
port = 80
path = "."
start_command = "npm run start"
env_file = "env/prod.env"
EOF

    echo "Generated ${output_file} from ${json_file}"
    echo "Organization: ${org_name}"
    [[ -n "$dev_data" ]] && echo "  Dev environment detected"
    [[ -n "$staging_data" ]] && echo "  Staging environment detected"
    [[ -n "$prod_data" ]] && echo "  Production environment detected"
    echo "  Base domain: ${base_domain}"
}

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        help|--help|-h)
            cat << EOF
NH to TOML Converter

USAGE:
    nh_to_toml.sh <command> [options]

COMMANDS:
    parse <json_file> <org_name> [output_file]
        Parse DigitalOcean JSON and generate organization TOML

    help
        Show this help

EXAMPLES:
    nh_to_toml.sh parse ~/nh/pixeljam-arcade/digocean.json pixeljam-arcade
    nh_to_toml.sh parse digocean.json myorg myorg.toml
EOF
            ;;
        parse)
            shift
            nh_to_toml_parse_digitalocean "$@"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'nh_to_toml.sh help' for usage information"
            exit 1
            ;;
    esac
fi