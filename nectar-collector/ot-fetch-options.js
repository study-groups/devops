$input = document.getElementById("input");
$stdin = document.getElementById("stdin");
$stdout = document.getElementById("stdout");
$form = document.getElementById("form");

$form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmit(event);
});

//https://stackoverflow.com/questions/11547672/how-to-stringify-event-object
function stringifyEvent(e) {
  const obj = {};
  for (let k in e) {
    obj[k] = e[k];
  }
  return JSON.stringify(obj, (k, v) => {
    if (v instanceof Node) return 'Node';
    if (v instanceof Window) return 'Window';
    return v;
  }, ' ');
}

function stdout(txt){
  $stdout.InnerText=txt;
}

function checkErrors(res) {
    console.log("res", res);
    console.log("status", res.status);
    if (!res.ok) {
        throw Error(`status: ${res.statusText}`);
    }
    return res;
}

function handleSubmit(event){
  url="http://lenan.net:3000/hello";
  console.log(event);
  $stdin.innerHTML += `Request: ${$input.value}<br>`;
  ot_fetch(url,{data:"Pretty good."});
}

function ot_fetch(url,data){
  return fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'no-cors', // no-cors, *cors, same-origin
    // *default, no-cache, reload, force-cache, only-if-cached
    cache: 'no-cache', 
    //credentials: 'same-origin', // include, *same-origin, omit
    headers: {
        'Content-Type': 'application/json'
        // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', 
    // no-referrer, *no-referrer-when-downgrade, origin, 
    // origin-when-cross-origin, same-origin, strict-origin,
    // strict-origin-when-cross-origin, unsafe-url
    // body data type must match "Content-Type" header
    body: JSON.stringify(data) 
  })
    .then(res => {console.log("res",res); return res; } )
    .then(res => res.json())
    .then(data => stdout(data))
    .catch((err) => {
      console.error('Caught error:', err.message);
    });
}
