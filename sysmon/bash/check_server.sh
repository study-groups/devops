sm_check_hostname(){
  ssh root@$1 hostname
}

sm_check_fstab(){
  ssh root@$1 "awk 'NF {print \$1 \"\n\" \$2 \"\n\" \$3, \$4, \$5, \$6 \"\n\"}' /etc/fstab"
}

sm_check_users(){
  ssh root@$1 "awk -F: '\$6 ~ /^\/home/ {print \$1}' /etc/passwd"
}

sm_check_ssh_keys(){
  ssh root@$1 "find /root/.ssh/ -name 'authorized_keys' -exec cat {} \; | awk '{print \$3}' | awk NF"
}

sm_check_systemctl_services(){
  local services=("pbase.service" "nginx.service" "cron.service" "containerd.service" "docker.service")
  for service in "${services[@]}"; do
    if ssh root@$1 systemctl is-active --quiet $service; then
      echo "$service: yes"
    else
      echo "$service: no"
    fi
  done
}

sm_check_cron_jobs(){
  ssh root@$1 "crontab -l"
}

sm_check_system_stats(){
  ssh root@$1 $HOME/src/devops/sysmon/watchdog/watchdog
}

sm_check_servers(){
  local ips=("$@")
  for ip in "${ips[@]}"; do
    echo "Checking server: $ip ($hostname)"
    
    # Get hostname
    hostname=$(sm_check_hostname $ip)
    echo "Hostname: $hostname"
    
    # Check if /root/nh exists
    if ssh root@$ip [ -d /root/nh ]; then
      echo "/root/nh exists on $ip ($hostname)"
    else
      echo "/root/nh does not exist on $ip ($hostname)"
    fi
    
    # List files in /etc/nginx/sites-enabled
    echo "Files in /etc/nginx/sites-enabled on $ip ($hostname):"
    sm_check_nginx_enabled $ip
    
    echo "fstab on $ip ($hostname):"
    sm_check_fstab $ip

    # List users
    echo "Users in /home on $ip ($hostname):"
    sm_check_users $ip
    
    # List SSH keys
    echo "SSH keys on $ip ($hostname):"
    sm_check_ssh_keys $ip
    
    # Summarize systemctl services
    echo "Running systemctl services on $ip ($hostname):"
    sm_check_systemctl_services $ip
    
    # Get system stats
    echo "System stats on $ip ($hostname):"
    sm_check_system_stats $ip
    
    # Check cron jobs
    echo "Cron jobs on $ip ($hostname):"
    sm_check_cron_jobs $ip
    
    echo "----------------------------------------"
  done
}

