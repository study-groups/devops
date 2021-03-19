nh-network-ip(){
  echo "Add function using ip that gives summary of network interface modules."
  echo "(the objects shown by ifconfig)"
  echo "Note that when docker is running, it starts its own network interfaces."
  echo ""
  ip -br addr
}

# ping => nom ( id, type, data )
# type.data.ping
# reformated ping data 
nh-network-watch(){
  while [ 1=1 ]; do
    nh-network-ping $1 $2 
    echo "" # new line for the nom stanza
    sleep 1 
  done
}


nom-gen(){
  while [ true ]; do
    [ -z "$1" ] && echo "Please, set throttle." && return 1
    [ -z "$2" ] && echo "Please, specify nom-create-function" && return 1
    # $1 throttle 
    # $2 bash func
    # $@ rest of args which are passed to $2
    $2 "${@:3}"
    echo "" # new line for the nom stanza
    sleep $1 
  done
}

# Example Nom 
nom-data-random(){
  date +%s%N
  echo "data.random"
  echo "$RANDOM"
}

nom_data_random_sum=0;
nom_data_random_count=0;
# Inputs: $id $type "$data"
nom-data-random-sum(){
  local id=$1;
  local type=$2;
  local randInt=$3; # no need to parse single line.
  (( nom_data_random_sum += $randInt))
  (( nom_data_random_count++ ))
  echo "$id"
  echo "$type"
  echo "$randInt" $nom_data_random_sum $nom_data_random_count 
  echo ""
}


# Recieves nom stanzas on stdin (or file)
# NOM object is of form where each nom object
# is separated by a blank line. Stream looks like:
# id
# type
# data_line_1
# data_line_2, etc
# 
# id
# type
# data_line_1
# data_line_2.
#
# while loop eats the id line and the type line
# and then while's over the data until blank line,
# putting all of the data lines into a single 
# string (containing new lines separating the 
# data lines).
#
# After data is read, id, type and data are 
# passed to the accumlator function. It is 
# the responsibility of the user to create 
# an accumulator function for a specific data type.
#
# $1 = the accumlator function
# $2 = defualts to stdin, could be a file

# An idea
# System Defined
#          type-to-type
# nom-map these-to-those    N to N
# nom-filter those-to-some  N to M (some == "some of those")
# nom-reduce those-to-that  N to 1 (create side effect bcz of state)

# User Defined
# ping-to-pingAvg this-to-that     1 to 1  (works with single object)
# nom-map ping-to-pingAvg

# nom-gen nom-create-ping nodeholder.com 2 | nom-map ping-to-pingAvg
nom-gen-id() {
  date +%s%N
}

nom-create-ping() {
  # $1: domain name or ip
  # $2: number of packets
  [ -z "$1" ] && echo "Domain name or ip required" && return 1
  [ -z "$2" ] && echo "Please, specify amount of packets to send" && return 1

  nom-gen-id
  echo "data.ping"
  # ping sends TCP request quietly (less output)
  # awk grabs important line "min/avg/max/dev
  # tr changes "/" to new lines
  ping -q -c "$2" "$1" | awk 'END{ print $4}' | tr '/' '\n'

}

ping-to-pingAvg() {
  # $1: id
  # $2: type
  # $3: data
  # Indices: 
  # 0: min
  # 1: avg
  # 2: max
  # 3: dev
  local data=($3);
  echo "$1.$(nom-gen-id)"
  echo "data.ping-avg"
  echo "${data[1]}"
}

#234254
#data.ping
#3.3
#1.2
#3.4
#1.0

#234254
#data.pingAvg
#3.3

nom-map(){
    while read id; do
      read type
      read data_line
      data="$data_line"
      while [ "$data_line" != "" ]; do # check for blank line.
        read data_line;
        data+=" $data_line";
      done
      data_line="";
      $1 $id $type "$data"
    done < "${2:-/dev/stdin}"
}

# THis is an accumulator function that takes a ping nom stanza stream
# $1 = type
# $2 = data

