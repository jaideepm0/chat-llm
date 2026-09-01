#!/usr/bin/env python3
"""Minimal static file server for local preview on http://localhost:8080"""
import http.server, socketserver, pathlib
PORT=8080
ROOT=pathlib.Path(__file__).parent.resolve()
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):
        super().__init__(*a,directory=str(ROOT),**kw)
    def send_error(self,code,msg=None,explain=None):
        if code==404 and '.' not in self.path.rsplit('/',1)[-1]:
            self.path='/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        return super().send_error(code,msg,explain)
if __name__=='__main__':
    with socketserver.TCPServer(("",PORT),Handler) as httpd:
        print(f"Serving on http://localhost:{PORT} (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server")
