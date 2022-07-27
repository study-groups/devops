# A finite automata (deterministic or non-deterministic)
# is made up of characters of an alphabet, states,
# and a state transition function with the following
# function signature (looks like Redux pattern):
#
#   next_state = t.f.(current_state, input_char)
#
# where input is the next char in the sequence.
#
# The transfer function can be thought of as a 
# set of transitions from one state from another
# and 'triggered' by character inputs.
#
#

# A finite automaton consists of (via tinyurl.com/yqw7f6nu):
# - a finite set Q of N states
# - a special start state
# - a set of final (or accepting) states
# - a set of transitions T from one state to another, 
#   labeled with chars in Alphabet
#
# Continue making transitions on each input char
# If no move is possible, then stop
# If in accepting state, then accept => REGULAR string

# An input string is considerd REGULAR if the 
# finite automoata that represents the language 
# returns true, i.e. 'accepts' the input 
# expression and is said to answer yes or no
# to the predicate question:
#
# Is the expression a valid string of the language?
#
# In bash:
# [[ $string_to_check =~ $language_as_described_by_regex ]];

regex-nom-id() {
  [[ $1 =~ [0-9]* ]]; echo ${BASH_REMATCH[@]}
}

regex-nom-type() {
  [[ $1 =~ [^.]+$ ]]; echo ${BASH_REMATCH[@]}
}

regex-nom-test() {
  [[ $1 =~ ^.+(0a)$ ]]; echo ${BASH_REMATCH[@]}
}
