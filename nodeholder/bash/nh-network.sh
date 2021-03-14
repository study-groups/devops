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
  while [ 1=1 ]; do
    # $1 name of a bash function, $@ cmd line args after fun name
    $2 "${@:3}"  
    echo "" # new line for the nom stanza
    sleep $1 
  done
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
# data lines.
#
# After data is read, id, type and data are 
# passed to the accumlator function. It is 
# the responsibility of the user to create 
# an accumulator function for a specific data type.
#
# $1 = the accumlator function
# $2 = defualts to stdin, could be a file
nom-sum(){
    while read id; do
      read type
      read data_line
      data="$data_line"
      while [ "$data_data" != "" ]; do
        read data_line;
        data+=data_line;
      done
      data_line="";
      $1 $type "$data"
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

# mapfile -t bob < <(echo -e 'tom\nsally\nbilly'); echo "${bob[@]}";

zach-ping-gen() {
  # $1: domain or ip
  # $2 number of packets to send
  while [ true ]; do
    mapfile -t a < <(echo -e "$(date +%s%N)\ndata.ping\n$(ping -c "$2" "$1" | 
tail -1 |
awk '{ print $4 }' | 
tr '/' '\n')
")
    echo "${a[@]}"
    sleep 1
  done
}

NOM_ACC=""

zach-ping-parse() {
  # $1: definition: avg min max dev
  # $2: ping-fun
  local acc="";

  while read stanza; do
    
    mapfile -t a < <(echo -e "$stanza" | tr ' ' '\n')
    # Indices of a
    # 0: id
    # 1: type
    # 2: min
    # 3: avg
    # 4: max
    # 5: dev
    [ "$1" == "min" ] && 
    acc+="${a[2]} " &&
    "$2" "$acc"

  done < /dev/stdin
}

zach-ping-sum() {
  # $1: string of numbers
  echo "0 $1" | xargs | tr ' ' '+' | bc
}
