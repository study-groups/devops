#!/bin/bash
echo "In adapter"
while :
do
cat <<EOF
SSH_USER:$SSH_USER
REMOTE_HOST:$REMOTE_HOST
REMOTE_PORT:$REMOTE_PORT
EOF
	sleep 10
done
