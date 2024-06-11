alias ttks='tetra-tmux-kill-server'
alias ttt='tetra-tmux-tetra'
alias ttkt='tetra-tmux-kill-session tetra'
alias tttk='tetra-tmux-kill-session tetra'
alias tnlr='tetra_nginx_location_replace'
alias ttr='source $TETRA_DIR/tetra.sh'
#alias ttr='source $TETRA_SRC/bootstrap.sh'

tetra_remote_endpoint="$TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR"
tetra_remote_connector="$TETRA_REMOTE_USER@$TETRA_REMOTE"
alias tetra_remote_ls="ssh $TETRA_REMOTE_USER@$TETRA_REMOTE ls $TETRA_REMOTE_DIR"

alias tna='tetra_nvm_activate'
alias tpa='tetra_python_activate'

if [[ "$(uname)" == "Darwin" ]]; then
    # macOS uses a different syntax for 'date'
    #alias date='gdate'
    date() {
       command gdate "${@}"  # command stops function l
    }
    alias free='top -l 1 | grep PhysMem'
else
    # Linux and other Unix-like systems
    echo Standard Linux
    unalias date 2> /dev/null
    alias pbcopy='xclip -selection clipboard'
    alias pbpaste='xclip -selection clipboard -o'
fi
