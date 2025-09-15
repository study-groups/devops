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
