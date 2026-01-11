#!/usr/bin/env python3
"""
Image Viewer Server with reorder, rename, and delete functionality.
Deleted files are moved to a tmp/ directory.

Usage: python3 server.py [PORT] [DIRECTORY]
  PORT      - Port or range start (default: auto 5000-5099)
              0=auto 5000+, 3000=node, 4000=tetra, 8000=http
  DIRECTORY - Directory to serve images from (default: current directory)
"""

import os
import sys
import json
import shutil
import socket
import argparse
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Port ranges (loosely defined):
#   3000-3099: Node services
#   4000-4099: Tetra services
#   5000-5099: Default/misc (imgview default)
#   8000-8099: Python http.server / HTTP services

def find_available_port(start=5000, end=None):
    """Find first available port in range (default 5000-5099)."""
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

def parse_args():
    parser = argparse.ArgumentParser(description='Image Viewer Server')
    parser.add_argument('port', nargs='?', type=int, default=0,
                        help='Port or range start (0=auto 5000+, 3000=3000+, etc)')
    parser.add_argument('directory', nargs='?', default='.', help='Directory (default: .)')
    return parser.parse_args()

args = parse_args()

# Priority: 1) CLI arg, 2) PORT env var (from TSM), 3) auto-allocate
env_port = os.environ.get('PORT')
if args.port != 0:
    # Explicit CLI argument provided
    if args.port % 1000 == 0:
        # Round number like 3000, 4000, 8000 means "find in this range"
        PORT = find_available_port(args.port)
    else:
        PORT = args.port
elif env_port:
    # TSM sets PORT env var
    PORT = int(env_port)
else:
    # Default: auto-allocate from 5000+
    PORT = find_available_port(5000)

if PORT is None:
    print(f"No available port in range")
    sys.exit(1)
BASE_DIR = Path(args.directory).resolve()
TMP_DIR = BASE_DIR / "tmp"

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg'}

def get_images():
    """Get all images sorted by creation time, excluding ._ and part files."""
    images = []
    for ext in IMAGE_EXTENSIONS:
        for f in BASE_DIR.glob(f"**/*{ext}"):
            if f.name.startswith("._") or "part" in f.name.lower():
                continue
            if TMP_DIR in f.parents or f.parent == TMP_DIR:
                continue
            stat = f.stat()
            ctime = stat.st_birthtime if hasattr(stat, 'st_birthtime') else stat.st_mtime
            images.append({
                "path": str(f.relative_to(BASE_DIR)),
                "name": f.name,
                "size": stat.st_size,
                "ctime": ctime
            })
    images.sort(key=lambda x: x["ctime"])
    return images

def get_trash():
    """Get all files in tmp directory."""
    if not TMP_DIR.exists():
        return []
    trash = []
    for ext in IMAGE_EXTENSIONS:
        for f in TMP_DIR.glob(f"*{ext}"):
            stat = f.stat()
            trash.append({
                "path": str(f.relative_to(BASE_DIR)),
                "name": f.name,
                "size": stat.st_size
            })
    return trash

def format_size(size):
    """Format file size for display."""
    if size >= 1048576:
        return f"{size / 1048576:.1f}MB"
    elif size >= 1024:
        return f"{size // 1024}KB"
    return f"{size}B"

class ImageViewerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_viewer()
        elif self.path == "/api/images":
            self.send_json(get_images())
        elif self.path == "/api/trash":
            self.send_json(get_trash())
        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body) if body else {}

        if self.path == "/api/rename":
            self.handle_rename(data)
        elif self.path == "/api/delete":
            self.handle_delete(data)
        elif self.path == "/api/reorder":
            self.handle_reorder(data)
        elif self.path == "/api/empty-trash":
            self.handle_empty_trash()
        elif self.path == "/api/restore":
            self.handle_restore(data)
        else:
            self.send_error(404)

    def send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def handle_rename(self, data):
        old_path = BASE_DIR / data["path"]
        new_name = data["newName"]
        old_ext = old_path.suffix.lower()
        if not any(new_name.lower().endswith(ext) for ext in IMAGE_EXTENSIONS):
            new_name += old_ext
        new_path = old_path.parent / new_name

        if old_path.exists() and not new_path.exists():
            old_path.rename(new_path)
            self.send_json({"success": True, "newPath": str(new_path.relative_to(BASE_DIR))})
        else:
            self.send_json({"success": False, "error": "File not found or name exists"})

    def handle_delete(self, data):
        file_path = BASE_DIR / data["path"]
        if file_path.exists():
            TMP_DIR.mkdir(exist_ok=True)
            dest = TMP_DIR / file_path.name
            counter = 1
            while dest.exists():
                dest = TMP_DIR / f"{file_path.stem}_{counter}{file_path.suffix}"
                counter += 1
            shutil.move(str(file_path), str(dest))
            self.send_json({"success": True})
        else:
            self.send_json({"success": False, "error": "File not found"})

    def handle_restore(self, data):
        file_path = BASE_DIR / data["path"]
        if file_path.exists() and (TMP_DIR in file_path.parents or file_path.parent == TMP_DIR):
            dest = BASE_DIR / file_path.name
            counter = 1
            while dest.exists():
                dest = BASE_DIR / f"{file_path.stem}_{counter}{file_path.suffix}"
                counter += 1
            shutil.move(str(file_path), str(dest))
            self.send_json({"success": True})
        else:
            self.send_json({"success": False, "error": "File not found"})

    def handle_reorder(self, data):
        """Reorder by updating mtime."""
        order = data.get("order", [])
        for i, path in enumerate(order):
            file_path = BASE_DIR / path
            if file_path.exists():
                new_time = 1000000000 + i
                os.utime(file_path, (new_time, new_time))
        self.send_json({"success": True})

    def handle_empty_trash(self):
        if TMP_DIR.exists():
            for ext in IMAGE_EXTENSIONS:
                for f in TMP_DIR.glob(f"*{ext}"):
                    f.unlink()
            self.send_json({"success": True, "deleted": True})
        else:
            self.send_json({"success": True, "deleted": False})

    def send_viewer(self):
        images = get_images()
        trash = get_trash()

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image Viewer - {BASE_DIR.name}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      background-color: #111;
      color: #fff;
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: -apple-system, sans-serif;
    }}
    #viewer {{
      position: relative;
      width: 100vw;
      height: 100vh;
    }}
    .slide {{
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: calc(100% - 60px);
    }}
    .slide.active {{
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .slide img {{
      max-width: 95%;
      max-height: 95%;
    }}
    .file-info {{
      position: absolute;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.5);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      font-family: monospace;
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .file-info .filename {{
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      border-bottom: 1px dashed rgba(255,255,255,0.3);
    }}
    .file-info .filename:hover {{
      color: #4af;
    }}
    .file-info .meta {{
      color: rgba(255, 255, 255, 0.5);
    }}
    .file-info .delete-btn {{
      color: rgba(255, 100, 100, 0.7);
      cursor: pointer;
      margin-left: 8px;
    }}
    .file-info .delete-btn:hover {{
      color: #f55;
    }}
    .controls {{
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(0,0,0,0.8);
      z-index: 10;
    }}
    .controls button {{
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 4px;
    }}
    .controls button:hover {{
      background: #444;
    }}
    .controls button.danger {{
      background: #533;
      border-color: #755;
    }}
    .controls button.danger:hover {{
      background: #644;
    }}
    .trash-count {{
      color: #888;
      font-size: 12px;
      margin-left: 4px;
    }}
    .modal {{
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }}
    .modal.active {{
      display: flex;
    }}
    .modal-content {{
      background: #222;
      padding: 24px;
      border-radius: 8px;
      min-width: 300px;
    }}
    .modal-content h3 {{
      margin: 0 0 16px 0;
    }}
    .modal-content input {{
      width: 100%;
      padding: 8px;
      font-size: 14px;
      background: #333;
      border: 1px solid #555;
      color: #fff;
      border-radius: 4px;
      margin-bottom: 16px;
    }}
    .modal-content .buttons {{
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }}
    .modal-content button {{
      padding: 8px 16px;
      cursor: pointer;
      background: #444;
      color: #fff;
      border: 1px solid #666;
      border-radius: 4px;
    }}
    .modal-content button.primary {{
      background: #2a5;
      border-color: #3b6;
    }}
    .reorder-panel {{
      display: none;
      position: fixed;
      top: 0;
      right: 0;
      width: 200px;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 50;
      overflow-y: auto;
      padding: 10px;
    }}
    .reorder-panel.active {{
      display: block;
    }}
    .reorder-panel h4 {{
      margin: 0 0 10px 0;
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
    }}
    .reorder-item {{
      background: #333;
      padding: 8px;
      margin-bottom: 4px;
      border-radius: 4px;
      cursor: grab;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .reorder-item:active {{
      cursor: grabbing;
    }}
    .reorder-item.dragging {{
      opacity: 0.5;
    }}
    .reorder-buttons {{
      margin-top: 10px;
      display: flex;
      gap: 8px;
    }}
    .reorder-buttons button {{
      flex: 1;
      padding: 8px;
      font-size: 12px;
      cursor: pointer;
      background: #444;
      color: #fff;
      border: 1px solid #666;
      border-radius: 4px;
    }}
    .reorder-buttons button.save {{
      background: #2a5;
    }}
    .empty-state {{
      display: flex;
      align-items: center;
      justify-content: center;
      height: calc(100% - 60px);
      color: #666;
      font-size: 18px;
    }}
  </style>
</head>
<body>
<div id="viewer">
'''
        if not images:
            html += '  <div class="empty-state">No images found</div>\n'
        else:
            for i, img in enumerate(images):
                active = "active" if i == 0 else ""
                size_str = format_size(img["size"])
                date_str = datetime.fromtimestamp(img["ctime"]).strftime("%Y-%m-%d %H:%M")
                dir_name = str(Path(img["path"]).parent)
                dir_display = f'<span class="meta">{dir_name}/</span>' if dir_name != "." else ""
                html += f'''  <div class="slide {active}" data-path="{img["path"]}" data-index="{i}">
    <img src="{img["path"]}">
    <div class="file-info">
      {dir_display}<span class="filename" onclick="renameFile({i})">{img["name"]}</span>
      <span class="meta">{date_str}</span>
      <span class="meta">{size_str}</span>
      <span class="meta">{i+1}/{len(images)}</span>
      <span class="delete-btn" onclick="deleteFile({i})">&#x2715;</span>
    </div>
  </div>
'''

        trash_count = len(trash)
        html += f'''</div>
<div class="controls">
  <button onclick="prevImage()">&#9664; Prev</button>
  <button onclick="nextImage()">Next &#9654;</button>
  <button onclick="toggleFullscreen()">Fullscreen</button>
  <button onclick="toggleAutoPlay()">Auto-play</button>
  <button onclick="toggleReorder()">Reorder</button>
  <button class="danger" onclick="emptyTrash()">Empty Trash<span class="trash-count" id="trashCount">({trash_count})</span></button>
</div>

<div class="modal" id="renameModal">
  <div class="modal-content">
    <h3>Rename File</h3>
    <input type="text" id="newFileName" placeholder="New filename">
    <div class="buttons">
      <button onclick="closeModal()">Cancel</button>
      <button class="primary" onclick="confirmRename()">Rename</button>
    </div>
  </div>
</div>

<div class="reorder-panel" id="reorderPanel">
  <h4>Drag to Reorder</h4>
  <div id="reorderList"></div>
  <div class="reorder-buttons">
    <button onclick="toggleReorder()">Cancel</button>
    <button class="save" onclick="saveOrder()">Save</button>
  </div>
</div>

<script>
let currentIndex = 0;
let slides = document.querySelectorAll(".slide");
let autoPlay = false;
let intervalId = null;
let renamingIndex = -1;
let trashCount = {trash_count};

function showSlide(index) {{
  if (slides.length === 0) return;
  slides[currentIndex].classList.remove("active");
  currentIndex = (index + slides.length) % slides.length;
  slides[currentIndex].classList.add("active");
}}

function nextImage() {{ showSlide(currentIndex + 1); }}
function prevImage() {{ showSlide(currentIndex - 1); }}

function toggleFullscreen() {{
  if (!document.fullscreenElement) {{
    document.documentElement.requestFullscreen();
  }} else {{
    document.exitFullscreen();
  }}
}}

function toggleAutoPlay() {{
  autoPlay = !autoPlay;
  if (autoPlay) {{
    intervalId = setInterval(nextImage, 3000);
  }} else {{
    clearInterval(intervalId);
  }}
}}

function renameFile(index) {{
  renamingIndex = index;
  const slide = slides[index];
  const currentName = slide.querySelector('.filename').textContent;
  document.getElementById('newFileName').value = currentName.replace(/\.(png|jpg|jpeg)$/i, '');
  document.getElementById('renameModal').classList.add('active');
  document.getElementById('newFileName').focus();
}}

function closeModal() {{
  document.getElementById('renameModal').classList.remove('active');
  renamingIndex = -1;
}}

async function confirmRename() {{
  if (renamingIndex < 0) return;
  const slide = slides[renamingIndex];
  const path = slide.dataset.path;
  const newName = document.getElementById('newFileName').value.trim();

  const resp = await fetch('/api/rename', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ path, newName }})
  }});
  const data = await resp.json();
  if (data.success) {{
    location.reload();
  }} else {{
    alert('Rename failed: ' + data.error);
  }}
  closeModal();
}}

