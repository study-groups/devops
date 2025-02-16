sm_routes_nginx_enabled(){
  ssh root@$1 ls /etc/nginx/sites-enabled
}

sm_routes_nginx_site_summary(){
  local site=$1
  ssh root@$2 "awk -v site=$site '
    BEGIN {
      server_name = \"\";
      listen_ports = \"\";
      document_root = \"\";
      location_blocks = \"\";
      ssl_certificate = \"\";
      ssl_certificate_key = \"\";
      auth_basic = \"\";
      auth_basic_user_file = \"\";
      proxy_pass = \"\";
      proxy_set_header = \"\";
      seen_ports[\"80\"] = 0;
      seen_ports[\"443\"] = 0;
    }
    /server_name/ {
      for (i=2; i<=NF; i++) {
        if (\$i !~ /^[*;]/) {
          gsub(/;$/, \"\", \$i);
          if (server_name !~ \$i) {
            server_name = server_name \$i \"\\n\";
          }
        }
      }
      while (getline > 0 && \$0 ~ /^[[:space:]]+/) {
        for (i=1; i<=NF; i++) {
          if (\$i !~ /^[*;]/) {
            gsub(/;$/, \"\", \$i);
            if (server_name !~ \$i) {
              server_name = server_name \$i \"\\n\";
            }
          }
        }
      }
    }
    /listen/ {
      if (!seen_ports[\$2]) {
        listen_ports = listen_ports \$2 \"; \";
        seen_ports[\$2] = 1;
      }
    }
    /root/ { document_root = \$2; }
    /location/ { location_blocks = location_blocks \$2 \"\\n\"; }
    /ssl_certificate/ { ssl_certificate = \$2; }
    /ssl_certificate_key/ { ssl_certificate_key = \$2; }
    /auth_basic/ { auth_basic = \$2; }
    /auth_basic_user_file/ { auth_basic_user_file = \$2; }
    /proxy_pass/ { proxy_pass = \$2; }
    /proxy_set_header/ {
      if (proxy_set_header !~ \$2 \"=\" \$3) {
        proxy_set_header = proxy_set_header \$2 \"=\" \$3 \"\\n\";
      }
    }
    END {
      print \"Server Name:\\n\" server_name;
      print \"Listen Ports: \" listen_ports;
      print \"Document Root: \" document_root;
      print \"Location Blocks:\\n\" location_blocks;
      if (ssl_certificate != \"\") {
        print \"SSL Certificate: \" ssl_certificate;
      }
      if (ssl_certificate_key != \"\") {
        print \"SSL Certificate Key: \" ssl_certificate_key;
      }
      if (auth_basic != \"\") {
        print \"Auth Basic: \" auth_basic;
      }
      if (auth_basic_user_file != \"\") {
        print \"Auth Basic User File: \" auth_basic_user_file;
      }
      if (proxy_pass != \"\") {
        print \"Proxy Pass: \" proxy_pass;
      }
      if (proxy_set_header != \"\") {
        print \"Proxy Set Header:\\n\" proxy_set_header;
      }
    }
  ' /etc/nginx/sites-available/$site"
}

sm_routes_nginx_sites_summary(){
  local enabled_sites=($(sm_routes_nginx_enabled $1))
  for site in "${enabled_sites[@]}"; do
    echo "----------------------------------------"
    echo "Start of summary for site: $site"
    sm_routes_nginx_site_summary $site $1
    echo "End of summary for site: $site"
    echo "----------------------------------------"
  done
}

sm_routes_http_headers(){
  local domain=$1
  local url="http://$domain"
  ssh root@$2 "curl -s -I $url" || echo -e "\nFailed to fetch HTTP headers for URL: $url\n"
}

sm_routes_summary(){
  local ip=$1
  echo "Investigating endpoints on server: $ip"
  
  # List enabled sites
  echo "Nginx sites-enabled on server: $ip"
  sm_routes_nginx_enabled $ip
  
  # List available sites and provide summaries
  echo "Nginx sites summary on server: $ip"
  sm_routes_nginx_sites_summary $ip
  
  # Check HTTP headers for each site
  local enabled_sites=($(sm_routes_nginx_enabled $ip))
  for site in "${enabled_sites[@]}"; do
    local domain=$(ssh root@$ip "awk '/server_name/ {for (i=2; i<=NF; i++) print \$i; while (getline > 0 && \$0 ~ /^[[:space:]]+/) { print \$1; }}' /etc/nginx/sites-available/$site" | tr '\n' ' ')
    domain=$(echo $domain | xargs) # Trim leading and trailing whitespace
    domain=$(echo $domain | sed 's/ *\*[^ ]*//g') # Remove wildcard domains
    domain=$(echo $domain | tr ' ' '\n' | sort -u | tr '\n' ' ') # Remove duplicates
    if [ -z "$domain" ]; then
      echo "No server_name found for site: $site"
    else
      echo "HTTP headers for site: $site ($domain)"
      for d in $domain; do
        sm_routes_http_headers "$d" $ip
      done
    fi
    echo "----------------------------------------"
  done
}

# Example usage:
# ips=("192.168.1.1" "192.168.1.2" "192.168.1.3")
# for ip in "${ips[@]}"; do
#   sm_routes_summary $ip
# done