#!/bin/bash

# Function: count_unique_domain_scopes
# Description:
#   Takes a list of domain_scope_coarse_fine strings and outputs a list of unique
#   domain_scope pairs along with the total number of occurrences for each pair.
#
# Usage:
#   count_unique_domain_scopes domain_scope_coarse_fine [domain_scope_coarse_fine ...]
#   Or, pipe input into the function.
#
# Example:
#   count_unique_domain_scopes \
#     domain1_scope1_coarse1_fine1 \
#     domain1_scope1_coarse2_fine2 \
#     domain2_scope2_coarse1_fine1 \
#     domain1_scope1_coarse1_fine3
#   Output:
#     domain1_scope1 3
#     domain2_scope2 1

count_unique_domain_scopes() {
  # Check if arguments are provided. If not, read from standard input.
  if [ $# -eq 0 ]; then
    input=$(cat)
  else
    input="$*"
  fi

  # Process the input:
  # 1. Extract the domain_scope part (first two fields separated by '_').
  # 2. Sort the extracted domain_scope strings.
  # 3. Use `uniq -c` to count occurrences.
  # 4. Sort the results in descending order of count.
  echo "$input" | \
    awk -F'_' '{print $1"_"$2}' | \
    sort | \
    uniq -c | \
    sort -nr | \
    while read count domain_scope; do
      echo "$domain_scope $count"
    done
}

# Export the function if you want to use it in subshells
export -f count_unique_domain_scopes
