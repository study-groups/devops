sm_tls_certbot(){
  ssh root@$1 systemctl is-active --quiet certbot && echo "Certbot is running" || echo "Certbot is not running"
}

sm_tls_certs(){
  local cert_path="/etc/letsencrypt/live/qa.pixeljamarcade.com/fullchain.pem"
  ssh root@$1 "
    if [ -f $cert_path ]; then
      echo 'Found certificate at $cert_path'
      openssl x509 -in $cert_path -noout -enddate
    else
      echo 'TLS certificate not found at $cert_path'
      echo 'Available directories in /etc/letsencrypt/live/:'
      ls /etc/letsencrypt/live/
    fi
  "
}

sm_tls_letsencrypt_cron(){
  ssh root@$1 "crontab -l | grep 'certbot renew --quiet --deploy-hook \"/etc/letsencrypt/renewal-hooks/deploy/reload_nginx.sh\"' && echo 'Let's Encrypt cron job is set up' || echo 'Let's Encrypt cron job is not set up'"
}

sm_tls_certbot_renewal(){
  local ip=$1
  echo "Performing Certbot renewal check on server: $ip"
  
  # Check Certbot status
  echo "Checking Certbot status on server: $ip"
  sm_tls_certbot $ip
  
  # Check TLS certificates
  echo "Checking TLS certificates on server: $ip"
  sm_tls_certs $ip
  
  # Check Let's Encrypt cron job
  echo "Checking Let's Encrypt cron job on server: $ip"
  sm_tls_letsencrypt_cron $ip
  
  # Perform Certbot dry run
  echo "Performing Certbot dry run on server: $ip"
  ssh root@$ip "certbot renew --dry-run --deploy-hook \"/etc/letsencrypt/renewal-hooks/deploy/reload_nginx.sh\""
  
  echo "----------------------------------------"
}

# Example usage:
# ips=("192.168.1.1" "192.168.1.2" "192.168.1.3")
# for ip in "${ips[@]}"; do
#   sm_tls_certbot_renewal $ip
# done