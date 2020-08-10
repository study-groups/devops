function test-nextportWithEmptyEnabledPorts(){
  seq 4000 4005 > ./available_ports 
  echo "" > ./enabled_ports
  local nextport=$(admin-create-port-fileMethod)
  # && - if left evaluates true, then do right
  # || - if left evaluates false, then do right
  [ "4000" -eq $nextport ] && echo "pass $LINENO" || echo "fail $LINENO"
 }
