#!/bin/bash
# above is for shellcheck, this file should be sourced.

# Relies on global data array $da.
# Probably can delete.
nom-getid(){
  local index=$1
  local da2+=($da)
  echo ${da2[*]}
  echo "${da2[ (($index*4 + 0)) ]}"
}

# new
nom-get-all-datatype-from-batch() {
  local datatype="$1";
  local batch_id="$2";
  local line_num=0;

  for file in $(ls response/);
  do
    [ "$(echo $file | awk -F'batch' '{ print $2 }')" == "$batch_id" ] && 
    while read line; do
      (((line_num % 4) == 3)) && echo $line | jq '.'"$datatype"''
      ((line_num++))
    done < "response/$file"
  done
}

# Currently nom must be run in a directory containing:
# 
# data.nom   -- is named with a POID (Parent Object Id)
# data.index -- is POID.index
# data       -- data lake directory containing NOMs w/ name of POID

nom-link-to-data() {
  # links program specific file to user specific data
  local poid_file="$1";
  local poid_index="$2";
  local poid_lake="$3";
  ln -sf "$poid_file" data.nom
  ln -sf "$poid_index" data.index
  ln -sf "$poid_lake" data
}

nom-getids-from-index() {
  local line_num=0;
  while read line
  do
    (((line_num % 4) == 0)) && echo $line
    ((line_num++))
  done < ${1:-"/dev/stdin"}
}

nom-info(){
  local index=()
  while read line; do
   index+=($line)
  done < /dev/stdin
  
  echo ${index[(($1*4+0))]}
  echo ${index[(($1*4+1))]}
  echo ${index[(($1*4+2))]}
  echo ${index[(($1*4+3))]}
  echo "Data is: "
  echo $(nom-get-data ./data.nom ${index[(($1*4+2))]} ${index[(($1*4+3))]} )
}

# new
nom-get-responses-from-batch() {
  local batch_id="$1";

  for file in $(ls response/);
  do
    [ "$(echo $file | awk -F'batch' '{ print $2 }')" == "$batch_id" ] && 
    echo "$file" | awk -F'batch' '{ print $1 }' 
  done

  #awk 'FNR == 1{ print FILENAME }' \
  #response/1604513539276085335batch1604091136178378045 | 
  #cut -d'/' -f2 | 
  #awk -F'batch' '{ print $1 }'

  #awk 'FNR == 1{ print FILENAME }' \
  #response/1604513539276085335batch1604091136178378045 | 
  #cut -d'/' -f2 | 
  #awk -F'batch' '{ print $2 }'
}

# nom-lake-to-stream
# nom-stream-to-stanza-stream
# nom-batch [cache]

nom-getdata(){
  awk "NR>=$1&&NR<=$2" data.nom
}

nom-get-lines(){
  awk "NR>=$1&&NR<=$2" 
}

nom-map(){
  jq "[.[] | $1]"
}

nom-get-data(){
  jq '.data'
}
