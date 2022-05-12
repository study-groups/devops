#!/bin/bash
PS1="admin@do4:watchdog> "
#HOST_TO_WATCH="west.placeholdermedia.com"
#HOST_TO_WATCH="cryptochromatic.net"
#HOST_TO_WATCH="nodeholder.com"
HOST_TO_WATCH="controlpanel.placeholderdomains.com"

# Example of bash variable indexing. Parsing line 1 with (): 
#   read line; words=($line); echo ${words[2]:2:12})

# PING west.placeholdermedia.com (192.34.62.148) 56(84) bytes of data.
# 64 bytes from 192.34.62.148 (192.34.62.148): icmp_seq=1 ttl=57 time=76.1 ms
# 
# --- west.placeholdermedia.com ping statistics ---
# 1 packets transmitted, 1 received, 0% packet loss, time 0ms
# rtt min/avg/max/mdev = 76.125/76.125/76.125/0.000 ms

nom-diff-loop(){
  while true; do
    while read line; do
      nom+="$line"
    done
      nom-diff "$new" "$old"
      old="$new"
  done
}

nom-diff() {
  nom_cur=("$1")
  nom_prev=("$2")

  printf "\n\nnom_cur:\n"

  for i in "${!nom_cur[@]}"; do 
    printf "%s\t%s\n" "$i" "${nom_cur[$i]}"
  done 

  printf "\nnom_prev:\n"

  for i in "${!nom_cur[@]}"; do
    printf "%s\t%s\n" "$i" "${nom_cur[$i]}"
  done 
}

dns-ping(){
  ping -c 2 ${1:-"$HOST_TO_WATCH"}
}

dns-ping-to-ip(){
  awk 'NR==2' |( read line; words=($line); echo ${words[3]})
}

dns-ping-to-host(){
  awk 'NR==1' |( read line; words=($line); echo ${words[1]})
}

# admin@do4:watchdog> nslookup west.placeholdermedia.com
# Server:         67.207.67.3
# Address:        67.207.67.3#53
# 
# Non-authoritative answer:
# Name:   west.placeholdermedia.com
# Address: 192.34.62.148


dns-ping-to-nslookup(){
  local host=$(awk 'NR==1' |( read line; words=($line); echo ${words[1]}))
  local nslookup_response="$(nslookup $host)"
  local ip_from_dns=\
"$(awk 'NR==6' |( read line; words=($line); echo ${words[2]}))"
   
}

dns-ping-to-delay(){
  #awk 'NR==6' |( read line; words=($line); echo ${words[3]:7:12})
  tail -1 |( read line; words=($line); echo "${words[3]:7:6}")

}

dns-ping-main-loop(){
    local hostname="${1:-$HOST_TO_WATCH}"
    local delayInSeconds=5 
    date +%s%N 
    echo "data.watchdog.job"
    echo "delayInSeconds=$delayInSeconds"
    echo ""
    
    while true; do
      date +%s%N 
      echo "data.watchdog.response"
      echo Host to watch: $hostname
      dns_ping="$(dns-ping)"
      echo "$dns_ping" | dns-ping-to-host
      echo "$dns_ping" | dns-ping-to-ip
      echo "$dns_ping" | dns-ping-to-delay
      echo "dns-ping-to-nslookup:"
      echo "$dns_ping" | dns-ping-to-nslookup
      # $(dns-ping-to-host <<<"$dns_ping"); 
      echo ""
      sleep $delayInSeconds
    done

}

color_red="\e[38;5;198m"
color_normal="\e[0m"                                                                 
watchdog-peek-stream(){
  while [ 1 == 1 ]; do
    read id;
    read type;
    echo $id;
    echo $type
    data=""
    lineNum=0;
    while read line; do
      # [ $lineNum == 2 ] && data+="$color_red"
      [ "$line" != "" ] && data+="$line\n"
      # [ $lineNum == 2 ] && data+="$color_normal"
      [ "$line" == "" ] && break 
      (( lineNum++ ))
    done 
    printf "$data"
    echo ""
  done
}

filter-ip-change(){
  IFS=$'\n'; 
  local lines=($1);
  echo ${lines[$2]}
}


dns_ping-to-nslookup(){
  local words=($1);
}

watchdog-remove-color(){
 sed 's/\x1B[@A-Z\\\]^_]\|\x1B\[[0-9:;<=>?]*[-!"#$%&'"'"'()*+,.\/]*[][\\@A-Z^_`a-z{|}~]//g'
}
watchdog-notes(){
  cat << EOF
# Example to turn console purple:
echo -ne "\033]11;#93186f\007"

# Normal text:
echo -e "\e[0m"

# Color foreground:
echo "\e[38;5;198m$word"

#From: 
https://superuser.com/questions/270214/how-can-i-change-the-colors-of-my-xterm-using-ansi-escape-sequences

EOF
}

#dns-ping-main-loop