async function deleteFile(index) {{
  const slide = slides[index];
  const path = slide.dataset.path;
  const name = slide.querySelector('.filename').textContent;

  if (!confirm(`Move "${{name}}" to trash?`)) return;

  const resp = await fetch('/api/delete', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ path }})
  }});
  const data = await resp.json();
  if (data.success) {{
    trashCount++;
    document.getElementById('trashCount').textContent = `(${{trashCount}})`;
    slide.remove();
    slides = document.querySelectorAll(".slide");
    if (slides.length > 0) {{
      currentIndex = Math.min(currentIndex, slides.length - 1);
      slides[currentIndex].classList.add("active");
      updateIndices();
    }}
  }}
}}

function updateIndices() {{
  slides.forEach((slide, i) => {{
    const meta = slide.querySelectorAll('.meta');
    meta[meta.length - 1].textContent = `${{i+1}}/${{slides.length}}`;
  }});
}}

async function emptyTrash() {{
  if (trashCount === 0) {{
    alert('Trash is empty');
    return;
  }}
  if (!confirm(`Permanently delete ${{trashCount}} file(s) from trash?`)) return;

  const resp = await fetch('/api/empty-trash', {{
    method: 'POST'
  }});
  const data = await resp.json();
  if (data.success) {{
    trashCount = 0;
    document.getElementById('trashCount').textContent = '(0)';
  }}
}}

