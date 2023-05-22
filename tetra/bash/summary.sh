# This code is in the main branch except for this line.
# https://tldp.org/LDP/abs/html/parameter-substitution.html
tetra-summarize-filesystems(){
local ips=""
ips=${1:-"$do1 $do2 $do3 $do3_fedora $do4 $do4_n2 $do5"}
cat <<EOF
<html>
<head>
</head>
<h1>System summary</h1>
EOF
for ip in ${ips[@]}
do
    local fstab="$(ssh root@$ip cat /etc/fstab)"
    local hostname="$(ssh root@$ip hostname)"
    local df="$(ssh root@$ip df -h | grep -v snap)"
    local inet="$(ssh root@$ip  ip a | grep inet)"
    echo "<h2>$hostname: $ip</h2>"
    echo "<h3>inet</h3>"
    echo "<pre>$inet</pre>"
    echo "<h3>/etc/fstab</h3>"
    echo "<pre>$fstab</pre>"
    echo "<h3>Disk usage via df</h3>"
    echo "<pre>$df</pre>"
done
cat <<EOF
<hr>
Created on $(hostname) at $(date).
</html>
EOF
}

_tetra-do-summarize-json(){

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
}

tetra-do-summarize-json(){
  _tetra-do-summarize-json | \
   jq 'walk(if type == "object" then 
       del(.sizes, .features, .regions) else . end)'
}