# Ping Nom object
ping_avg=0;

# Data derived from Ping Nom object
# E.g. stuff that ping-parse and ping-sum would produce
# In order to speak of this data, an extraction method
# must be described that acts on ping.data string:
ping_count=0;
ping_sum_avg=0;
ping_sum_dev=0;
ping_avg_avg="$ping"

# This function is called by map/reducer 
# map-> no side effects
# reduce implies side effects and so we need init and cleanup
# Input:
# Output: 

#ping-stats(){  

#}

# output should be a single nom object (bcz its reducing a
# list of noms)
ping-sum(){
  ((ping_count++))
  local dataWords=($2) # turn data string into array
  local avgTime=${dataWords[4]}  # this is like ping-parse
  ping_avg_sum=$(echo "$avgTime + $ping_avg_sum" | bc )
  ping_avg=$(echo "scale=4; $ping_avg_sum / $ping_count" | bc )

  printf "%s: %s, avg_sum:%s, avg:%s\n" \
    $ping_count $avgTime  $ping_avg_sum $ping_avg 
}

#ping-parse(){

#}

# TODO: this should be calling ping-gen and processing it with
# ping-sum,avg,stats, whatever, and pretty printing the NOM
# objects map/filter/reduce produce.
nh-network-ping() {
  # send $2 number of packets to server $1
  echo $(date +%s%N)
  echo "data.ping"
  ping -c "$2" "$1" | 
  tail -1 | 
  awk -F'=' '{ print $2 }' | # min/avg/max/mdev = n/n/n/n
  awk -F'/' '{ print "Minimum: "$1 " ms \nAverage: "$2 " ms \nMaximum: "$3 " ms \nDeviation: "$4 }'
}

# This reads a list of ping objects
# nh-ping-summary pings.nom
nh-ping-summary(){
  # load nom stanzas into cache
  # itterate over the nom stanzas
  # For each nom object:
  # grab average 
  # store average to running total
  # add 1 to total length
  # After loop:
  # divide total/length
  # echo "avg of avg: <decimal number>"
  local cacheLen=$(nom-cache-length)
  local firstIndex=${1:-0}
  local lastIndex=${2:-$cacheLen}
  local lastIndex=$cacheLen
  for i in $(seq $firstIndex $lastIndex); do
    nom-cache-index-to-data $i
  done
  echo "cacheLen $cacheLen"
}

zach-ping-create() {
  date +%s%N
  printf "data.ping\n"
  ping -q -c "$2" "$1" | awk 'END{ print $4 }' | tr '/' '\n'
  #printf "\n"
}

# $ ping -c 2 nodeholder.com
# PING nodeholder.com (1.2.3.4) 56(84) bytes of data.
# 64 bytes from 1.2.3.4 (1.2.3.4): icmp_seq=1 ttl=62 time=1.81 ms
# 64 bytes from 1.2.3.4 (1.2.3.4): icmp_seq=2 ttl=62 time=0.577 ms
# 
# --- nodeholder.com ping statistics ---
# 2 packets transmitted, 2 received, 0% packet loss, time 1001ms
# rtt min/avg/max/mdev = 0.577/1.197/1.817/0.620 ms

