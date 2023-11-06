if [[ -z "$GHOST_HOST" || \
     -z "$GHOST_DEBUG_PORT" || \
     -z "$GHOST_DEV_PORT"  ]]; then
  echo ""
  echo "  NOT ALL ENV SET"
  echo ""
fi

echo "Using GHOST_HOST=$GHOST_HOST"
echo "Using GHOST_DEV_PORT=$GHOST_DEV_PORT"
echo "Using GHOST_DEBUG_PORT=$GHOST_DEBUG_PORT"

ghost=$GHOST_HOST

ghost-login(){
  ssh root@$ghost
}

ghost-dev(){
  cd /var/www/ghost
  NODE_ENV=development \
  NODE_OPTIONS="--tls-keylog=tls.log \
    --inspect=127.0.0.1:$GHOST_DEBUG_PORT" \
  node current/index.js
}


ghost-clone-db(){
  mysqldump -u root ghost_prod > ghost_dev.sql
  mysql -u root ghost_dev < ghost_dev.sql
}

ghost-dev-nuke-brute(){
  echo " Truncate the brute table to reset magic link email lockout."
  mysql -e "TRUNCATE TABLE ghost_dev.brute;"
}

ghost-copy-content(){
  sudo cp -r /var/www/ghost/content /var/www/ghost/content_dev
  sudo chown -R  ghost:ghost /var/www/ghost/content_dev
}

ghost-packet-capture(){
ssh root@$ghost "dumpcap -i eth0 -i lo -w -" > /tmp/remote
}

ghost-packet-watch(){
   echo "Use tshark_run"
}

# -n: Redirects stdin from /dev/null, prevents reading from stdin
# -N: No remote command execution, useful for port forwarding only
# -T: Disable pseudo-terminal allocation
# -L: Port forwarding configuration
# The first  $GHOST_DEV_PORT: Local port number 
# 127.0.0.1: Loopback IP, connections made to local machine
# The second $GHOST_DEV_PORT: Port on remote machine
# root: User on the remote machine
# $ghost: Variable containing address of the remote server
ghost-tunnel(){
  ssh -nNT -L \
    $GHOST_DEV_PORT:127.0.0.1:$GHOST_DEV_PORT \
    root@$ghost &
}

ghost-tunnel-debug(){
  ssh -nNT -L \
    $GHOST_DEBUG_PORT:127.0.0.1:$GHOST_DEBUG_PORT \
    root@$ghost &
}


ghost-local-init(){
  ghost-tunnel       # runs in background, kill with PID
  ghost-tunnel-debug # runs in background, kill with PID
  cat <<EOF
  Application on $GHOST_DEV_PORT
  Debugger on $GHOST_DEBUG_PORT
  chrome://inspect and select localhost:$GHOST_DEBUG_PORT

EOF

}

ghost-local-list(){
 ps | grep localhost 
}
ghost-local-kill(){
 ps | grep localhost | awk '{print $1}' | xargs kill
}
