nom-lockdown-gen-all(){
  nom-lockdown-gen-text | nom-lockdown-line-to-nom
  nom-lockdown-gen-text | nom-lockdown-text-to-nom
  nom-lockdown-gen-unit
  nom-lockdown-gen-nom-action-unit  0000000000000000002
}

nom-lockdown-gen-unit(){
   echo "0000000000000000002"
   echo "type.unit"
   echo "0000000000000000001"
   echo ""
}
nom-lockdown-gen-text-nom(){
  local line=${1:-"This is line one and it is."}
  echo "$line" | nom-lockdown-line-to-nom
}

nom-lockdown-gen-text() {
  cat <<EOF
This is line one and it is good.
Went to the movie, it was okay.
When will the sun rise? In the morning.
EOF
}

nom-lockdown-line-to-nom(){
  while IFS= read -r line
  do
    nom-lockdown-id
    echo type.text
    echo "$line"
    echo ""
  done < /dev/stdin
}

nom-lockdown-text-to-nom(){
  nom-lockdown-id
  echo type.array.text
  while IFS= read -r line
  do
    echo "$line"
  done < /dev/stdin
  echo ""
}

nom-lockdown-id(){
  echo $(date +%s%N)
}

# the unit. used to test the mechanism of dispatch
# without defining custome types.
nom-lockdown-action-unit(){
  nom-lockdown-id
  echo "action.nom-lockdown-action-unit"
  echo $1
  echo ""
}

nom-lockdown-dispatch-object(){
  local obj=($(cat -))
  echo "Object type: ${obj[1]}"

} 

# https://stackoverflow.com/a/18539622/4249785
# Change blank new line to \xBF upside down q mark.
# Read up to special character, update var
# Use printf for reliable new lines
nom-lockdown-dispatch(){
  sed -e 's/^$/\xBF/' | while read -d $'\xBF' stanza 
  do
    printf "Considering:\n%s\n-----\n" "$stanza"
    export stanza;
    printf "Id: %s\n" "$(echo $stanza | nom-lockdown-nom-to-id )"
    local type="$(echo $stanza | nom-lockdown-nom-to-type )"
    printf "Type: %s\n" "$type"
    printf "Data:\n" 
    local data=$(echo "$stanza" | nom-lockdown-nom-to-data)
    echo $data
    # function that exectues action
    # type=action.bash-function-name
    # call bash-function-name if it exists
    # log error otherwise

    #        echo "action.nom-lockdown-action-unit"
    [[ "$type" =~ ^action.nom-lockdown-action-unit ]] && \
       nom-lockdown-action-unit $data
    
    #printf "Type: %s\n" "$var"
    #nom-lockdown-type-to-action 
  done
}

nom-lockdown-nom-to-id(){
  local obj=($(cat -))
  echo "${obj[0]}"
}

nom-lockdown-nom-to-type(){
  local obj=($(cat -))
  echo "${obj[1]}"
}

nom-lockdown-nom-to-data(){

  IFS= read -r line
  IFS= read -r line

  while IFS= read -r line
  do
    echo "$line"
  done < /dev/stdin
}

nom-lockdown-gen-nom-action-unit(){
  local id=$(nom-lockdown-id)
  echo $id
  echo "action.nom-lockdown-action-unit"
  echo $1 
  echo ""
}
