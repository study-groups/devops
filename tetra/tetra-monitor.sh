tetra-monitor-help(){
  cat <<EOF
Shell functions for monitoring unix servers.
EOF
}

tetra-sysinfo(){
  local user="root"
  local host="$do4_n2"
  ssh $user@$host landscape-sysinfo
}
