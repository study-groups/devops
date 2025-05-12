#!/usr/bin/env bash

REMOTE_USER="${TETRA_REMOTE_USER:-devops}"
REMOTE_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"
LOCAL_PORT=$1
REMOTE_PORT=$1

export AUTOSSH_GATETIME=0
export AUTOSSH_LOGLEVEL=7
export AUTOSSH_LOGFILE="${TETRA_DIR:-$HOME/.tetra}/hotrod/logs/autossh-$REMOTE_PORT.log"

exec autossh -M 0 -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "ExitOnForwardFailure=yes" \
  -R "${REMOTE_PORT}:localhost:${LOCAL_PORT}" \
  "${REMOTE_USER}@${REMOTE_HOST}"
