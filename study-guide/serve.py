#!/usr/bin/env python3
"""Serve the study guide with caching disabled so local edits show up on reload.

The document root is the repository root, not the study-guide folder: the page
references the original exam scans as ``../199管综真题_Markdown题库/...``, so
those files have to stay inside the served tree. Open the app at
``/study-guide/index.html``.
"""

from __future__ import annotations

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - base signature
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = Path(__file__).resolve().parent.parent
    handler = partial(NoCacheHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"study-guide served at http://127.0.0.1:{port}/study-guide/index.html (no-cache)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
