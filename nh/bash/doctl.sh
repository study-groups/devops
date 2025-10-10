nh_doctl_status(){
  echo "NH_DIR=$NH_DIR"
  echo "Context available at Digital Ocean:"
  doctl auth list
  echo "DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"
  echo "doctl -h for more"
}

nh_doctl_get_all() {
    output_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
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

nh_doctl_cat(){
  cat $NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json | jq .
}

_truncate_columns() 
{ 
    local max_width=80;
    local delim="    ";
    local col_widths=(10 15 16 15 8 6 5 8 10 10 8 15);
    local col_count=${#col_widths[@]};
    while IFS= read -r line; do
        local truncated_line="";
        local i=0;
        for field in $line;
        do
            if [[ $i -ge $col_count ]]; then
                break;
            fi;
            truncated_field=$(echo "$field" | cut -c1-"${col_widths[$i]}");
            truncated_line+="$truncated_field$delim";
            ((i++));
        done;
        echo "${truncated_line:0:$max_width}";
    done
}

nh_doctl_droplets(){
  doctl compute droplet list | _truncate_columns 
}