# nom-gen 1 nom-data-random nom-map - nom-console
zach-ping-gen() {

  # $1: domain or ip
  # $2: number of packets to send
  # $3: ping-fun
  # output: 
    # id
    # type
    # min
    # avg
    # max
    # dev
  
  while [ true ]; do

    # CURRENT CODE TO USE
    #date +%s%N
    #printf "data.ping\n"
    #ping -q -c "$2" "$1" | awk 'END{ print $4 }' | tr '/' '\n'
    #printf "\n"
    # END OF CURRENT CODE TO USE

   
    # IF NO FUNCTION TO SEND TO 
    if [ -z "$3" ]; then

    # output: with new lines

      date +%s%N
      printf "data.ping\n"
      ping -q -c "$2" "$1" | awk 'END{ print $4 }' | tr '/' '\n'
      printf "\n"
      else
        # output: id type min avg max dev
        # A FUNCTION HAS BEEN PROVIDED.
        # CAPTURE NOM IN ONE LINE AND PASS TO FUNCTION
        local nom="$(echo -e "$(date +%s%N) \
              data.ping $(ping -q -c "$2" "$1" | 
              awk 'END{print $4}' | tr '/' ' ')\n")"
        # PASS NOM INTO PROVIDED FUNCTION
         $3 "$nom"
    fi

     
    # ATTEMPT TO USE ARRAY
    #a=( $(date +%s%N) "data.ping" $(ping -c "$2" "$1" | 
    #  tail -1 | awk '{ print $4 }' | tr '/' '\n') );
    #echo "${a[0]}"
    #echo "${a[1]}"
    #echo "${a[1]}"
    sleep 1
  done
}

#while read -d $'\xBF' id type data; do
#      nom_ids+=("$id");
#      nom_types+=("$type");
#      nom_data+=("$(echo "$data" | base64)");
#    done <<< $(sed -e 's/^$/\xBF/' $2)

#nom-lockdown-nom-to-id(){
#  local obj=($(cat -))
#  echo "${obj[0]}"
#}

zach-ping-parse() {
  # $1: definition: avg min max dev
  # $2: ping-fun
  # Indices of a
    # 0: id
    # 1: type
    # 2: min
    # 3: avg
    # 4: max
    # 5: dev
  local acc="";
  #SAVEIFS=$IFS

  while read stanza; do
    echo "$stanza"

  #while IFS=$'\n' read -r id type data; do
    #echo "id: $id"
  #while read stanza; do
    # doesn't work
  #  local id="$(echo "$stanza" | awk 'FNR==1')"
  #  echo "$id"

  #while read -d $'\n' id type data; do
  #  echo "$id"
  #  echo "$type"
  #  echo "$data"

    #echo "$stanza" | xxd

  #SAVEIFS=$IFS
  #IFS=$'\n'
  #while read stanza; do
  #  local a=($(echo -e "$stanza" | tr '\n' ' '));
  #  echo "${a[0]}"
  #  IFS=$SAVEIFS
  #while read stanza; do
  #  read -a a < <( echo -e "$stanza" | tr '\n' ' ')
  #  echo "${a[0]}"
    
    #mapfile -t a < <(echo -e "$stanza" | tr '\n' ' ')
    #echo "id: ${a[0]}"   

    #mapfile -t a < <(echo -e "$stanza")
    #echo "id: ${a[0]}"

  #while read stanza; do
  #  local a=();
  #  for line in $stanza; do
  #    a+=($line);
  #  done
  #  echo "id: ${a[0]}"

  #while read -d $'\n' id type data; do
  #  echo "id: $id"
  #  echo "type: $type"
  #  echo "data: $data"
    
    # doesn't work
    #SAVEIFS=$IFS;
    #IFS=$'\n'
    #local nom_object=("$stanza");
    #echo "id: ${nom_object[0]}"
    #IFS=$SAVEIFS

    #echo "$stanza" | tr '\n' ' '
    #echo -e "\n"

    # none of this is working
    #echo "$stanza" | awk 'NR>=1&&NR<=2'

    #local data="$(echo "$stanza" | awk 'NR>=3&&NR<=5')"
    #echo $data
    
    #mapfile -t a < <(echo -e "$stanza" | tr '\n' ' ')
   
    # doesn't work
    # local a=("$stanza");

    

    # echo "${a[0]}"

    #[ "$1" == "min" ] && 
    #acc+="${a[2]} " &&
    #"$2" "${a[0]}" "$acc"

  done < /dev/stdin
}

zach-ping-sum() {
  # $1: id
  # $2: string of numbers
  echo -e "$1.$(date +%s%N)\ndata.ping.sum"
  echo "0 $2" | xargs | tr ' ' '+' | bc
}
