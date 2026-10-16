#!/usr/bin/env python3
"""Mirror https://www.liangela.com offline, including password-protected pages."""

from __future__ import annotations

import hashlib
import http.cookiejar
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

BASE = "https://www.liangela.com"
PASSWORD = "heyfriend"
OUT = Path(__file__).resolve().parent
SITE_DIR = OUT / "site"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SEED_PATHS = [
    "/",
    "/about",
    "/work",
    "/airbnbcohosting",
    "/archive",
    "/clearerfees",
    "/dropbox-esignature",
    "/marketplace-i18n",
    "/new-facebook",
    "/one-days-wages",
    "/story-highlights",
    "/locked-marketplace-internationalization",
    "/locked-new-facebook",
]

ASSET_HOSTS = {
    "www.liangela.com",
    "liangela.com",
    "static1.squarespace.com",
    "static.squarespace.com",
    "assets.squarespace.com",
    "images.squarespace-cdn.com",
    "file.squarespace-cdn.com",
    "definitions.sqspcdn.com",
    "use.typekit.net",
    "p.typekit.net",
    "fonts.gstatic.com",
    "fonts.googleapis.com",
}

URL_RE = re.compile(
    r"""(?P<url>(?:https?:)?//[^\s"'<>\\)]+|https?:\\?/\\?/[^\s"'<>\\)]+)""",
    re.I,
)
CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""", re.I)
SRCSET_RE = re.compile(r"""srcset\s*=\s*["']([^"']+)["']""", re.I)
HREF_SRC_RE = re.compile(
    r"""(?P<attr>(?:href|src|poster|data-src|data-image|data-url))\s*=\s*(?P<q>["'])(?P<url>[^"']+)(?P=q)""",
    re.I,
)


class NoRaise(urllib.request.HTTPErrorProcessor):
    def http_response(self, request, response):
        return response

    https_response = http_response


class Mirror:
    def __init__(self) -> None:
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cj), NoRaise
        )
        self.page_queue: deque[str] = deque()
        self.seen_pages: set[str] = set()
        self.asset_queue: deque[str] = deque()
        self.seen_assets: set[str] = set()
        self.url_to_local: dict[str, str] = {}
        self.errors: list[str] = []

    def crumb(self) -> str | None:
        for c in self.cj:
            if c.name == "crumb":
                return c.value
        return None

    def fetch(
        self, url: str, data: bytes | None = None, headers: dict | None = None, method: str | None = None
    ) -> tuple[int, bytes, str, dict]:
        h = {
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        if headers:
            h.update(headers)
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        try:
            resp = self.opener.open(req, timeout=90)
        except Exception as e:
            self.errors.append(f"fetch fail {url}: {e}")
            return 0, b"", url, {}
        hdrs = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, resp.read(), resp.geturl(), hdrs

    def unlock_all(self) -> None:
        self.fetch(BASE + "/")
        for path in [
            "/locked-marketplace-internationalization",
            "/locked-new-facebook",
        ]:
            status, body, _, _ = self.fetch(BASE + path)
            html = body.decode("utf-8", "replace")
            m = re.search(r'<body[^>]*id="([^"]*)"', html)
            if not m or "collection-" not in m.group(1):
                self.errors.append(f"could not find collection id for {path}")
                continue
            coll_id = m.group(1).split("collection-", 1)[1]
            crumb = self.crumb() or ""
            url = BASE + "/api/auth/visitor/collection?crumb=" + urllib.parse.quote(crumb)
            payload = json.dumps(
                {"password": PASSWORD, "collectionId": coll_id}
            ).encode()
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": BASE,
                "Referer": BASE + path,
                "x-csrf-token": crumb,
            }
            st, resp, _, _ = self.fetch(url, data=payload, headers=headers, method="POST")
            print(f"Unlocked {path}: HTTP {st} ({resp[:80]!r})")

    @staticmethod
    def normalize_url(url: str, base: str) -> str | None:
        if not url:
            return None
        url = url.strip()
        if url.startswith("//"):
            url = "https:" + url
        url = url.replace("\\/", "/")
        if url.startswith("data:") or url.startswith("mailto:") or url.startswith("tel:"):
            return None
        if url.startswith("javascript:") or url.startswith("#"):
            return None
        absolute = urllib.parse.urljoin(base, url)
        parts = urllib.parse.urlsplit(absolute)
        if parts.scheme not in ("http", "https"):
            return None
        # strip fragment
        absolute = urllib.parse.urlunsplit(
            (parts.scheme, parts.netloc, parts.path, parts.query, "")
        )
        return absolute

    def local_path_for(self, url: str, is_page: bool = False) -> Path:
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc.lower()
        path = unquote_path(parts.path)

        if host in ("www.liangela.com", "liangela.com") and is_page:
            if path in ("", "/"):
                return SITE_DIR / "index.html"
            clean = path.strip("/")
            return SITE_DIR / clean / "index.html"

        # assets
        safe_host = host.replace(":", "_")
        rel = path.lstrip("/")
        if not rel:
            rel = "index"
        if parts.query:
            qhash = hashlib.sha1(parts.query.encode()).hexdigest()[:10]
            # keep useful query suffixes for images like format=2500w
            fmt = ""
            qs = urllib.parse.parse_qs(parts.query)
            if "format" in qs:
                fmt = "__" + qs["format"][0]
            stem = Path(rel)
            rel = str(stem.with_name(stem.name + fmt + "_" + qhash + (stem.suffix if stem.suffix else "")))
            # avoid double extensions mess for files without suffix
            if not stem.suffix:
                rel = str(stem) + fmt + "_" + qhash

        return SITE_DIR / "_cdn" / safe_host / rel

    def enqueue_page(self, url: str) -> None:
        parts = urllib.parse.urlsplit(url)
        if parts.netloc.lower() not in ("www.liangela.com", "liangela.com"):
            return
        path = parts.path or "/"
        if path.startswith("/api/") or path.startswith("/universal/"):
            # still download as asset
            self.enqueue_asset(url)
            return
        key = path.rstrip("/") or "/"
        if key in self.seen_pages:
            return
        self.seen_pages.add(key)
        self.page_queue.append(key if key.startswith("/") else "/" + key)

    def enqueue_asset(self, url: str) -> None:
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc.lower()
        if host not in ASSET_HOSTS and not host.endswith(".squarespace.com") and not host.endswith(
            ".squarespace-cdn.com"
        ) and not host.endswith(".sqspcdn.com") and not host.endswith(".typekit.net"):
            return
        # skip cart/commerce noise
        if host in ("www.liangela.com", "liangela.com"):
            if parts.path.startswith("/cart"):
                return
        if url in self.seen_assets:
            return
        self.seen_assets.add(url)
        self.asset_queue.append(url)

    def extract_urls_from_text(self, text: str, base: str) -> None:
        for m in HREF_SRC_RE.finditer(text):
            u = self.normalize_url(m.group("url"), base)
            if not u:
                continue
            self.classify_and_enqueue(u)
        for m in SRCSET_RE.finditer(text):
            for part in m.group(1).split(","):
                candidate = part.strip().split(" ")[0]
                u = self.normalize_url(candidate, base)
                if u:
                    self.classify_and_enqueue(u)
        for m in CSS_URL_RE.finditer(text):
            u = self.normalize_url(m.group(2), base)
            if u:
                self.classify_and_enqueue(u)
        for m in URL_RE.finditer(text):
            raw = m.group("url")
            u = self.normalize_url(raw, base)
            if u:
                self.classify_and_enqueue(u)

        # protocol-relative and site paths in JSON
        for m in re.finditer(r'"(/(?:[^"\\]|\\.)+)"', text):
            raw = m.group(1).encode().decode("unicode_escape")
            if raw.startswith("//"):
                u = self.normalize_url(raw, base)
            elif raw.startswith("/") and not raw.startswith("//"):
                u = self.normalize_url(raw, BASE)
            else:
                continue
            if u:
                self.classify_and_enqueue(u)

    def classify_and_enqueue(self, url: str) -> None:
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc.lower()
        path = parts.path or "/"
        ext = Path(path).suffix.lower()
        page_exts = {"", ".html", ".htm"}
        asset_exts = {
            ".css",
            ".js",
            ".mjs",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".svg",
            ".ico",
            ".woff",
            ".woff2",
            ".ttf",
            ".otf",
            ".eot",
            ".mp4",
            ".webm",
            ".mov",
            ".json",
            ".map",
            ".txt",
        }
        if host in ("www.liangela.com", "liangela.com"):
            if ext in asset_exts or path.startswith("/universal/") or path.startswith("/api/"):
                self.enqueue_asset(url)
            elif ext in page_exts and not path.startswith("/api/"):
                # only html-ish paths
                if any(
                    path.startswith(p)
                    for p in (
                        "/about",
                        "/work",
                        "/archive",
                        "/airbnb",
                        "/clearer",
                        "/dropbox",
                        "/marketplace",
                        "/new-facebook",
                        "/one-days",
                        "/story",
                        "/locked-",
                        "/home",
                        "/cart",
                    )
                ) or path in ("/", ""):
                    self.enqueue_page(url)
                elif ext in {".html", ".htm"}:
                    self.enqueue_page(url)
                else:
                    # might still be a clean page slug
                    if "." not in Path(path).name:
                        self.enqueue_page(url)
                    else:
                        self.enqueue_asset(url)
            else:
                if "." not in Path(path).name:
                    self.enqueue_page(url)
                else:
                    self.enqueue_asset(url)
        else:
            self.enqueue_asset(url)

    def rewrite_urls(self, text: str, file_path: Path, base_url: str) -> str:
        def to_rel(absolute: str) -> str | None:
            local = self.url_to_local.get(absolute)
            if not local:
                # try without query variants already stored
                return None
            target = SITE_DIR / local
            try:
                rel = os.path.relpath(target, start=file_path.parent)
            except Exception:
                rel = "/" + local
            return rel.replace(os.sep, "/")

        def repl_attr(m: re.Match) -> str:
            absu = self.normalize_url(m.group("url"), base_url)
            if not absu:
                return m.group(0)
            rel = to_rel(absu)
            if not rel:
                # page path rewrite for site links
                parts = urllib.parse.urlsplit(absu)
                if parts.netloc.lower() in ("www.liangela.com", "liangela.com"):
                    path = parts.path or "/"
                    if path == "/":
                        rel = os.path.relpath(SITE_DIR / "index.html", start=file_path.parent)
                    else:
                        rel = os.path.relpath(
                            SITE_DIR / path.strip("/") / "index.html",
                            start=file_path.parent,
                        )
                    rel = rel.replace(os.sep, "/")
                else:
                    return m.group(0)
            return f'{m.group("attr")}={m.group("q")}{rel}{m.group("q")}'

        text = HREF_SRC_RE.sub(repl_attr, text)

        def repl_css(m: re.Match) -> str:
            absu = self.normalize_url(m.group(2), base_url)
            if not absu:
                return m.group(0)
            rel = to_rel(absu)
            if not rel:
                return m.group(0)
            quote = m.group(1) or '"'
            return f"url({quote}{rel}{quote})"

        text = CSS_URL_RE.sub(repl_css, text)

        # rewrite absolute CDN / site urls remaining in HTML/JS/JSON strings
        def repl_abs(m: re.Match) -> str:
            raw = m.group(0)
            absu = self.normalize_url(raw, base_url)
            if not absu:
                return raw
            rel = to_rel(absu)
            if not rel:
                parts = urllib.parse.urlsplit(absu)
                if parts.netloc.lower() in ("www.liangela.com", "liangela.com"):
                    path = parts.path or "/"
                    if path == "/":
                        rel = os.path.relpath(SITE_DIR / "index.html", start=file_path.parent)
                    elif "." not in Path(path).name:
                        rel = os.path.relpath(
                            SITE_DIR / path.strip("/") / "index.html",
                            start=file_path.parent,
                        )
                    else:
                        return raw
                    rel = rel.replace(os.sep, "/")
                else:
                    return raw
            return rel

        text = re.sub(
            r"""https?:\\?/\\?/(?:www\.)?liangela\.com[^"'\\\s]*|https?:\\?/\\?/(?:static1?|assets|images|file)\.(?:squarespace(?:-cdn)?\.com)[^"'\\\s]*|https?:\\?/\\?/definitions\.sqspcdn\.com[^"'\\\s]*|https?:\\?/\\?/(?:use|p)\.typekit\.net[^"'\\\s]*|//(?:static1?|assets|images|file)\.(?:squarespace(?:-cdn)?\.com)[^"'\\\s]*|//(?:use|p)\.typekit\.net[^"'\\\s]*|//definitions\.sqspcdn\.com[^"'\\\s]*""",
            repl_abs,
            text,
            flags=re.I,
        )
        return text

    def save_bytes(self, path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def download_pages(self) -> None:
        while self.page_queue:
            path = self.page_queue.popleft()
            url = BASE + (path if path != "/" else "/")
            print(f"PAGE {path}")
            status, body, final, hdrs = self.fetch(url)
            if status == 401:
                # try unlock again then refetch
                self.unlock_all()
                status, body, final, hdrs = self.fetch(url)
            if status not in (200, 401) or not body:
                self.errors.append(f"page {path} status {status}")
                continue
            html = body.decode("utf-8", "replace")
            local = self.local_path_for(url, is_page=True)
            rel = str(local.relative_to(SITE_DIR))
            self.url_to_local[url] = rel
            self.url_to_local[final.split("#")[0]] = rel

            self.extract_urls_from_text(html, final)

            # temporarily save raw; rewrite after assets known
            self.save_bytes(local, html.encode("utf-8"))

    def download_assets(self) -> None:
        # iterative: CSS/JS can reveal more assets
        rounds = 0
        while self.asset_queue and rounds < 50:
            rounds += 1
            batch = list(self.asset_queue)
            self.asset_queue.clear()
            for url in batch:
                print(f"ASSET {url[:120]}")
                status, body, final, hdrs = self.fetch(url)
                if status != 200 or not body:
                    # try without query
                    parts = urllib.parse.urlsplit(url)
                    if parts.query:
                        bare = urllib.parse.urlunsplit(
                            (parts.scheme, parts.netloc, parts.path, "", "")
                        )
                        status, body, final, hdrs = self.fetch(bare)
                if status != 200 or not body:
                    self.errors.append(f"asset fail {url} status={status}")
                    continue
                local = self.local_path_for(final if final else url)
                # ensure extension for typekit / extensionless
                ctype = hdrs.get("content-type", "").split(";")[0].strip()
                if not local.suffix and ctype:
                    ext = mimetypes.guess_extension(ctype) or ""
                    if ext == ".jpe":
                        ext = ".jpg"
                    if ext:
                        local = local.with_suffix(ext)
                rel = str(local.relative_to(SITE_DIR))
                self.url_to_local[url] = rel
                self.url_to_local[final] = rel
                # also map without query if present
                parts = urllib.parse.urlsplit(url)
                if parts.query:
                    bare = urllib.parse.urlunsplit(
                        (parts.scheme, parts.netloc, parts.path, "", "")
                    )
                    self.url_to_local.setdefault(bare, rel)

                self.save_bytes(local, body)

                if ctype.startswith("text/css") or local.suffix == ".css" or "javascript" in ctype or local.suffix in {
                    ".js",
                    ".mjs",
                }:
                    try:
                        text = body.decode("utf-8", "replace")
                    except Exception:
                        text = ""
                    if text:
                        self.extract_urls_from_text(text, final)

    def rewrite_all(self) -> None:
        print("Rewriting local URLs...")
        for path in SITE_DIR.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".html", ".htm", ".css", ".js", ".mjs", ".svg"}:
                continue
            try:
                text = path.read_text("utf-8")
            except Exception:
                continue
            # guess a base url
            rel = path.relative_to(SITE_DIR).as_posix()
            if rel == "index.html":
                base_url = BASE + "/"
            elif path.name == "index.html" and not rel.startswith("_cdn/"):
                base_url = BASE + "/" + str(path.parent.relative_to(SITE_DIR)).replace(os.sep, "/") + "/"
            else:
                # asset
                if rel.startswith("_cdn/"):
                    rest = rel[len("_cdn/") :]
                    host, _, apath = rest.partition("/")
                    base_url = f"https://{host}/{apath}"
                else:
                    base_url = BASE + "/"
            new = self.rewrite_urls(text, path, base_url)
            if new != text:
                path.write_text(new, encoding="utf-8")

    def write_readme(self) -> None:
        readme = OUT / "README.md"
        readme.write_text(
            f"""# Angela Li portfolio — local mirror

Offline copy of [liangela.com](https://www.liangela.com/), including password-protected case studies unlocked with the provided page password.

## Preview

```bash
cd site
python3 -m http.server 8765
```

Then open http://localhost:8765/

## Contents

- Public pages: home, about, work, archive, and case studies
- Password-protected pages:
  - `/locked-marketplace-internationalization`
  - `/locked-new-facebook`
- CSS, JS, fonts, images, and other assets under `site/_cdn/`

Re-run the mirror:

```bash
python3 mirror_site.py
```
""",
            encoding="utf-8",
        )

    def run(self) -> None:
        if SITE_DIR.exists():
            # clean previous site output but keep this script
            import shutil

            shutil.rmtree(SITE_DIR)
        SITE_DIR.mkdir(parents=True, exist_ok=True)

        print("Unlocking password-protected pages...")
        self.unlock_all()

        for path in SEED_PATHS:
            self.enqueue_page(BASE + path)

        print("Downloading pages...")
        self.download_pages()
        print(f"Pages saved: {len(self.seen_pages)}")

        print("Downloading assets...")
        self.download_assets()
        print(f"Assets saved: {len(self.url_to_local)}")

        self.rewrite_all()
        self.write_readme()

        # summary
        print("\nDone.")
        print(f"Output: {SITE_DIR}")
        if self.errors:
            print(f"Warnings/errors ({len(self.errors)}):")
            for e in self.errors[:40]:
                print(" -", e)


def unquote_path(path: str) -> str:
    return urllib.parse.unquote(path)


if __name__ == "__main__":
    Mirror().run()
