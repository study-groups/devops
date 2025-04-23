# Read key-value pairs from env.sh into arrays
declare -a expected_keys
declare -a expected_values

while IFS='=' read -r key value; do
    # Skip lines that are comments or empty
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    expected_keys+=("$key")
    # Evaluate the value to resolve any variable references
    eval "expected_values+=(\"${value//\"/}\")"  # Remove any surrounding quotes
done < ./env.sh

# Function to check if a variable matches the expected value
check_variable() {
    local var_name=$1
    local expected_value=$2
    local actual_value=$(eval echo \$$var_name)

    # Trim whitespace from expected and actual values
    expected_value=$(echo "$expected_value" | xargs)
    actual_value=$(echo "$actual_value" | xargs)

    if [[ "$actual_value" != "$expected_value" ]]; then
        if [[ $VERBOSE == true ]]; then
            echo "$var_name not found or doesn't match expected value."
            echo "  Expected: $var_name: $expected_value"
            echo "  Actual:   $var_name: ${actual_value:-not set}"
        else
            echo ""
        fi
        return 1
    fi
    return 0
}

# Check each variable
for i in "${!expected_keys[@]}"; do
    echo "Checking ${expected_keys[$i]}: ${expected_values[$i]}"
    check_variable "${expected_keys[$i]}" "${expected_values[$i]}" || return 1
done

$VERBOSE && echo "test_pbase_env passed"
return 0
