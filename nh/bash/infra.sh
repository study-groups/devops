nh_load_env_vars() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    local output_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.env"
    
    {
        _nh_get_public_ip_addresses "$json_file"
        _nh_get_private_ip_addresses "$json_file"
        _nh_get_floating_ip_addresses "$json_file"
    } > "$output_file"
    
    source "$output_file"
}

nh_show_env_vars() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    
    {
        _nh_get_public_ip_addresses "$json_file"
        _nh_get_private_ip_addresses "$json_file"
        _nh_get_floating_ip_addresses "$json_file"
    }
}

_nh_get_public_ip_addresses() {
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
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
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
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
    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
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

nh_make_short_vars() {
    local prefix="$1"
    local varname newvar varvalue count

    declare -p | awk -v prefix="$prefix" '
        /^declare --/ && $3 ~ "^" prefix {
            split($3, parts, "_")
            newvar = ""
            for (i in parts) newvar = newvar substr(parts[i], 1, 1)

            print $3 " " newvar " " substr($0, index($0, "=") + 1)
        }
    ' | while read -r varname newvar varvalue; do
        varvalue=$(eval echo "$varvalue")

        count=1
        while declare -p "$newvar" &>/dev/null; do
            newvar="${newvar}_${count}"
            ((count++))
        done

        echo "${newvar}=$(printf "%q" "$varvalue") # $varname"
    done
}

