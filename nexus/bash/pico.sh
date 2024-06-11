pico_create_full_object(){
    local id="$1"
    local to="$2"
    local from="$3"
    local type="$4"
    local subtype="$5"
    local message="$6"

    echo "${id} ${type}${subtype:+.$subtype} ${to:+to:[$to]} ${from:+from:$from} $message"
}

pico_create_simple_object(){
    local to="$1"
    local from="$2"
    local type="$3"
    local subtype="$4"
    local message="$5"

    echo "${type}${subtype:+.$subtype} ${to:+to:[$to]} ${from:+from:$from} $message"
}

pico_create_object_stanza(){
    local id="$1"
    local to="$2"
    local from="$3"
    local type="$4"
    local subtype="$5"
    local message="$6"

    echo ""
    echo "${id}"
    echo "${to:+to:[$to]}"
    echo "${from:+from:$from}"
    echo "${type}"
    echo "${subtype}"
    echo "${message}"
    echo ""
}

pico_gen_reference(){
    cat <<EOF

Pico Object Reference
----------------------

1. Full Pico Object:
   
   - Includes a timestamp, type, optional subtype, 
     and optional 'to' and 'from' references.
   
   - Example:
     1716015559550762 TYPE.subtype to:[id1, id2] from:id4 This is a message.

2. Simple Pico Object:
   
   - A single line without the timestamp.
   
   - May include optional 'to' and 'from' references.
   
   - Example:
     TYPE.subtype to:[id1, id2] from:id4 This is a message.

3. Pico Object Stanza:
   - Each variable is placed on a separate line, 
     starting and ending with a blank line.
   - Example:
     
     1716015559550762
     to:[id1, id2]
     from:id4
     TYPE
     subtype
     This is a message.

     1716015559550763
     to:[id3]
     from:id5
     ANOTHER_TYPE
     another_subtype
     Another message.

EOF
}


pico_test(){


# Example usage:
id="1716015559550762"
to="id1, id2"
from="id4"
type="TYPE"
subtype="subtype"
message="This is a message."

pico_create_full_object "$id" "$to" "$from" "$type" "$subtype" "$message"
pico_create_simple_object "$to" "$from" "$type" "$subtype" "$message"
pico_create_object_stanza "$id" "$to" "$from" "$type" "$subtype" "$message"


}