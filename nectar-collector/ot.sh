alias build='source ot.sh; ot-sae > index.html'

qik ()
{
    local date=$(date +%s);
    cp $1 .qik/$1.$date;
    echo $date $2 >> .qik/log
}

ot-help(){

  echo "
  Object-Tool is a collection of shell functions that 
  creates HTML single page apps to test nodeholder objects
  and thier relations.
  "
}

ot-serve(){
  local port=8000;
  python3 -m http.server $port
}

ot-sae(){
  local js=$(cat ot.js);
echo -e "$(cat << EOF
<!DOCTYPE>
<html>
<content>

<div id="contentA">
$1
</div>

<div id="contentB">
$2
</div>

<div id="cmdline">
<form id="form" >
<input id="input" value="http://lenan.net:3000/hello"></input>
<input value="submit" type="submit"></input>
<input id="tx_json" value="Looking good."></input>
</form>
<div id="stdin"></div>
<div id="stdout"></div>
</div>
</content>

<script>
$js
</script>
</html>
EOF
)"
}
