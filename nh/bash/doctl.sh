nh_doctl_auth_list(){
  echo "DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"
  doctl auth list
}
nh_get_all() {
    output_file="$NH_JSON/digocean.json"
    true && {
        echo "["
        
        echo "{ \"Droplets\": "
        doctl compute droplet list --output json
        echo "},"
        
        echo "{ \"Volumes\": "
        doctl compute volume list --output json
        echo "},"
        
        echo "{ \"PrivateImages\": "
        doctl compute image list --public=false --output json
        echo "},"
        
        echo "{ \"Domains\": "
        doctl compute domain list --output json
        echo "},"
        
        echo "{ \"FloatingIPs\": "
        doctl compute floating-ip list --output json
        echo "},"
        
        echo "{ \"LoadBalancers\": "
        doctl compute load-balancer list --output json
        echo "},"
        
        echo "{ \"KubernetesClusters\": "
        doctl kubernetes cluster list --output json
        echo "}"
        
        echo "]"
    } > "$output_file"
    echo "Wrote to $output_file"
    wc $output_file
}


nh_clean_all() {
    local file="${1:-$NH_JSON/digocean_all.json}"
    cat "$file" | jq '
    walk(
        if type == "object" then
            del(.sizes, .features, .regions) |
            if .PrivateImages? then
                .PrivateImages |= map(select(.slug | not))
            else
                .
            end
        else
            .
        end
    )' > "$NH_JSON/digocean.json"
    wc $NH_JSON/digocean.json
}

nh_cat(){
  cat $NH_JSON/digocean.json | jq .
}
