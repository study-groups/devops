qa_export() {
    for var in $(compgen -A variable QA); do
        export $var
    done
    
    for func in $(compgen -A function qa); do
        export -f $func
    done
    
    for func in $(compgen -A function _qa); do
        export -f $func
    done
}
