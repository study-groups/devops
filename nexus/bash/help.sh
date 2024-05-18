set_colors(){
    bold=$(tput bold)
    normal=$(tput sgr0)
    red=$(tput setaf 1)
    green=$(tput setaf 2)
    yellow=$(tput setaf 3)
    blue=$(tput setaf 4)
    magenta=$(tput setaf 5)
    cyan=$(tput setaf 6)
}

nexus_help(){
    set_colors

    cat <<EOF

  $(echo -e "${red}Nexus${normal} is pub/sub mechanism for ${green}Pico Objects${normal}.")

  Pico Object is a timestamped typed string encoded data
  with optional from and to strings. Always terminated with 0x0d

  1716015559550762 ${yellow}<optional>${normal} MSG This is text, could be uuencoded data.

  Valid examples
  1716015559550762 MSG This is text, could be uuencoded data.
  1716015559550762 ${cyan}to${normal}:[id1, id2] ${magenta}from${normal}:id4  MSG This is text.

EOF
}