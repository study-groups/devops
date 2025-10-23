from http.server import HTTPServer, BaseHTTPRequestHandler

def load_substitutions(filename='sub.vars'):
    subs = {}
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or '=' not in line:
                continue
            var, val = line.split('=', 1)
            subs[var.strip()] = val.strip()
    return subs

class CustomHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        subs = load_substitutions('sub.vars')
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        with open('index.html', 'r', encoding='utf-8') as f:
            content = f.read()

        for var, val in subs.items():
            content = content.replace(var, val)

        self.wfile.write(content.encode('utf-8'))

server = HTTPServer(('localhost', 8000), CustomHandler)
server.serve_forever()
