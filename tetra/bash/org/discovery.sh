#!/usr/bin/env bash

# Tetra Infrastructure Discovery
# Interactive discovery and mapping of DigitalOcean infrastructure to Tetra environments

# Main entry point for infrastructure discovery
tetra_discover_infrastructure() {
    local json_file="$1"
    local org_name="${2:-}"
    local output_mapping="${3:-}"

    if [[ ! -f "$json_file" ]]; then
        echo "Error: DigitalOcean JSON file not found: $json_file" >&2
        return 1
    fi

    # Auto-detect org name from path if not provided
    if [[ -z "$org_name" ]]; then
        org_name=$(basename "$(dirname "$json_file")" | tr '-' '_')
        echo "Auto-detected organization name: $org_name"
    fi

    # Default output mapping location
    if [[ -z "$output_mapping" ]]; then
        output_mapping="/tmp/${org_name}_mapping.json"
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  DIGITALOCEAN INFRASTRUCTURE DISCOVERY"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Reading: $json_file"
    echo ""

    # Parse and display all resources
    local droplets_data
    local domains_data
    local floating_ips_data
    local volumes_data

    droplets_data=$(_discover_parse_droplets "$json_file")
    domains_data=$(_discover_parse_domains "$json_file")
    floating_ips_data=$(_discover_parse_floating_ips "$json_file")
    volumes_data=$(_discover_parse_volumes "$json_file")

    # Display discovered resources
    _discover_display_droplets "$droplets_data"
    _discover_display_floating_ips "$floating_ips_data"
    _discover_display_domains "$domains_data"
    _discover_display_volumes "$volumes_data"

    # Auto-suggest environment mappings
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  SUGGESTED ENVIRONMENT MAPPINGS"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    local suggested_mappings
    suggested_mappings=$(_discover_suggest_mappings "$json_file" "$droplets_data" "$domains_data" "$floating_ips_data")

    echo "$suggested_mappings"
    echo ""

    # Interactive confirmation
    local final_mappings="$suggested_mappings"
    local response

    echo -n "Accept these mappings? [Y/n/edit]: "
    read -r response

    case "${response,,}" in
        n|no)
            echo "Discovery cancelled."
            return 1
            ;;
        e|edit)
            final_mappings=$(_discover_interactive_edit "$suggested_mappings" "$droplets_data")
            ;;
        *)
            # Accept (Y, yes, or Enter)
            ;;
    esac

    # Generate mapping file
    _discover_generate_mapping "$json_file" "$org_name" "$final_mappings" "$output_mapping"

    # Show next steps
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  NEXT STEPS"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Mapping saved to: $output_mapping"
    echo ""
    echo "Options:"
    echo "  [1] Import now with these mappings"
    echo "      → tetra org import json $json_file $org_name --mapping $output_mapping"
    echo ""
    echo "  [2] Save mapping for later"
    echo "      → cp $output_mapping ~/tetra/orgs/${org_name}.mapping.json"
    echo ""
    echo "  [3] Review/edit mapping file"
    echo "      → \$EDITOR $output_mapping"
    echo ""

    return 0
}

# Parse droplets from digocean.json
_discover_parse_droplets() {
    local json_file="$1"

    jq -r '.[] | select(.Droplets) | .Droplets[] |
        @json' "$json_file" 2>/dev/null
}

# Parse domains from digocean.json
_discover_parse_domains() {
    local json_file="$1"

    jq -r '.[] | select(.Domains) | .Domains[] |
        @json' "$json_file" 2>/dev/null
}

# Parse floating IPs from digocean.json
_discover_parse_floating_ips() {
    local json_file="$1"

    jq -r '.[] | select(.FloatingIPs) | .FloatingIPs[] |
        @json' "$json_file" 2>/dev/null
}

# Parse volumes from digocean.json
_discover_parse_volumes() {
    local json_file="$1"

    jq -r '.[] | select(.Volumes) | .Volumes[] |
        @json' "$json_file" 2>/dev/null
}

