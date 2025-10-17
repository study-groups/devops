qa_review() {
    clear
    local index=0
    local db="$QA_DIR/db"
    local files=($(ls $db/*.answer | sort -n))
    local total=${#files[@]}

    # Commands to control navigation
    echo "Use 'j' (prev), 'l' (next), 'q' (quit)"

    # Initial rendering
    show_qa_pair $index
    while IFS= read -r -n1 key; do
        case "$key" in
            l)  # next
                ((index++))
                if [ $index -ge $total ]; then index=$(($total - 1)); fi
                show_qa_pair $index
                ;;
            j)  # previous
                ((index--))
                if [ $index -lt 0 ]; then index=0; fi
                show_qa_pair $index
                ;;
            q)
                break
                ;;
            *)
                ;;
        esac
    done
}

show_qa_pair() {
    local index=$1
    local prompt_file="${files[$index]/.answer/.prompt}"
    local prompt=$(cat "$prompt_file")
    local answer_file="${files[$index]}"
    local answer=$(cat "$answer_file")

    # Clear and display
    echo -ne "\033c"  # Clear screen
    echo -e "Question: $prompt\n"
    echo "-------------------------------"
    # Use chroma for formatted display
    local chroma_cmd="bash ${QA_SRC:-$(dirname "${BASH_SOURCE[0]}")}/chroma.sh"
    local tmpfile="/tmp/qa_review_$$.md"
    echo "$answer" > "$tmpfile"
    $chroma_cmd --pager "$tmpfile"
    rm -f "$tmpfile"
}

