_tetra-colors(){
  # Loop over the range of 256 colors
  for i in {0..255}; do
      # Print a color block with the color number and the color itself
      printf "\e[48;5;${i}m %3s \e[0m" "$i"
      # Print a line break after every 10 colors
      if (( $i % 10 == 9 )); then
         echo
      fi
  done
}

_tetra-colors-reversed(){
  for i in {255..0}; do
      printf "\e[48;5;${i}m %3s \e[0m" "$i"
      if (( $i % 10 == 9 )); then
         echo
      fi
  done
  echo
}

_tetra-colors-sorted(){

  # Define a function to calculate luminance
  # This is a very rough approximation
  calculate_luminance() {
      local r=$1
      local g=$2
      local b=$3
      echo $(( (r*2126 + g*7152 + b*722) / 10000 ))
  }

  # An array to hold luminance values
  declare -A luminance_map

  # Generate luminance values for a range of colors
  # This range is arbitrary and for demonstration purposes
  for color in {16..231}; do
      # Assuming a simple RGB mapping (this is not accurate for 256-color palettes)
      r=$((color / 36 % 6 * 51))
      g=$((color / 6 % 6 * 51))
      b=$((color % 6 * 51))

      luminance=$(calculate_luminance $r $g $b)

      # Store the luminance value with the color as key
      luminance_map[$color]=$luminance
  done

  # Sort colors by luminance
  for color in $(printf "%s\n" "${!luminance_map[@]}" | sort -n -k1); do
      printf "\e[48;5;%sm %3s \e[0m" "$color" "${luminance_map[$color]}"
      echo
  done
}

# Calculate luminance
calculate_luminance() {
    local r g b lum
    r=$(($1 * 51))
    g=$(($2 * 51))
    b=$(($3 * 51))
    lum=$(echo "scale=2; 0.2126 * $r + 0.7152 * $g + 0.0722 * $b" | bc)
    echo $lum
}

_tetra-color-cube(){
  declare -A colors

  # Generate colors in the 6x6x6 cube (16-231)
  for r in {0..5}; do
      for g in {0..5}; do
          for b in {0..5}; do
              color=$((16 + (r * 36) + (g * 6) + b))
              lum=$(calculate_luminance $r $g $b)
              colors[$color]=$lum
          done
      done
  done

  # Sort colors by luminance and print
  for color in $(printf "%s\n" "${!colors[@]}" | sort -t "=" -k2 -n); do
      printf "\e[48;5;%sm %3s \e[0m" "$color" "${colors[$color]}"
      if (( ($color - 15) % 6 == 0 )); then
          echo
      fi
  done
}
