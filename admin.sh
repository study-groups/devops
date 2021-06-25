# admin.sh
#source ~/server.list
#source ~/custom.sh

#PS1="admin@do4> "

admin-help(){
  cat << EOF
Bash functions defined in ~/$USER.sh will be sourced upon login.
Git and Tmux helpers for Nodeholder admin account.

Tmux
---
tmux-list
tmux-join session_name
tmux-kill session_name

EOF
}

tmux-list(){
  tmux list-sessions # aka tmux ls
}

tmux-join(){
  tmux attach -t $1     # $? is result of attempt to attach
  [ $? == 1 ] && tmux new -s $1
}

tmux-kill(){
  tmux kill-session -t $1
}
