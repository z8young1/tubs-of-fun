"""Local preview for site/.

site/index.html is written as page content only (no doctype/head/body) so it can be
published as an Artifact or pasted into a GoHighLevel custom code block. This server
wraps it in the same minimal document shell those hosts provide, so local previews
render in standards mode with a mobile viewport.

    python3 serve.py [port]
"""
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
SHELL = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
    "</head><body>{}</body></html>"
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
                body = SHELL.format(f.read()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8842
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
