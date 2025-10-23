passed_tests=0
failed_tests=0
total_tests=0

# Check for verbose flag
if [[ "$1" == "-v" || "$1" == "--verbose" ]]; then
    VERBOSE=true
else
    VERBOSE=false
fi

print_status() {
    printf "\033[2K\r"  # Clear the current line
    echo -n "Tests: $total_tests/5 | Passed: $passed_tests | Failed: $failed_tests"
    if [ $failed_tests -gt 0 ]; then
        echo -n " ✘"
    elif [ $total_tests -eq 5 ]; then
        echo -n " ✔"
    else
        echo -n " ●"
    fi
    echo -n -e "\r"  # Move cursor to the beginning of the line
}

run_test() {
    local test_file=$1
    ((total_tests++))
    
    $VERBOSE && echo "Running test: $test_file"

    source ./setup.sh
    source "$test_file"
    local test_result=$?
    source ./teardown.sh

    if [ $test_result -eq 0 ]; then
        ((passed_tests++))
        $VERBOSE && echo "Test $test_file passed."
    else
        ((failed_tests++))
        $VERBOSE && echo "Test $test_file failed."
    fi

    print_status
    $VERBOSE && echo "-----------------------------------"
}

tests=(
    ./basic/test_init.sh
    #./nginx/test_route_alias_add.sh
    #./nginx/test_block_add.sh
    #./nginx/test_route_alias_remove.sh
    #./nginx/test_route_proxy_add.sh
)

for test in "${tests[@]}"; do
    run_test "$test"
    sleep .5
done

echo  # Print a newline for better formatting

echo -e "\e[32mPassed tests: $passed_tests\e[0m"
if [ $failed_tests -gt 0 ]; then
    echo -e "\e[31mFailed tests: $failed_tests\e[0m"
fi
