
do_auth_list(){
  echo "DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"
  doctl auth list
}
do_get_all() {
    output_file="$DO_JSON/digocean_all.json"
    echo "DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"
    echo "output_file:$output_file"
 
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


dt_clean_all() {
    local file="${1:-$DOJSON/digocean_all.json}"
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
    )' > "$DO_JSON/digocean.json"
    wc $DO_JSON/digocean.json
}

dt_cat(){
  cat $DO_JSON/digocean.json | jq .
}
