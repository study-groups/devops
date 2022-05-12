const path = require("path");
const http = require("http");

const staticBasePath = "./public"
const port = process.env.PORT;

const staticServe = function(req, res) {
    const resolvedBase = path.resolve(staticBasePath);
    const safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
    const fileLoc = path.join(resolvedBase, safeSuffix);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    res.write(fileLoc);

    return res.end();
}

const httpServer = http.createServer(staticServe);

httpServer.listen(
    port,
    () => console.log(`Server running on port:${port}`)
);
