GHOST_DEV_PORT=2400
GHOST_DEBUG_PORT=7005
ghost=$ghost_sfo2_01    # semi-semantic (infra_detail)  to semantic (ghost)

ghost-mount(){
  sshfs root@$ghost:/ $HOME/mnt/ghost
}

ghost-dev(){
  NODE_ENV=development \
  NODE_OPTIONS="--tls-keylog=tls.log \
    --inspect=127.0.0.1:$GHOST_DEBUG_PORT" \
  ghost run
}

ghost-tunnel(){
  ssh -nNT -L $GHOST_DEV_PORT:127.0.0.1:$GHOST_DEV_PORT root@$ghost
}


ghost-tunnel-debug(){
  ssh -nNT -L $GHOST_DEBUG_PORT:127.0.0.1:$GHOST_DEBUG_PORT root@$ghost
}

ghost-clone-db(){
  mysqldump -u root ghost_prod > ghost_dev.sql
  mysql -u root ghost_dev < ghost_dev.sql

}

ghost-copy-content(){
  sudo cp -r /var/www/ghost/content /var/www/ghost/content_dev
  sudo chown -R  ghost:ghost /var/www/ghost/content_dev
}

ghost-local-init(){
  ghost-tunnel & 
  ghost-tunnel-debug &
  cat <<EOF

Node server running debugger via env vars used by $> ghost run

Application on $GHOST_DEV_PORT which is also set in

config.developmennt.json

Debugger on $GHOST_DEBUG_PORT

Use chrome://inspect and select localhost:$GHOST_DEBUG_PORT
to start debugging.

EOF

}
ghost-local-list(){
 ps | grep localhost 
}
ghost-local-kill(){
 ps | grep localhost | awk '{print $1}' | xargs kill
}
