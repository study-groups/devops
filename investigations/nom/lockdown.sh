nom-lockdown-gen-all(){
  nom-lockdown-gen-text | nom-lockdown-line-to-nom
  nom-lockdown-gen-text | nom-lockdown-text-to-nom
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

nom-lockdown-action-id(){
  nom-lockdown-id
  echo "nom-lockdown-action-id"
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
  sed -e 's/^$/\xBF/' | while read -d $'\xBF' var
  do
    printf "Considering:\n%s\n-----\n" "$var"
    local obj=$()
    export var;
    printf "Id: %s\n" "$(echo $var | nom-lockdown-nom-to-id )"
    printf "Type: %s\n" "$(echo $var | nom-lockdown-nom-to-type )"
    printf "Data:\n" 
    echo "$var" | nom-lockdown-nom-to-data

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
