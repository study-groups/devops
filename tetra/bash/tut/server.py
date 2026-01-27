#!/usr/bin/env python3
"""
Tut Server - System-wide tutorial browser.

Scans $TETRA_DIR/orgs/*/tut/compiled/ and serves a web index of all
compiled documentation organized by org.

Routes:
  /                              Index page with org cards
  /orgs/<org>/tut/compiled/      Directory listing for an org
  /orgs/<org>/tut/compiled/X.html  Serve compiled HTML
  /api/orgs                      JSON org/file listing
  /health                        TSM health check

Usage: python3 server.py [PORT]
  PORT defaults to $PORT env var, then auto-allocates from 8000+.
"""

import os
import sys
import json
import socket
import argparse
import re
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote

TETRA_DIR = os.environ.get('TETRA_DIR', os.path.expanduser('~/tetra'))

def find_available_port(start=8000, end=None):
    if end is None:
        end = start + 99
    for port in range(start, end + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return None

def scan_orgs():
    """Scan all orgs for tut/compiled HTML files."""
    orgs_dir = Path(TETRA_DIR) / 'orgs'
    result = []
    if not orgs_dir.is_dir():
        return result
    for org_path in sorted(orgs_dir.iterdir()):
        if not org_path.is_dir():
            continue
        compiled = org_path / 'tut' / 'compiled'
        if not compiled.is_dir():
            continue
        files = sorted(f.name for f in compiled.glob('*.html'))
        if files:
            result.append({'name': org_path.name, 'files': files})
    return result

def parse_filename(name):
    """Parse 'subject-type.html' into (subject, type)."""
    base = name.replace('.html', '')
    m = re.match(r'^(.+)-([^-]+)$', base)
    if m:
        return m.group(1), m.group(2)
    return base, ''

def render_index(orgs):
    cards = ''
    for org in orgs:
        file_links = ''
        for f in org['files']:
            subject, typ = parse_filename(f)
            file_links += (
                f'<a class="doc-link" href="/orgs/{org["name"]}/tut/compiled/{f}">'
                f'<span class="doc-subject">{subject}</span>'
                f'<span class="doc-type">{typ}</span>'
                f'</a>\n'
            )
        cards += f'''<div class="org-card">
  <div class="org-header">
    <span class="org-name">{org["name"]}</span>
    <span class="org-count">{len(org["files"])}</span>
  </div>
  <div class="org-files">{file_links}</div>
</div>
'''
    if not orgs:
        cards = '<div class="empty">No orgs with compiled tutorials found.<br>Use <code>tut build</code> to compile.</div>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tut - Tutorial Browser</title>
<style>
:root {{
  --paper-dark: #0a0a0a;
  --paper-mid: #1a1a1a;
  --paper-light: #2a2a2a;
  --ink: #e0e0e0;
  --ink-muted: #666;
  --border: #333;
  --one: #ff6b6b;
  --two: #4ecdc4;
  --three: #ffe66d;
  --four: #6b5ce7;
  --font-mono: 'SF Mono', 'Monaco', 'Consolas', monospace;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  background: var(--paper-dark);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  min-height: 100vh;
}}
.header {{
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}}
.header h1 {{
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--four);
}}
.header .path {{
  font-size: 10px;
  color: var(--ink-muted);
}}
.grid {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  padding: 16px 20px;
}}
.org-card {{
  background: var(--paper-mid);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}}
