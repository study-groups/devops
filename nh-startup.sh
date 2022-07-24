#!/bin/sh
session="startup"
tmux start-server
tmux new-session -d -s $session
tmux send 'source ~/src/ds-study-group/dstool.sh' ENTER
tmux send 'dstool-activate' ENTER
tmux send 'cd  ~/src/ds-study-group/notebooks' ENTER
tmux send 'dstool-start-jupyterlab' ENTER

tmux splitw -v -p 50 
tmux send 'dstool-activate' ENTER
tmux send 'cd  ~/src/devops-study-group' ENTER
tmux send 'mkdocs serve' ENTER

tmux splitw -v -p 50 
tmux send '\
cd ~/src/devops-study-group/tetra/;\
vmstat \
pwd \
' ENTER

tmux attach-session -t $session
