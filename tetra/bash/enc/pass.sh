tetra_pass_get(){
  ssh "$TETRA_USER@$TETRA_PASS" \
  cat "/home/$TETRA_USER/files/txt/account_info.txt"
}

tetra_pass_generate() {
    # Number of words in the passphrase
    local NUM_WORDS=4
    local PASSPHRASE=""

    # Generate a passphrase
    for i in $(seq 1 $NUM_WORDS); do
        # Pick a random word from the dictionary and capitalize the first letter
        local WORD=$(shuf -n 1 /usr/share/dict/words)
        WORD=$(echo $WORD | sed 's/^./\u&/')

        # Generate a random integer for delineation
        local RAND_INT=$((RANDOM % 10))

        # Append the word and the random integer to the passphrase
        if [ $i -lt $NUM_WORDS ]; then
            PASSPHRASE+="${WORD}${RAND_INT}"
        else
            PASSPHRASE+="${WORD}"
        fi
    done

    echo "Generated passphrase: $PASSPHRASE"
}

