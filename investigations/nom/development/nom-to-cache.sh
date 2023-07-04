# works but expensive- 4 subshells
function nom-from-file-to-cache(){
NOM_ID+=(head -1 $1)
NOM_TYPE+=($(head -2 $1 | tail -1))
NOM_DATA+=("$(tail -n +3 $1)")
}

function nom-to-cach(){
local oldifs=IFS;
# -r do not allow backslash to escape chars
IFS=$'\n' read -r id type  <<<"$1"

IFS=oldifs;
}
function nom-stanza-to-cache(){
stanza="$1"
NOM_ID+=(${stanza[/regex/in/bash]})
NOM_TYPE+=(${stanzaparse[/with/bash/]})
NOM_DATA+=("${stanzaparse[/with/bash/]"})
}

# https://tldp.org/LDP/abs/html/

# tbd
function stanza-to-cache-proto-for-bash-string-processing(){
stanza="NOM OJBECT"
NOM_ID+=(${stanza[/regex/in/bash]})
NOM_TYPE+=(${stanzaparse[/with/bash/]})
NOM_DATA+=("${stanzaparse[/with/bash/]"})
}
