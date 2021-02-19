NOM_DIR=./data

# clears cache
unset NOM_IDS
unset NOM_TYPES
unset NOM_DATA

# string: most generic description of data, with spaces
# line: Any characters besides newline and upside-down-q-mark
# list: array of strings (new lines) or stanzas (udqm)
# nom_object: [id, type, data0, data1, ... dataN]
# nom.list:  list of nom objects in a file 
# nom.list: [id, type, data0, data1, ... dataN]*
# nom.index: list of lines: [id,type,first,end]*

# nom.list: [id, type, data0, data1, ... dataN,,]* (, is a newline)

nom-extract-param() {
  local nom_ids=();
  local nom_types=();
  local nom_data=();

  [ $# == 0 ] && 
    echo "Usage: nom-extract-param ids|types|data <file>" && 
    return 1

  if [ $# == 1 ]; then
    [ "$1" != "ids" ] && [ "$1" != "types" ] && [ "$1" != "data" ] &&
      echo "Option must be ids, types, or data." && return 1

    [ "$1" == "ids" ] && [ ! -z "$NOM_IDS" ] && echo "${NOM_IDS[@]}" ||
      echo "Ids have not yet been extracted from a batch."

  fi 

  if [ $# == 2 ]; then

    [ "$1" != "ids" ] && [ "$1" != "types" ] && [ "$1" != "data" ] &&
      echo "Option must be ids, types, or data." && return 1

    while read -d $'\xBF' id type data; do
      nom_ids+=("$id");
      nom_types+=("$type");
      nom_data+=("$(echo "$data" | base64)");
    done <<< $(sed -e 's/^$/\xBF/' $2)

    [ "$1" == "ids" ] &&  echo "${nom_ids[*]}"
    [ "$1" == "types" ] && echo "${nom_types[*]}"
    [ "$1" == "data" ] && echo "${nom_data[*]}"
  fi

}

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

  # separates at inverted question mark
  while read -d $'\xBF' stanza; do
    # separates data from nom object
	local datum="$(echo "$stanza" | nom-lockdown-nom-to-data)";
    # converts data to base64
    nom_data+=("$(echo "$datum" | base64)")

  done <<< $(sed -e 's/^$/\xBF/' -)
  # outputs strings of base64 interpretation of data sets
  echo "${nom_data[*]}"

}


mike-nom-get-data() {
  local nom_data=();
  while read -d $'\xBF' stanza; do

	local datum="$(echo "$stanza" | nom-lockdown-nom-to-data)";
    nom_data+=("$(echo "$datum")")

  done <<< $(sed -e 's/^$/\xBF/' -)

  for i in ${!nom_data[@]}; do
    echo -n "data: ${nom_data[$i]}"
    echo -n  X #$'\xBF'
  done
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

nom-create-cache() {
  local file="$1";
  
  [ $# == 0 ] && echo "Usage: nom-create-cache batch_file" && return 1

  NOM_IDS=($(nom-extract-param ids "$file"));
  NOM_TYPES=($(nom-extract-param types "$file"));
  NOM_DATA=($(nom-extract-param data "$file")); 
  
}

nom-clear-cache(){
  unset NOM_IDS 
  unset NOM_TYPES
  unset NOM_DATA
}

# use uuencode to create base64 string so NOM_DATA[i]
# points to a single uuencoded string.
# unix-to-unix encoding creates a ba
#
# get-data would have to un-base64 

mike-create-cache-from-file(){
  NOM_IDS=($(cat $1 | zach-nom-get-ids));
  NOM_TYPES=($(cat $1 | zach-nom-get-types));
  local oldifs=$IFS
  #IFS=$'\xBF';
  IFS=X
  NOM_DATA=("$(cat $1 | mike-nom-get-data)");
  IFS=$oldifs
}
