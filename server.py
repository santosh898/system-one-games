#!/usr/bin/env python3
"""
Retro Battleship HTTP Server with CORS Proxy for System One API
Serves static UI files and proxies /api/systemone to http://127.0.0.1:8000/v1/systemone
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import json
import os

PORT = 3001
BACKEND_URL = "http://127.0.0.1:8000/v1/systemone"

class RetroBattleshipHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-URL')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # Route proxy to System One backend
        if self.path in ('/api/systemone', '/v1/systemone'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            target_url = self.headers.get('X-Target-URL', BACKEND_URL)
            try:
                req = urllib.request.Request(
                    target_url,
                    data=body,
                    headers={'Content-Type': 'application/json'},
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
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=PORT):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), RetroBattleshipHandler) as httpd:
        print(f"==================================================")
        print(f"⚓ Retro Battleship Arcade: http://127.0.0.1:{port}")
        print(f"🧠 Proxying /api/systemone -> {BACKEND_URL}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