function toggleReorder() {{
  const panel = document.getElementById('reorderPanel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) {{
    buildReorderList();
  }}
}}

function buildReorderList() {{
  const list = document.getElementById('reorderList');
  list.innerHTML = '';
  slides.forEach((slide, i) => {{
    const item = document.createElement('div');
    item.className = 'reorder-item';
    item.draggable = true;
    item.dataset.path = slide.dataset.path;
    item.textContent = slide.querySelector('.filename').textContent;
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    list.appendChild(item);
  }});
}}

let draggedItem = null;

function handleDragStart(e) {{
  draggedItem = this;
  this.classList.add('dragging');
}}

function handleDragOver(e) {{
  e.preventDefault();
  const list = document.getElementById('reorderList');
  const afterElement = getDragAfterElement(list, e.clientY);
  if (afterElement == null) {{
    list.appendChild(draggedItem);
  }} else {{
    list.insertBefore(draggedItem, afterElement);
  }}
}}

function getDragAfterElement(container, y) {{
  const items = [...container.querySelectorAll('.reorder-item:not(.dragging)')];
  return items.reduce((closest, child) => {{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {{
      return {{ offset, element: child }};
    }}
    return closest;
  }}, {{ offset: Number.NEGATIVE_INFINITY }}).element;
}}

function handleDrop(e) {{
  e.preventDefault();
}}

function handleDragEnd() {{
  this.classList.remove('dragging');
  draggedItem = null;
}}

async function saveOrder() {{
  const items = document.querySelectorAll('#reorderList .reorder-item');
  const order = [...items].map(item => item.dataset.path);

  const resp = await fetch('/api/reorder', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{ order }})
  }});
  const data = await resp.json();
  if (data.success) {{
    location.reload();
  }}
}}

document.addEventListener('keydown', function(e) {{
  if (document.getElementById('renameModal').classList.contains('active')) {{
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter') confirmRename();
    return;
  }}
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
  if (e.key === 'f') toggleFullscreen();
  if (e.key === 'Delete' || e.key === 'Backspace') deleteFile(currentIndex);
}});
</script>
</body>
</html>'''

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print(f"Image Viewer Server")
    print(f"  URL: http://localhost:{PORT}")
    print(f"  Directory: {BASE_DIR}")
    print(f"  Trash: {TMP_DIR}")
    httpd = HTTPServer(("", PORT), ImageViewerHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.shutdown()