# Display droplets in table format
_discover_display_droplets() {
    local droplets_data="$1"

    if [[ -z "$droplets_data" ]]; then
        echo "DROPLETS: None found"
        return
    fi

    local count
    count=$(echo "$droplets_data" | wc -l | tr -d ' ')

    echo "DROPLETS ($count found):"

    printf "┌────────────┬──────────────────────┬──────────────────┬─────────────┬──────────────┐\n"
    printf "│ %-10s │ %-20s │ %-16s │ %-11s │ %-12s │\n" "ID" "Name" "Public IP" "Private IP" "Tags"
    printf "├────────────┼──────────────────────┼──────────────────┼─────────────┼──────────────┤\n"

    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local id name public_ip private_ip tags
        id=$(echo "$droplet" | jq -r '.id')
        name=$(echo "$droplet" | jq -r '.name')
        public_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1)
        private_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1)
        tags=$(echo "$droplet" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

        printf "│ %-10s │ %-20s │ %-16s │ %-11s │ %-12s │\n" \
            "$id" "${name:0:20}" "$public_ip" "$private_ip" "${tags:0:12}"
    done <<< "$droplets_data"

    printf "└────────────┴──────────────────────┴──────────────────┴─────────────┴──────────────┘\n"
    echo ""
}

# Display floating IPs
_discover_display_floating_ips() {
    local floating_ips_data="$1"

    if [[ -z "$floating_ips_data" ]]; then
        return
    fi

    local count
    count=$(echo "$floating_ips_data" | wc -l | tr -d ' ')

    echo "FLOATING IPs ($count found):"

    while IFS= read -r fip; do
        [[ -z "$fip" ]] && continue

        local ip droplet_name
        ip=$(echo "$fip" | jq -r '.ip')
        droplet_name=$(echo "$fip" | jq -r '.droplet.name // "unassigned"')

        echo "  • $ip → $droplet_name"
    done <<< "$floating_ips_data"

    echo ""
}

# Display domains and DNS records
_discover_display_domains() {
    local domains_data="$1"

    if [[ -z "$domains_data" ]]; then
        return
    fi

    local count
    count=$(echo "$domains_data" | wc -l | tr -d ' ')

    echo "DOMAINS ($count found):"

    while IFS= read -r domain; do
        [[ -z "$domain" ]] && continue

        local domain_name zone_file
        domain_name=$(echo "$domain" | jq -r '.name')
        zone_file=$(echo "$domain" | jq -r '.zone_file')

        echo "  • $domain_name"

        # Parse A records from zone file
        echo "$zone_file" | grep -E '^\S+.*IN\s+A\s+' | while read -r line; do
            local record_name ip
            record_name=$(echo "$line" | awk '{print $1}')
            ip=$(echo "$line" | awk '{print $NF}')
            echo "    - $record_name → $ip"
        done
    done <<< "$domains_data"

    echo ""
}

