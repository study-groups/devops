const http = require('http');

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end(`
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@700&display=swap" rel="stylesheet">
<style>
html{
font-family: 'Josefin Sans', sans-serif;
font-size:30pt;
text-align:center;
color:#aaa;
background:#111;
}
</style>
</head>
<body>
Study Groups
</body>
</html>
`);
}

const server = http.createServer(requestListener);
server.listen(9090);
