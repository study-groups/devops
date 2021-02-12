NOM_DIR=./data

# clears cache
unset NOM_IDS
unset NOM_TYPES
unset NOM_DATA

zach-nom-get-ids() {
  local nom_ids=();

  while read -d $'\xBF' stanza; do

	local id="$(nom-lockdown-nom-to-id <<< "$stanza")";
    nom_ids+=("$id")

  done <<< $(sed -e 's/^$/\xBF/' -)

  echo "${nom_ids[*]}"

}

zach-nom-get-types() {
  local nom_types=();

  while read -d $'\xBF' stanza; do

	local type="$(nom-lockdown-nom-to-type <<< "$stanza")";
    nom_types+=("$type")

  done <<< $(sed -e 's/^$/\xBF/' -)

  echo "${nom_types[*]}"
}

zach-nom-get-data() {
  local nom_data=();
  while read -d $'\xBF' stanza; do

	local datum="$(echo "$stanza" | nom-lockdown-nom-to-data)";
    nom_data+=("$(echo "$datum" | base64)")
    #nom_data+=("$(echo "$datum")")
    #nom_data+=($(echo "$datum"))

    #echo "stanza:$stanza" >> debug
    #echo "datum:$datum" >> debug

  done <<< $(sed -e 's/^$/\xBF/' -)
  echo "${nom_data[*]}"

  #echo "${#nom_data[@]}" > debug
  #echo "${nom_data[0]}" >> debug
  #echo "${nom_data[1]}" > debug
 
  #for i in ${!nom_data[@]}; do
  #  echo -n "data: ${nom_data[$i]}"
  #  echo -n  $'\xBF'
  #done

}


zach-create-vars () 
{ 
  echo "Outside loop: $SHLVL"
  #sed -e 's/^$/\xBF/' | while read -d $'\xBF' stanza; do
  while read -d $'\xBF' stanza; do
    local id="$(echo "$stanza" | nom-lockdown-nom-to-id)";
    local type="$(echo "$stanza" | nom-lockdown-nom-to-type)";
    type="$(echo "$type" | awk -F. '{ print $NF }')";
    local datum="$(echo "$stanza" | nom-lockdown-nom-to-data)";
    echo "Datum: $datum"
    NOM_IDS+=("$id")
    NOM_TYPES+=("$type")
    NOM_DATA+=("$datum")
    echo "NOM_DATA_0 ${NOM_DATA[0]}"
    echo "Inside loop: $SHLVL"
  done <<< $(sed -e 's/^$/\xBF/' -)
  
  echo "OUTSIDE LOOP NOM_DATA_0 ${NOM_DATA[0]}"
}

