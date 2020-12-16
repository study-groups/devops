while IFS="" read -r -e -p "nh:$cmd> " cmd; do
  if [ "$cmd" = "quit" ]; then
   break 
  else
   $cmd
  fi
done
