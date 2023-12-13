tetra-prompt(){

  PS1='\[\e[0;38;5;228m\]\u@\h\[\e[0m\]:\[\e[0;38;5;45m\][\W]\[\e[0m\](\[\e[0;37m\]$(git branch 2>/dev/null | grep "^\*" | colrm 1 2)\[\e[0m\]): '

}
