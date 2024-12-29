tetra_doctl_get_droplets(){
    doctl compute droplet list --output json \
    | tetra_infra_filter \
    > $TETRA_INFRA/droplets.json
}

tetra_infra_name_to_id() {
    local input_file="$TETRA_INFRA/droplets.json"

    jq -c '.[] | {id: .id, name: .name}' "$input_file" | while read -r droplet; do
        droplet_id=$(echo "$droplet" | jq -r '.id')
        droplet_name=$(echo "$droplet" | jq -r '.name')
        echo "${droplet_name}=${droplet_id}"
    done
}


tetra_infra_hosts() {
    local input_file="$TETRA_INFRA/droplets.json"

    jq -c '.[]' "$input_file" | while read -r host; do
        hostname=$(echo "$host" | jq -r '.name')
        pub_ipv4=$(echo "$host" | jq -r '.networks.v4[] | select(.type == "public").ip_address // empty')
        priv_ipv4=$(echo "$host" | jq -r '.networks.v4[] | select(.type == "private").ip_address // empty')
        pub_ipv6=$(echo "$host" | jq -r '.networks.v6[] | select(.type == "public").ip_address // empty')

        if [ -n "$hostname" ]; then
            echo "${hostname}_pub=$pub_ipv4"
            echo "${hostname}_priv=$priv_ipv4"
            echo "${hostname}_v6=$pub_ipv6"
            echo "hostname=${hostname}_pub"
            echo ""
        fi
    done
}

tetra_infra_filter() {
    local ignore=(region sizes)
    jq_filter="map(del(.region) | del(.size.regions))"
    jq "$jq_filter"
}

tetra_infra_droplets_cat(){
  cat $TETRA_INFRA/droplets.json
}

tetra_infra_services(){
  local TETRA_SERVICES=$TETRA_INFRA/services
  cat <<EOF
nginx=$TETRA_SERVICES/nginx.sh
redis=$TETRA_SERVICES/redis.sh
rabbitmq=$TETRA_SERVICES/rabbitmq.sh
nexus=$TETRA_SERVICES/nexus.sh
prometheus=$TETRA_SERVICES/prometheus.sh
grafana=$TETRA_SERVICES/grafana.sh
jupyter=$TETRA_SERVICES/jupyter.sh
platform=$TETRA_SERVICES/pixeljam.sh
platform_control=$TETRA_SERVICES/pixeljam_qa.sh
platform_monitor=$TETRA_SERVICES/pixeljam_monitor.sh
EOF

}


tetra_infra_floating() {
    local input_file="$TETRA_INFRA/droplets.json"
    
    # Extract the floating IP addresses
    floatingEast=$(jq -r '
        .[] 
        | .networks.v4[]? 
        | select(.ip_address == "174.138.110.75").ip_address
        ' "$input_file" | head -n 1)

    floatingWest=$(jq -r '
        .[] 
        | .networks.v4[]? 
        | select(.ip_address == "68.183.248.67").ip_address
        ' "$input_file" | head -n 1)

    # Print the results
    echo "floatingEast=$floatingEast"
    echo "floatingWest=$floatingWest"
}

