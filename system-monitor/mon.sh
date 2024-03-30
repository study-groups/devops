while true;
do
    clear;
    for ((i=0; i<$LINES/2; i++)); do
        echo;
    done;
    printf "%*s,%s" $(( $COLUMNS/2 )) $LINES $COLUMNS;
    sleep .2;
done
