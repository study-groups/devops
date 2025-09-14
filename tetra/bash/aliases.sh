alias pbvm='$TETRA_SRC/bash/pbvm/pbvm.sh'
alias hotrod-paste='$TETRA_SRC/bash/hotrod/hotrod.sh'
alias hotrod-tunnel='$TETRA_SRC/bash/hotrod/tunnel.sh'
alias service-report='$TETRA_SRC/bash/reporting/service-report.sh'
alias tro='$TETRA_SRC/bash/hotrod/tro.sh'
alias ttro='$TETRA_SRC/bash/hotrod/tro.sh'
alias ttks='tetra-tmux-kill-server'
alias ttt='tetra-tmux-tetra'
alias ttkt='tetra-tmux-kill-session tetra'
alias tttk='tetra-tmux-kill-session tetra'
alias tnlr='tetra_nginx_location_replace'
# ttr is now defined in bootloader.sh as tetra_reload function

# Legacy prompt aliases - now use 'tp' command instead
# alias tps='MULTILINE=tiny'   # Use: tp s tiny
# alias tpt='MULTILINE=tiny'   # Use: tp s tiny  
# alias tpl='MULTILINE=true'   # Use: tp m on
 
alias phs="python -m http.server $1"
tetra_remote_endpoint="$TETRA_REMOTE_USER@$TETRA_REMOTE:$TETRA_REMOTE_DIR"
tetra_remote_connector="$TETRA_REMOTE_USER@$TETRA_REMOTE"
alias tetra_remote_ls="ssh $TETRA_REMOTE_USER@$TETRA_REMOTE ls $TETRA_REMOTE_DIR"
alias ttl="ssh $TETRA_REMOTE_USER@$TETRA_REMOTE ls $TETRA_REMOTE_DIR"

tte=$tetra_remote_endpoint
# ttr is now the tetra_reload function, not remote connector

# tna and tpa are now defined in bootloader.sh with proper lazy loading

if [[ "$(uname)" == "Darwin" ]]; then
    # macOS uses a different syntax for 'date'
    #alias date='gdate'
    date() {
       command gdate "${@}"  # command stops function l
    }
    alias free='top -l 1 | grep PhysMem'
else
    # Linux and other Unix-like systems
    [[ "${TETRA_DEBUG_LOADING:-false}" == "true" ]] && echo Standard Linux
    unalias date 2> /dev/null
    alias pbcopy='xclip -selection clipboard'
    alias pbpaste='xclip -selection clipboard -o'
fi
