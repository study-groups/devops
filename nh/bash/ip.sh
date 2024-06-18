nh_ip_load_env_vars() {
    local json_file="${1:-$NH_DIR/json/digocean.json}"
    local output_file="$NH_DIR/ip_addresses.env"
    
    {
        _nh_get_public_ip_addresses "$json_file"
        _nh_get_private_ip_addresses "$json_file"
        _nh_get_floating_ip_addresses "$json_file"
    } > "$output_file"
    
    source "$output_file"
}

nh_ip_show_env_vars() {
    local json_file="${1:-$NH_DIR/json/digocean.json}"
    
    {
        _nh_get_public_ip_addresses "$json_file"
        _nh_get_private_ip_addresses "$json_file"
        _nh_get_floating_ip_addresses "$json_file"
    }
}

_nh_get_public_ip_addresses() {
    local json_file="${1:-$NH_DIR/json/digocean.json}"
    jq -r '
        .[] 
        | select(.Droplets != null) 
        | .Droplets[] 
        | (.name | gsub("-"; "_")) + "=" 
          + (.networks.v4[] 
              | select(.type == "public") 
              | .ip_address) 
          + "  # " + .region.slug + ", " 
          + (.memory | tostring) + "MB, " 
          + (.disk | tostring) + "GB"
    ' "$json_file"
}

_nh_get_private_ip_addresses() {
    local json_file="${1:-$NH_DIR/json/digocean.json}"
    jq -r '
        .[] 
        | select(.Droplets != null) 
        | .Droplets[] 
        | (.name | gsub("-"; "_")) + "_private=" 
          + (.networks.v4[] 
              | select(.type == "private") 
              | .ip_address) 
          + "  # " + .region.slug + ", " 
          + (.memory | tostring) + "MB, " 
          + (.disk | tostring) + "GB"
    ' "$json_file"
}

_nh_get_floating_ip_addresses() {
    local json_file="${1:-$NH_DIR/json/digocean.json}"
    jq -r '
        .[] 
        | select(.FloatingIPs != null) 
        | .FloatingIPs[] 
        | (.droplet.name | gsub("-"; "_") + "_floating") 
          + "=" + .ip 
          + "  # " + .droplet.region.slug + ", " 
          + (.droplet.memory | tostring) + "MB, " 
          + (.droplet.disk | tostring) + "GB"
    ' "$json_file"
}
