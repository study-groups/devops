# Define the color map
declare -A color_map
color_map["ping"]="color1"
color_map["pong"]="color2"
color_map["agents/power"]="color3"
color_map["tetra"]="color4"


# Define multiple color palettes for the status bar
declare -a status_fg=("colour226" "colour214" "colour202" \
 "colour190" "colour154" "colour118" "colour82" "colour46")

# Background colors - darker shades for contrast
declare -a status_bg=("colour52" "colour53" "colour54" \
  "colour55" "colour56" "colour57" "colour58" "colour59")

color_index=0

get_next_color_scheme() {
    local fg_color="${status_fg[color_index]}"
    local bg_color="${status_bg[color_index]}"
    color_index=$(( (color_index + 1) % ${#status_fg[@]} ))

    echo "$fg_color" "$bg_color"
}