# Display volumes
_discover_display_volumes() {
    local volumes_data="$1"

    if [[ -z "$volumes_data" ]]; then
        return
    fi

    local count
    count=$(echo "$volumes_data" | wc -l | tr -d ' ')

    echo "VOLUMES ($count found):"

    while IFS= read -r volume; do
        [[ -z "$volume" ]] && continue

        local name size droplet_ids
        name=$(echo "$volume" | jq -r '.name')
        size=$(echo "$volume" | jq -r '.size_gigabytes')
        droplet_ids=$(echo "$volume" | jq -r '.droplet_ids[]?' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

        if [[ -n "$droplet_ids" ]]; then
            echo "  • $name (${size}GB) → attached to droplet(s): $droplet_ids"
        else
            echo "  • $name (${size}GB) → unattached"
        fi
    done <<< "$volumes_data"

    echo ""
}

# Auto-suggest environment mappings based on heuristics
_discover_suggest_mappings() {
    local json_file="$1"
    local droplets_data="$2"
    local domains_data="$3"
    local floating_ips_data="$4"

    declare -A env_map
    env_map[local]="localhost:127.0.0.1:local"

    # Analyze each droplet
    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local id name public_ip private_ip tags
        id=$(echo "$droplet" | jq -r '.id')
        name=$(echo "$droplet" | jq -r '.name')
        public_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1)
        private_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1)
        tags=$(echo "$droplet" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

        # Get floating IP if assigned
        local floating_ip
        floating_ip=$(echo "$floating_ips_data" | jq -r --arg did "$id" \
            'select(.droplet.id == ($did | tonumber)) | .ip' 2>/dev/null)

        # Determine environment based on name and tags
        local env=""
        local reason=""

        if [[ "$name" =~ dev || "$tags" =~ dev ]]; then
            env="dev"
            reason="matches 'dev' in name or tags"
        elif [[ "$name" =~ qa || "$name" =~ staging || "$tags" =~ qa || "$tags" =~ staging ]]; then
            env="staging"
            reason="matches 'qa' or 'staging' in name or tags"
        elif [[ "$name" =~ prod || "$tags" =~ production || "$tags" =~ prod ]]; then
            env="prod"
            reason="matches 'prod' or 'production' in name or tags"
        fi

        # Get domain hint
        local domain_hint=""
        if [[ -n "$domains_data" ]]; then
            domain_hint=$(echo "$domains_data" | jq -r --arg ip "${floating_ip:-$public_ip}" \
                '.zone_file // "" | split("\n")[] | select(contains($ip)) | split(" ")[0]' 2>/dev/null | head -1)
        fi

        if [[ -n "$env" ]]; then
            local display_ip="${floating_ip:-$public_ip}"
            local ip_note="$public_ip"
            [[ -n "$floating_ip" ]] && ip_note="$floating_ip (floating)"

            env_map[$env]="$name:$display_ip:$private_ip:$floating_ip:$reason:$domain_hint:$id"
        fi
    done <<< "$droplets_data"

    # Format output
    echo "Based on droplet names, tags, and DNS records:"
    echo ""
    echo "  @local   → localhost (your machine)"

    for env in dev staging prod; do
        if [[ -n "${env_map[$env]:-}" ]]; then
            IFS=':' read -r name ip private_ip floating_ip reason domain_hint id <<< "${env_map[$env]}"

            local display_ip="$ip"
            [[ -n "$floating_ip" && "$floating_ip" != "null" ]] && display_ip="$floating_ip (floating)"

            printf "  @%-8s → %s (%s)\n" "$env" "$name" "$display_ip"
            printf "              Reason: %s" "$reason"
            [[ -n "$domain_hint" && "$domain_hint" != "null" ]] && printf ", DNS: %s" "$domain_hint"
            printf "\n"
        fi
    done

    # Return mappings in parseable format for later use
    echo ""
    echo "__MAPPINGS_DATA__"
    for env in local dev staging prod; do
        if [[ -n "${env_map[$env]:-}" ]]; then
            echo "$env:${env_map[$env]}"
        fi
    done
}

