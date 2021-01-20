# transforms each line to a sentiment
# Line[] => Sentiment[]
original-lines-to-sentiments(){
 # nom id of original data
  local data_id="$1";
 # incoming data type
  local type="$2";
 # nom id of applied action(data)
  local action_id="$3";
 # id of transformed data
  local new_id="$(date +%s)";
 # json to be sent to api
  local json='{"data": []}'; 

 # only accepts type "lines" 
  [ "$type" != "lines" ] && 
    echo "Incorrect type. Expected type lines" && 
    return 1

 # collect each line into an array
 # place in json
  while read line 
  do
    json="$(echo "$json" | jq '.data += ["'"$line"'"]')";
  done < /dev/stdin
 
  local port=1029;
  local content_type="Content-Type: application/json";
  local url="$doZ:$port/api/nlp";
  local response=$(curl -s -d "$json" -H "$content_type" "$url");

  local finished="false";

 # send ids and response once response finishes
  while [ "$finished" == "false" ]
  do
    [ ! -z "$response" ] && # Maybe Sentiment | NaN
      echo "$new_id" &&
      echo "$data_id.$type.$action_id.sentiments" && 
      echo "$response" | jq -r '.sentiment[]' && echo "" && return 0 
  done
}

# TESTING
# transforms each line to a sentiment
# Line[] => Maybe Sentiment[] NaN[]
lines-to-sentiments(){
 # nom id of original data
  local data_id="$1";
 # incoming data type
  local type="$2";
 # nom id of applied action(data)
  local action_id="$3";
 # id of transformed data
  local new_id="$(date +%s)";
 # json to be sent to api
  local json='{"data": []}'; 

 # only accepts type "lines" 
  [ "$type" != "lines" ] && 
    echo "Incorrect type. Expected type lines" && 
    return 1

 # collect each line into an array
 # place in json
  while read line 
  do
    json="$(echo "$json" | jq '.data += ["'"$line"'"]')";
  done < /dev/stdin
 
  local port=1029;
  local content_type="Content-Type: application/json";
  local url="$doZ:$port/api/nlp";
  local response=$(curl -s -d "$json" -H "$content_type" "$url");

  local finished="false";

 # send ids and response once response finishes
  while [ "$finished" == "false" ]
  do
    [ ! -z "$response" ] && echo "$response"
  done
}


# transforms line to sentiment
# Line => Sentiment
line-to-sentiment(){
  # nom id of original data
  local data_id="$1";
  # incoming data type
  local type="$2";
  # nom id of applied action(data)
  local action_id="$3";
  # id of transformed data
  local new_id="$(date +%s)";
  # json to be sent to api
  local json='{"data": ""}';
 
  # only accepts type "line" 
  [ "$type" != "line" ] && 
    echo "Incorrect type. Expected type line" && 
    return 1 

  # place line in json as string
  while read line
  do
    json="$(echo "$json" | jq '.data += "'"$line"'"')";
  done < /dev/stdin

  # Port is part of entire nh-web idea where an API author publishes
  # an API through nodeholder. This requires the author to
  # state a full API endpoint path and a port number (which was
  # assigned by nh-app during app creation).
  #   
  # nh-web or similar must edit the nginx config of all 
  # webservers to which an api request may land. This may be
  # more than one server in load-balancing situations.
  #
  # nh-web must create a proxy forward maping user-api.example.com
  # to the IP:PORT number provided by the user.
  #
  # As a small refactor, lets co-locate all PORT,IP and URL 
  # config definitions with NOM_DIR.
  local port=1029;
  local content_type="Content-Type: application/json";
  local url="$doZ:$port/api/nlp";
  local response=$(curl -s -d "$json" -H "$content_type" "$url");

  local finished="false";
  
  # send ids and response once response finishes
  while [ "$finished" == "false" ]
  do
    [ ! -z "$response" ] && 
      echo "$new_id" &&
      echo "$data_id.$type.$action_id.sentiment" &&
      echo "$response" | jq -r '.sentiment' && echo "" && return 0
  done

}


