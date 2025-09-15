tetra_monitor_help(){
  cat <<EOF

  Shell functions for monitoring unix servers.

EOF
}

tetra_monitor_sysinfo(){
  landscape-sysinfo
}

tetra_monitor_volinfo(){
  lsblk -f # show size
  lsblk -m # show permission
}

tetra_monitor_remote_sysinfo(){
  ssh $TETRA_USER@$TETRA_REMOTE landscape-sysinfo
}

tetra_monitor_remote_volinfo(){
  user=${1:-$TETRA_USER}
  host=${2:-$TETRA_REMOTE}
  ssh $TETRA_USER@$TETRA_REMOTE lsblk -f # show size
  ssh $TETRA_USER@$TETRA_REMOTE lsblk -m # show permission
}