zach-cat-all-noms(){
  cat $NOM_DIR/*
}

zach-nom-lockdown-dispatch() {
  # define the associative arrays
  declare -A ids  # not used yet
  declare -A types
  declare -A data

  echo "rm $NOM_DIR/dispatch/*"

  # Change blank new line to \xBF upside down q mark. MUST CHANGE
  # stanza stays local
  sed -e 's/^$/\xBF/' | while read -d $'\xBF' stanza
  do

    # Every nom object consists of an id, a type, and data followed
    # by two new lines "\n".
    # Data objects consist of:
    # data id
    # data.type
    # data
    #
    # Action objects consist of:
    # action id
    # action.type
    # data id
    #
    # LD000
    # data.lines
    # These are exaple strings for the lockdown platform.
    # A string terminated by two newlines is called a stanza.
    # One stanza represents one NOM object.
    # Transforms create unresolved objects. EXPLAIN MORE
    # Transforms are mappings between types.
    # An action is defined by its input and output type.
    # Types may be considered categories.
    # Mapping between types is a functor.
    # Mapping between objects in a category is a function.
    #
    # Transformed data objects consist of:
    # new data id
    # previous action id (a.k.a unresolved type) action_id.type
    # transformed data
    #

    # new data id
    # data.sentiment
    # data

    # TODO: move nom-lockdown-nom-* to nom-
    # Pulls id, type, and data from object
    local id="$(echo $stanza | nom-lockdown-nom-to-id )";
    
    local type="$(echo $stanza | nom-lockdown-nom-to-type)";
    # pulls type from data or action object
    # e.g. data.type => type || action.func => func
    type="$(echo "$type" | awk -F. '{ print $NF }')";
    
    local datum=$(echo "$stanza" | nom-lockdown-nom-to-data);
    
    # associates id to data.type || action.func
    types["$id"]="$type"
    # associates id to data || data_id
    data["$id"]="$datum"

    # if type is an action, run it.
    # Datum is a nom_id when nom_type is action.
    #  
    # echo data[datum]=data | types[id]=action data.type action_id
    local is_action="$(type -t "${types["$id"]}")"
    [ "$is_action" == "function" ] && 
      echo "${data["$datum"]}" \
           | "${types["$id"]}" "$datum" "${types["$datum"]}" "$id" > \
             $NOM_DIR/dispatch/$datum.$id &
  done

}

## use: nom-lockdown-gen-text-nom "What's up?" | nom-lockdown-dispatch
zach-nom-lockdown-dispatch-ver001(){
  # Change blank new line to \xBF upside down q mark. MUST CHANGE
  sed -e 's/^$/\xBF/' | while read -d $'\xBF' stanza  # stanza stays local
  do
    
    # Every nom consists of an id, a type, and data
    local id="$(echo $stanza | nom-lockdown-nom-to-id )"
    local type="$(echo $stanza | nom-lockdown-nom-to-type )";
    local data=$(echo "$stanza" | nom-lockdown-nom-to-data)

    # creates new variable named with the value of id.
    # e.g. if value of id is "001",
    # the name of the new variable is 001
    # assigns the value of data to the new variable
    printf -v "$id" "%s " "$data" # e.g. 001="good bad ok decent"
    
    # if the nom has data.type
    # then we want to assign the type to a new variable
    # we name the variable with the value of the data id with a suffix _type
    # e.g. 001_type=line
    #      002_type=lines
    #      etc 
    [[ "$type" =~ ^data ]] && 
      data_type="${id}_type" &&
      printf -v "$data_type" "$(echo "$type" | awk -F"." '{ print $2 }')"
    
    # if the nom has action.func
    # the data in the nom will be the id of the data to apply the func
    # the name of the id with suffix "_type" is dereferenced
    # e.g. $data => $001_type => line
    # this type is passed to the function for type-checking
    # the id of the action is also passed
    # the data id is dereferenced to pass the data to the action.func
    # e.g. $data => $001 => single line of text to transform
    [[ "$type" =~ ^action ]] &&
      local check_type="$(eval echo "\$${data}_type")" &&
      action=$(echo "$type" | awk -F"." '{ print $2 }') &&
      echo "${!data}" | $action "$check_type" "$id" & #$data is an id!

  done
}

# sources into the parent shell
zach-load-cache(){
  NOM_IDS=($(zach-cat-all-noms | zach-nom-get-ids));
  NOM_TYPES=($(zach-cat-all-noms | zach-nom-get-types));
  NOM_DATA=($(zach-cat-all-noms | zach-nom-get-data));
}

# use uuencode to create base64 string so NOM_DATA[i]
# points to a single uuencoded string.
# unix-to-unix encoding creates a ba
#
# get-data would have to un-base64 

zach-create-cache-from-file(){
  NOM_IDS=($(cat $1 | zach-nom-get-ids));
  NOM_TYPES=($(cat $1 | zach-nom-get-types));
  #local oldifs=$IFS
  #IFS=$'\xBF';
  NOM_DATA=($(cat $1 | zach-nom-get-data));
  #IFS=$oldifs
  #cat $1 | zach-nom-get-data;
}


