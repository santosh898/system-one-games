#!/usr/bin/env python3
"""
System One Retro Arcade Suite Server
Serves:
  /             -> Arcade Hub (Home)
  /battleship/  -> 16-Bit Naval Battleship
  /snake/       -> 16-Bit Retro Snake
  /shared/      -> Shared assets (retro.css, systemone.js, audio-core.js, nav.js)
  /api/systemone-> CORS proxy to TypeSafe System One decision model
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import json
import os

PORT = 3000
BACKEND_URL = "http://127.0.0.1:8000/v1/systemone"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

class RetroArcadeHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS and no-cache for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-URL, x-goog-api-key, X-Goog-Api-Key')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        clean = self.path.split('?', 1)[0].split('#', 1)[0]
        if clean in ('/battleship', '/snake'):
            self.send_response(301)
            self.send_header('Location', f'{clean}/')
            self.end_headers()
            return
        super().do_HEAD()

    def do_GET(self):
        # Redirect clean routes without trailing slash so relative assets resolve properly
        clean = self.path.split('?', 1)[0].split('#', 1)[0]
        if clean == '/battleship':
            self.send_response(301)
            self.send_header('Location', '/battleship/')
            self.end_headers()
            return
        elif clean == '/snake':
            self.send_response(301)
            self.send_header('Location', '/snake/')
            self.end_headers()
            return
        elif clean == '/api/config':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'backend_url': BACKEND_URL}).encode('utf-8'))
            return

        super().do_GET()

    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]

        if clean in ('', '/', '/home', '/index.html'):
            return os.path.join(ROOT_DIR, 'index.html')
        elif clean == '/battleship/':
            return os.path.join(ROOT_DIR, 'games', 'battleship', 'index.html')
        elif clean.startswith('/battleship/'):
            subpath = clean[len('/battleship/'):]
            return os.path.join(ROOT_DIR, 'games', 'battleship', subpath)
        elif clean == '/snake/':
            return os.path.join(ROOT_DIR, 'games', 'snake', 'index.html')
        elif clean.startswith('/snake/'):
            subpath = clean[len('/snake/'):]
            return os.path.join(ROOT_DIR, 'games', 'snake', subpath)

        return super().translate_path(path)

    def do_POST(self):
        global BACKEND_URL
        if self.path in ('/api/systemone', '/v1/systemone'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            target_url = self.headers.get('X-Target-URL', BACKEND_URL)
            api_key = self.headers.get('x-goog-api-key') or self.headers.get('X-Goog-Api-Key') or os.environ.get('GEMINI_API_KEY', '')

            req_headers = {'Content-Type': 'application/json'}
            if api_key:
                req_headers['x-goog-api-key'] = api_key

            try:
                req = urllib.request.Request(
                    target_url,
                    data=body,
                    headers=req_headers,
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_data = resp.read()
                    self.send_response(resp.status)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(resp_data)
            except urllib.error.HTTPError as e:
                err_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body)
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/config':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                if 'backend_url' in data and data['backend_url'].strip():
                    BACKEND_URL = data['backend_url'].strip()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'backend_url': BACKEND_URL}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=PORT):
    os.chdir(ROOT_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), RetroArcadeHandler) as httpd:
        print(f"==================================================")
        print(f"🕹️ System One Retro Arcade Suite: http://127.0.0.1:{port}")
        print(f"  • Home (Arcade Hub): http://127.0.0.1:{port}/")
        print(f"  • Battleship:        http://127.0.0.1:{port}/battleship")
        print(f"  • Snake:             http://127.0.0.1:{port}/snake")
        print(f"🧠 Proxying /api/systemone -> {BACKEND_URL}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
