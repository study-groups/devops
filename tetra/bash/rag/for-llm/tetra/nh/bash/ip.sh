_nh_get_public_ip_addresses() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    jq -r '
        .[] 
        | select(.Droplets != null) 
        | .Droplets[] 
        | "export " + (.name | gsub("-"; "_")) + "=" 
          + (.networks.v4 
              | map(select(.type == "public"))
              | .[0].ip_address) 
          + "  # " + .region.slug + ", " 
          + (.memory | tostring) + "MB, " 
          + (.disk | tostring) + "GB"
    ' "$json_file"
}

_nh_get_private_ip_addresses() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    jq -r '
        .[] 
        | select(.Droplets != null) 
        | .Droplets[] 
        | "export " + (.name | gsub("-"; "_")) + "_private=" 
          + (.networks.v4[] 
              | select(.type == "private")
              | .ip_address) 
          + "  # " + .region.slug + ", " 
          + (.memory | tostring) + "MB, " 
          + (.disk | tostring) + "GB"
    ' "$json_file"
}

_nh_get_floating_ip_addresses() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    jq -r '
        .[] 
        | select(.FloatingIPs != null) 
        | .FloatingIPs[] 
        | "export " + (.droplet.name | gsub("-"; "_") + "_floating") 
          + "=" + .ip 
          + "  # " + .droplet.region.slug + ", " 
          + (.droplet.memory | tostring) + "MB, " 
          + (.droplet.disk | tostring) + "GB"
    ' "$json_file"
}
