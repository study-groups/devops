#!/bin/sh
session="startup"
tmux start-server
tmux new-session -d -s $session
tmux send '\
  source ~/src/ds-study-group/dstool.sh; \
  dstool-activate; \
  cd ~/src/ds-study-group/notebooks; \
  dstool-start-jupyterlab; \
  ' ENTER
tmux splitw -v -p 35
tmux send 'vmstat' ENTER
tmux selectp -t 2
tmux selectp -t 1
tmux attach-session -t $session