.org-header {{
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--paper-light);
}}
.org-name {{
  font-size: 13px;
  font-weight: 700;
  color: var(--two);
}}
.org-count {{
  font-size: 10px;
  color: var(--ink-muted);
  background: var(--paper-dark);
  padding: 2px 8px;
  border-radius: 2px;
}}
.org-files {{
  padding: 6px 0;
}}
.doc-link {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  color: var(--ink);
  text-decoration: none;
  transition: background 0.1s;
}}
.doc-link:hover {{
  background: var(--paper-light);
}}
.doc-subject {{
  font-size: 12px;
}}
.doc-type {{
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-muted);
  background: var(--paper-dark);
  padding: 2px 6px;
  border-radius: 2px;
}}
.empty {{
  padding: 40px 20px;
  text-align: center;
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 2;
}}
.empty code {{
  background: var(--paper-mid);
  padding: 2px 6px;
  border-radius: 2px;
  color: var(--three);
}}
.breadcrumb {{
  padding: 10px 20px;
  font-size: 11px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);
}}
.breadcrumb a {{
  color: var(--four);
  text-decoration: none;
}}
.breadcrumb a:hover {{ text-decoration: underline; }}
.file-list {{
  padding: 8px 0;
}}
.file-item {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  color: var(--ink);
  text-decoration: none;
  transition: background 0.1s;
}}
.file-item:hover {{ background: var(--paper-light); }}
.file-item .name {{ font-size: 12px; }}
.file-item .type {{
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-muted);
  background: var(--paper-dark);
  padding: 2px 6px;
  border-radius: 2px;
}}
</style>
</head>
<body>
<div class="header">
  <h1>Tut</h1>
  <span class="path">{TETRA_DIR}/orgs/*/tut/compiled/</span>
</div>
<div class="grid">
{cards}
</div>
</body>
</html>'''

def render_org_listing(org_name, files):
    items = ''
    for f in files:
        subject, typ = parse_filename(f)
        items += (
            f'<a class="file-item" href="/orgs/{org_name}/tut/compiled/{f}">'
            f'<span class="name">{subject}</span>'
            f'<span class="type">{typ}</span>'
            f'</a>\n'
        )
    if not files:
        items = '<div class="empty">No compiled docs for this org.</div>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{org_name} - Tutorials</title>
<style>
:root {{
  --paper-dark: #0a0a0a;
  --paper-mid: #1a1a1a;
  --paper-light: #2a2a2a;
  --ink: #e0e0e0;
  --ink-muted: #666;
  --border: #333;
  --one: #ff6b6b;
  --two: #4ecdc4;
  --three: #ffe66d;
  --four: #6b5ce7;
  --font-mono: 'SF Mono', 'Monaco', 'Consolas', monospace;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  background: var(--paper-dark);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  min-height: 100vh;
}}
.header {{
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}}
.header h1 {{
  font-size: 14px;
  font-weight: 600;
  color: var(--two);
}}
.breadcrumb {{
  padding: 10px 20px;
  font-size: 11px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);
}}
.breadcrumb a {{
  color: var(--four);
  text-decoration: none;
}}
.breadcrumb a:hover {{ text-decoration: underline; }}
.file-list {{
  padding: 8px 0;
}}
.file-item {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  color: var(--ink);
  text-decoration: none;
  transition: background 0.1s;
}}
.file-item:hover {{ background: var(--paper-light); }}
.file-item .name {{ font-size: 12px; }}
.file-item .type {{
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-muted);
  background: var(--paper-dark);
  padding: 2px 6px;
  border-radius: 2px;
}}
.empty {{
  padding: 40px 20px;
  text-align: center;
  color: var(--ink-muted);
}}
</style>
</head>
<body>
<div class="header">
  <h1>{org_name}</h1>
</div>
<div class="breadcrumb">
  <a href="/">tut</a> / {org_name} / compiled
</div>
<div class="file-list">
{items}
</div>
</body>
</html>'''


class TutHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = unquote(self.path).split('?')[0]

        if path == '/' or path == '/index.html':
            orgs = scan_orgs()
            self.send_html(render_index(orgs))
            return

        if path == '/health':
            self.send_json({'service': 'tut-server', 'status': 'healthy'})
            return

        if path == '/api/orgs':
            self.send_json({'orgs': scan_orgs()})
            return

        # /orgs/<org>/tut/compiled/ — directory listing
        m = re.match(r'^/orgs/([^/]+)/tut/compiled/?$', path)
        if m:
            org_name = m.group(1)
            compiled = Path(TETRA_DIR) / 'orgs' / org_name / 'tut' / 'compiled'
            if compiled.is_dir():
                files = sorted(f.name for f in compiled.glob('*.html'))
                self.send_html(render_org_listing(org_name, files))
            else:
                self.send_error(404, f'No compiled dir for org: {org_name}')
            return

        # /orgs/<org>/tut/compiled/<file> — serve the file
        m = re.match(r'^/orgs/([^/]+)/tut/compiled/(.+)$', path)
        if m:
            org_name = m.group(1)
            filename = m.group(2)
            # Prevent path traversal
            if '..' in filename or filename.startswith('/'):
                self.send_error(403)
                return
            filepath = Path(TETRA_DIR) / 'orgs' / org_name / 'tut' / 'compiled' / filename
            if filepath.is_file():
                self.send_response(200)
                if filepath.suffix == '.html':
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                elif filepath.suffix == '.css':
                    self.send_header('Content-Type', 'text/css')
                elif filepath.suffix == '.js':
                    self.send_header('Content-Type', 'application/javascript')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                self.end_headers()
                self.wfile.write(filepath.read_bytes())
            else:
                self.send_error(404)
            return

        self.send_error(404)

    def send_html(self, html):
        data = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, obj):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        # Quieter logging
        sys.stderr.write(f"[tut] {args[0]}\n")


def main():
    parser = argparse.ArgumentParser(description='Tut Server - Tutorial Browser')
    parser.add_argument('port', nargs='?', type=int, default=0,
                        help='Port (0=auto 8000+)')
    args = parser.parse_args()

    env_port = os.environ.get('PORT')
    if args.port != 0:
        port = args.port
    elif env_port:
        port = int(env_port)
    else:
        port = find_available_port(8000)

    if port is None:
        print("No available port", file=sys.stderr)
        sys.exit(1)

    orgs = scan_orgs()
    print(f"Tut Server")
    print(f"  URL:       http://localhost:{port}")
    print(f"  TETRA_DIR: {TETRA_DIR}")
    print(f"  Orgs:      {len(orgs)} with compiled docs")
    for org in orgs:
        print(f"    {org['name']}: {len(org['files'])} file(s)")

    httpd = HTTPServer(('127.0.0.1', port), TutHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.shutdown()


if __name__ == '__main__':
    main()
