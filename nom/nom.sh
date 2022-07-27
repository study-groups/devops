#!/bin/bash
# above is for shellcheck, this file should be sourced.
DEVOPS_PATH="/home/admin/src/devops-study-group"
NOM_PATH_CLI="$DEVOPS_PATH/investigations/nom"

#
# Nodeholder Object Model Bash API
#
# A lowercase 'nom' is a nodeholder object 
# and is stored in a FSID.nom file where FSID
# stands for File System ID.

# No structural or connective information is 
# inherently stored in a nom.

# Every nom in a FSID.nom has, implicitly,
# the same parent FSID. 

# Compound IDs: the full lineage of an object
# is given by FSID.NOMID but FSID is implied.

# Inside of the file are other noms, each
# with their own NOMIDs but all share same
# FSID.
#
# Compare the File System ID (syntaxic) 
# with the Parent Object ID (semantic)
# 
# POID.list (Parent Object Id) -- nom.list
# POID.index                   -- nom.index

# Could argue that semantics should be built
# later and thus use FSID.
nom-cache-clear(){
  unset NOMS
  unset NOMS_INDEX
}

# A list is a string with newlines in it.
nom-cache-load(){
  local indexcmd="$NOM_PATH_CLI/list-to-index"
  NOMS="$(cat $1)"
  NOMS_INDEX="$($indexcmd $1)"
}

nom-cache-size(){
  echo "$NOMS" | wc
}

# Inputs:      $1 -- id
# Outputs: stdout -- lines (w/ newline endings
# Cache: Assumes string values $NOMS and $NOMS_INDEX are set
nom-id-to-data(){
  nom-id-to-data-from-list-and-index $1 "$NOMS" "$NOMS_INDEX"
}
# Reference: SpaCy 3.0
# https://spacy.io/api
#
# User      |  Developer   |    Computer
# Semantics |  Semantics   |    Syntax
#
# Inputs:  1) stanzaList  as string (not array)
#          2) indexList   as [id,type,start,stop]*
#          3) id          as NOM ID string
#
# Outputs: list of lines as a string on stdout
nom-id-to-data-from-list-and-index(){ 
  local id="$1"
  local stanzaList="$2"
  local indexList="$3"
  local found="false"
  local cur=0

  # index file is always [id,type,firstLine,lastLine]*
  local mod=0; 
  while IFS= read -r line
  do
    mod=$((cur % 4 ))
    [ "$line" == $id ] && [ $mod == 0 ] && found=$cur
    (( cur=cur+1 ))
  done < <(printf '%s\n' "$indexList")

  [ $found == "false" ] && echo "Id: $id not found" && return 1
 
  # Assume found is line number of start of nom object. Then:
  # start+1: type string for object $id
  # start+2: first of line of data
  # start+3: last line of data 
  local iStart=$((found+2))
  local iEnd=$((found+3))
  ((debug)) && echo "iStart: $iStart, iEnd: $iEnd, cur: $cur" >&2
  local first="$(nom-get-lines-from-list "$indexList" $iStart )"
  local last="$(nom-get-lines-from-list "$indexList" $iEnd )"
  ((debug)) && echo "first: $first, last: $last" >&2
  nom-get-lines-from-list "$stanzaList" $first $last
}

nom-get-lines-from-list(){
  local first=$2
  local last=${3:-$2} # get only one line if end is absent
  local cur=0
  while IFS= read -r line
  do
    if (( cur >= first  &&   cur <= last )); then 
         echo "$line"
    fi
    (( cur=cur+1))
  done < <(printf '%s\n' "$1")
}

nom-list-to-files(){
  echo "Implement nom-list-to-files"
}

nom-get-lines(){
  awk "NR>=$1&&NR<=$2" 
}

nom-map(){
  jq "[.[] | $1]"
}

nom-getid-by-index(){
  local index=$1
  # beacuse one token per line, no quotes necessary
  local index_array=($NOMS_INDEX[@]) 
  echo "${index_array[ ((index*4 + 0)) ]}"
}

nom-gettype-by-index(){
  local index=$1
  # beacuse one token per line, no quotes necessary
  local index_array=($NOMS_INDEX[@]) 
  echo "${index_array[ ((index*4 + 1)) ]}"
}

nom-getids-from-index() {
  local line_num=0;
  while read line
  do
    (((line_num % 4) == 0)) && echo $line
    ((line_num++))
  done < ${1:-"/dev/stdin"}
}

# usage: cat nom.index | nom-info 4 # shows inf for 4th 0-indexed nom.
nom-info(){
  local index=()
  while read line; do
   index+=($line)
  done < /dev/stdin
  
  echo ${index[(($1*4+0))]}
  echo ${index[(($1*4+1))]}
  echo ${index[(($1*4+2))]}
  echo ${index[(($1*4+3))]}
}

nom-cache-index-to-data(){
  ((debug)) && echo "Getting data for index $1 " >&2
  ((debug)) && echo "Using global strings NOMS and NOMS_INDEX " >&2
  local n=$1
  local index=($NOMS_INDEX[@])
  echo "$(nom-get-lines-from-list "$NOMS" \
        ${index[(($n*4+2))]} ${index[(($n*4+3))]} )"
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
