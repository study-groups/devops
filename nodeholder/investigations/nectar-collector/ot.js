input = document.getElementById("input");
stdin = document.getElementById("stdin");
stdout = document.getElementById("stdout");
form = document.getElementById("form");
tx_json = document.getElementById("tx_json");

url='http://lenan.net:3000/analyze/sentiment'
urlHello='http://lenan.net:3000/hello'

form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmit(event);
});

function updateStdout(txt){
  stdout.innerText=txt;
}

function handleSubmit(event){
  let url= input.value;
  data = JSON.parse(tx_json.value);
  stdin.innerHTML = `Request: ${url}<br>`;
  stdin.innerHTML += `data:<pre>${JSON.stringify(data)}</pre><br>`;
  ot_fetch(url,data); 
}

function ot_fetch(url,data){
  console.log("Sending", data);
  fetch(url, {
    method: 'POST',
   headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify(data)
  })
    .then(res => res.json())
    .then(rx_json => {
        console.log("Received JSON:", rx_json);
        updateStdout(JSON.stringify(rx_json));
        return rx_json;
    });
}
