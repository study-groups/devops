nh_doctl_status(){
  echo "NH_DIR=$NH_DIR"
  echo "Context available at Digital Ocean:"
  doctl auth list
  echo "DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"
  echo "doctl -h for more"
}

nh_doctl_get_all() {
    output_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean-all.json"
    echo "Writing to $output_file..." 

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
    wc $output_file >&2
}


nh_doctl_clean() {
    local file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean-all.json"
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
    )' > "$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    wc $NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json
    read -p "replace ?"
}

nh_doctl_cat(){
  cat $NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json | jq .
}
