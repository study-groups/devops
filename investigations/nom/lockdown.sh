nom-lockdown-gen-all(){
  nom-lockdown-gen-text | nom-lockdown-line-to-nom
  nom-lockdown-gen-text | nom-lockdown-text-to-nom
  nom-lockdown-gen-unit
  nom-lockdown-gen-nom-action-unit  0000000000000000002
}

# generates nom unit
nom-lockdown-gen-unit(){
   echo "0000000000000000002"
   echo "data.unit"
   echo "0000000000000000001"
   echo ""
}

# generates text object
# use: nom-lockdown-gen-text-nom $1
nom-lockdown-gen-text-nom(){
  local line=${1:-"This is line one and it is."}
  echo -e "$line" | nom-lockdown-line-to-nom
}

# generates text object paragraph
nom-lockdown-gen-text() {
  cat <<EOF
This is line one and it is good.
Went to the movie, it was okay.
When will the sun rise? In the morning.
EOF
}

# generates nom line item example
# use: echo $1 | nom-lockdown-line-to-nom
# single line => type.text
nom-lockdown-line-to-nom(){
  while IFS= read -r line
  do
    nom-lockdown-id
    echo data.text
    echo "$line"
    echo ""
  done < /dev/stdin
}

# generates nom line item array example
# use: echo $1 | nom-lockdown-text-to-nom
# list of single lines => type.array.text
nom-lockdown-text-to-nom(){
  nom-lockdown-id
  echo data.lines
  while IFS= read -r line
  do
    echo "$line"
  done < /dev/stdin
  echo ""
}

# generates id hash
nom-lockdown-id(){
  echo $(date +%s%N)
}

# the unit. used to test the mechanism of dispatch
# without defining custome types.
# use: nom-lockdown-action-unit $1
nom-lockdown-action-unit(){
  nom-lockdown-id
  echo "data.lockdown-action-unit"
  echo "$1" 
  echo ""
}

nom-lockdown-dispatch-object(){
  local obj=($(cat -))
  echo "Object type: ${obj[1]}"
} 

nom-log-echo(){
  echo $1 > ${2:-/dev/stdout}
}
# https://stackoverflow.com/a/18539622/4249785
# Read up to special character, update var
# Use printf for reliable new lines

# use: nom-lockdown-gen-text-nom "What's up?" | nom-lockdown-dispatch
nom-lockdown-dispatch(){
  # Change blank new line to \xBF upside down q mark. MUST CHANGE
  sed -e 's/^$/\xBF/' | while read -d $'\xBF' stanza  # stanza stays local
  do
    #printf "Considering:\n%s\n-----\n" "$stanza"  #ADD DEBUG FLAG OR SOMETHING
    printf "Id: %s\n" "$(echo $stanza | nom-lockdown-nom-to-id )"
    local type="$(echo $stanza | nom-lockdown-nom-to-type )"
    printf "Type: %s\n" "$type"
    printf "Data:\n" 
    local data_id=$(echo "$stanza" | nom-lockdown-nom-to-data)
    log-echo "Data id: $data_id"
    log-echo "Awaiting dispatch..."
    local data=$(nom-lockdown-id-to-data $data_id);
    # function that exectues action
    # type=action.bash-function-name
    # call bash-function-name if it exists
    # log error otherwise
    # uses action type
    # passes data to function associated with action type
    #nom-lockdown-type-to-action 
    [[ "$type" =~ ^action ]] && \
        action=$(echo "$type" | awk -F"." '{ print $2 }') &&\
        $action $(nom-lockdown-id-to-data  $data)   #$data is an id!
     
  done
}

# use default nomdb/data dir to find file and then grab data
nom-lockdown-id-to-data(){
   cat ~/src/devops-study-group/investigations/nom/nomdb/data/$1
}

nom-lockdown-action-test-nlp-array(){
  nom-lockdown-id
  echo data.sentiments
  # sae returns JSON with array of floats as strings
  # jq -r converts strings to unquoted floats
  nlp-send-array | jq -r .sentiment[]
  echo ""
}


# helper function
# echos the id from the stanza
# use: echo $stanza | nom-lockdown-nom-to-id
nom-lockdown-nom-to-id(){
  local obj=($(cat -))
  echo "${obj[0]}"
}

# helper function
# echos the type from the stanza
# use: echo $stanza | nom-lockdown-nom-to-type
nom-lockdown-nom-to-type(){
  local obj=($(cat -))
  echo "${obj[1]}"
}

# helper function
# echos the data of the stanza from stdin
# use: echo $stanza | nom-lockdown-nom-to-data
nom-lockdown-nom-to-data(){

  IFS= read -r line  # skip first line
  IFS= read -r line  # skip second line

  while IFS= read -r line
  do
    echo "$line"
  done < /dev/stdin
}

# dispatches nom-lockdown-action-unit as example
nom-lockdown-gen-nom-action-unit(){
  local id=$(nom-lockdown-id)
  echo $id
  echo "action.nom-lockdown-action-unit"
  echo $1 
  echo ""
}