sentiments-to-average() {
  # nom id of original data
  local data_id="$1";
  # incoming data type
  local type="$2";
  #nom id of applied action(data)
  local action_id="$3";
  # id of transformed data
  local new_id="$(date +%s)";
  
  # only accepts type "sentiments" 
  [ "$type" != "sentiments" ] && 
    echo "Incorrect type. Expected type sentiments" && 
    return 1

  local count=0;
  local running_total=0.0;

  # THERE ARE POTENTIAL NANs
  while read sentiment
  do
    [ "$sentiment" != "NaN" ] && running_total="$( jq -n "$running_total + $sentiment")" && count="$(jq -n "$count + 1")"
  done < /dev/stdin
  local average="$(jq -n "$running_total / $count")"
  echo "$new_id"
  echo "$data_id.$type.$action_id.average"
  echo "$average"
}

#sae-test-verbose(){
# curl -v -d '{"data":[ "good", "very good", "very bad", "bad" ]}'\
# -H "Content-Type: application/json" \
# $doZ:1029/api/nlp
#echo "";
#}
#sae-test-mesh(){
# curl -v -d '{"data":[ "good", "bad" ]}' \
#      -H "Content-Type: application/json" \
#       sae-app.nodeholder.com/api/nlp
#echo "";
#}
#sae-test-endpoint(){
# curl -v -d '{"data":[ "good", "bad" ]}' \
#      -H "Content-Type: application/json" \
#       sae-app.nodeholder.com/$1
#echo "";
#}
#sae-test-dns(){
#  local data='{"data":[ "good", "bad", "ugly"]}'
#  local type='Content-Type: application/json'
#  local ip=$doZ
#  local port=1029
#  local endpoint="api/nlp"
# curl -d "$data" -H "$type" $ip:$port/$endpoint
#  echo "";
#}
#sae-help() {
#    echo '
#        sae- functions serve to interact with Sentiment Analysis Engine,
#	and are used for testing purposes.
#
#	Functions:
#
#	sae-post-data $ip $port $path 
#	- Performs a POST request with data piped to it.
#	E.g. cat data.json | sae-post-data 123.456.78.910 80 /post-route
#
#
#	sae-get-data-with-id $ip $port $path $id
#	- Performs GET request to specified ip on port with path and id.
#	E.g. sae-get-data-with-id 123.456.78.910 80 /path 2
#
#
#	sae-parse-file $file $specified_property $from $to 
#	- Parses through a file of objects and places specified property values
#        into an array. You may specify the indices from n to nn. 
#        Function produces a data.sae file with a single object with a property 
#	of data with an array of the values specified. Function cats the file 
#        upon completion.
#        E.g. sae-parse-file file_of_objs.json text 0 10       
#
#    '
#}
#
#sae-grab-values() {
#    local stdin="$2";
#    local stdout="$3";
#
#    local property="$4";
#    local from="$5";
#    local to="$6";
#    
#    # If a range is specified
#    [ -n "$from" ] && [ -n "$to" ] && \
#    jq '.' < "$stdin" | jq '.' -s |\
#    jq '.[]."'$property'"' |\
#    jq '.['$from':'$to']' -s > "$stdout"
#
#    # If there is no range
#    [ -z "$from" ] && [ -z "$to" ] && \
#    jq '.' < "$stdin" | jq '.' -s |\
#    jq '.[]."'$property'"' >> "$stdout"
#}
#
#sae-make-raw() {
#    local stdin="$2";
#    local stdout="$3";
#
#    jq '.' -r < "$stdin" > "$stdout"
#}
#
#sae-map-through-data() {
#    local stdin="$2";
#    local stdout="$3";
#
#    local data="$(jq '.[]' < $stdin)";
#
#    while read line
#        do
#            echo "$line" >> "$stdout"
#        done <<< "$data"
#}
#
#sae-post-string(){
#
#    local endpoint="157.245.233.116:1025/api/nlp"
#    local json_data='{"data":"'"$1"'"}'
#
#    local res="$(curl -X POST \
#         -H "Content-Type: application/json" \
#         -H "Authorization: token" \
#         -d "$json_data" \
#         $endpoint
#    echo "")"
#
#    object-create sentiment noun $res
#}
