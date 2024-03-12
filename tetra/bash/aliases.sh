alias ttks='tetra-tmux-kill-server'
alias ttt='tetra-tmux-tetra'
alias tttk='tetra-tmux-kill-session tetra'
alias tnlr='tetra_nginx_location_replace'

if [[ "$(uname)" == "Darwin" ]]; then
    # macOS uses a different syntax for 'date'
    alias date='gdate'
    alias free='top -l 1 | grep PhysMem'
else
    # Linux and other Unix-like systems
    echo Standard Linux
    alias date=date
    alias pbcopy='xclip -selection clipboard'
    alias pbpaste='xclip -selection clipboard -o'
fi