# Interactive edit of environment mappings
_discover_interactive_edit() {
    local suggested_mappings="$1"
    local droplets_data="$2"

    echo ""
    echo "Edit Environment Mappings:"
    echo ""

    # Extract current mappings
    declare -A current_map
    while IFS= read -r line; do
        [[ "$line" =~ ^__MAPPINGS_DATA__$ ]] && break
    done <<< "$suggested_mappings"

    while IFS=':' read -r env rest; do
        [[ -z "$env" || -z "$rest" ]] && continue
        current_map[$env]="$rest"
    done < <(echo "$suggested_mappings" | sed -n '/__MAPPINGS_DATA__/,$p' | tail -n +2)

    # Build droplet selection list
    declare -a droplet_list
    local idx=1
    while IFS= read -r droplet; do
        [[ -z "$droplet" ]] && continue

        local name public_ip
        name=$(echo "$droplet" | jq -r '.name')
        public_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1)

        droplet_list[$idx]="$name:$public_ip:$droplet"
        ((idx++))
    done <<< "$droplets_data"

    # Edit each environment
    for env in dev staging prod; do
        local current="${current_map[$env]:-}"
        local current_name=""
        [[ -n "$current" ]] && current_name=$(echo "$current" | cut -d':' -f1)

        echo "@$env currently: ${current_name:-none}"

        for i in "${!droplet_list[@]}"; do
            IFS=':' read -r name ip _ <<< "${droplet_list[$i]}"
            local marker=""
            [[ "$name" == "$current_name" ]] && marker=" ← current"
            printf "  [%d] %s (%s)%s\n" "$i" "$name" "$ip" "$marker"
        done

        [[ "$env" != "dev" ]] && echo "  [same] Use same as @dev (multi-env on one server)"
        echo "  [none] No $env environment"
        echo -n "Select [1-${#droplet_list[@]}, "
        [[ "$env" != "dev" ]] && echo -n "same, "
        echo -n "none, or Enter to keep]: "

        local choice
        read -r choice

        if [[ -n "$choice" && "$choice" != "" ]]; then
            case "$choice" in
                none)
                    unset current_map[$env]
                    ;;
                same)
                    if [[ "$env" != "dev" && -n "${current_map[dev]:-}" ]]; then
                        current_map[$env]="${current_map[dev]}"
                    fi
                    ;;
                [0-9]*)
                    if [[ -n "${droplet_list[$choice]:-}" ]]; then
                        IFS=':' read -r name ip droplet <<< "${droplet_list[$choice]}"
                        local id private_ip floating_ip
                        id=$(echo "$droplet" | jq -r '.id')
                        private_ip=$(echo "$droplet" | jq -r '.networks.v4[] | select(.type == "private") | .ip_address' | head -1)
                        floating_ip=""

                        current_map[$env]="$name:$ip:$private_ip:$floating_ip:user_selected::$id"
                    fi
                    ;;
            esac
        fi

        echo ""
    done

    # Format updated mappings
    echo "Updated mappings:"
    echo ""
    echo "  @local   → localhost"

    for env in dev staging prod; do
        if [[ -n "${current_map[$env]:-}" ]]; then
            local name ip
            IFS=':' read -r name ip _ <<< "${current_map[$env]}"
            printf "  @%-8s → %s (%s)\n" "$env" "$name" "$ip"
        fi
    done

    echo ""
    echo "__MAPPINGS_DATA__"
    for env in local dev staging prod; do
        if [[ -n "${current_map[$env]:-}" ]]; then
            echo "$env:${current_map[$env]}"
        fi
    done
}

# Generate mapping JSON file
_discover_generate_mapping() {
    local json_file="$1"
    local org_name="$2"
    local mappings="$3"
    local output_file="$4"

    # Extract mapping data
    declare -A env_data
    while IFS=':' read -r env rest; do
        [[ -z "$env" || -z "$rest" ]] && continue
        env_data[$env]="$rest"
    done < <(echo "$mappings" | sed -n '/__MAPPINGS_DATA__/,$p' | tail -n +2)

    # Generate JSON
    cat > "$output_file" << EOF
{
  "org_name": "$org_name",
  "discovered_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "source": "$json_file",
  "environments": {
EOF

    local first=true
    for env in local dev staging prod; do
        if [[ -n "${env_data[$env]:-}" ]]; then
            [[ "$first" == false ]] && echo "," >> "$output_file"
            first=false

            if [[ "$env" == "local" ]]; then
                cat >> "$output_file" << EOF
    "local": {
      "type": "localhost",
      "address": "127.0.0.1"
    }
EOF
            else
                IFS=':' read -r name ip private_ip floating_ip reason domain_hint id <<< "${env_data[$env]}"

                cat >> "$output_file" << EOF
    "$env": {
      "droplet_id": $id,
      "droplet_name": "$name",
      "address": "$ip",
      "private_ip": "$private_ip"
EOF

                [[ -n "$floating_ip" && "$floating_ip" != "null" ]] && \
                    echo "      \"floating_ip\": \"$floating_ip\"," >> "$output_file"

                [[ -n "$domain_hint" && "$domain_hint" != "null" ]] && \
                    echo "      \"domain\": \"$domain_hint\"," >> "$output_file"

                # Remove trailing comma from last property
                sed -i '' '$s/,$//' "$output_file"

                echo "    }" >> "$output_file"
            fi
        fi
    done

    cat >> "$output_file" << EOF

  }
}
EOF

    echo ""
    echo "Mapping file generated: $output_file"
}

# Export functions
export -f tetra_discover_infrastructure
