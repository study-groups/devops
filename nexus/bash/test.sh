nexus_test_parse_1(){
    local test_pico_object="1716015559550762 MSG This is text, could be uuencoded data."
    echo "Testing with: $test_pico_object"
    nexus_parse_pico_object "$test_pico_object"
    echo
}

nexus_test_parse_2(){
    local test_pico_object="1716015559550762 to:[id1, id2] from:id4 MSG This is text."
    echo "Testing with: $test_pico_object"
    nexus_parse_pico_object "$test_pico_object"
    echo
}

nexus_test_parse_3(){
    local test_pico_object="1716015559550762 TYPE.subtype to:[id1, id2] from:id4 This is another text."
    echo "Testing with: $test_pico_object"
    nexus_parse_pico_object "$test_pico_object"
    echo
}

nexus_test_parse_4(){
    local test_pico_object="1716015559550762 TYPE This is a different text."
    echo "Testing with: $test_pico_object"
    nexus_parse_pico_object "$test_pico_object"
    echo
}

nexus_run_tests(){
    local test_suite=("nexus_test_parse_1" "nexus_test_parse_2" "nexus_test_parse_3" "nexus_test_parse_4")
    for test in "${test_suite[@]}"; do
        $test
    done
}

# Uncomment the following line to run the test function
# nexus_run_tests