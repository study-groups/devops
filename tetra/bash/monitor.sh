tetra_monitor_help(){
  cat <<EOF

  Shell functions for monitoring unix servers.

EOF
}

user="root"
host="$do4_n2"

tetra_remote_sysinfo(){
  ssh $user@$host landscape-sysinfo
}

tetra_remote_volinfo(){
  user=${1:-$user}
  host=${2:-$host}
  ssh $user@$host lsblk -f # show size
  ssh $user@$host lsblk -m # show permission
}
