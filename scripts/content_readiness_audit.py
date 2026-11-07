#!/usr/bin/env python3
"""Static content/policy readiness checks. Does not certify AdSense approval."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE = {"404.html"}
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.headings = []
        self.in_h1 = False
        self.title = False
        self.titles = []
        self.meta = {}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if tag == "h1": self.in_h1 = True
        if tag == "title": self.title = True
        if tag == "meta":
            key = a.get("name")
            if key: self.meta[key.lower()] = a.get("content", "")
    def handle_endtag(self, tag):
        if tag == "h1": self.in_h1 = False
        if tag == "title": self.title = False
    def handle_data(self, data):
        if self.in_h1: self.headings.append(data.strip())
        if self.title: self.titles.append(data.strip())

def main():
    pages = sorted(p for p in ROOT.rglob("*.html") if not any(x.startswith(".") or x in {"node_modules", "coverage", "test-results"} for x in p.relative_to(ROOT).parts))
    errors, warnings = [], []
    for path in pages:
        rel = path.relative_to(ROOT).as_posix()
        parser = Page()
        parser.feed(path.read_text(encoding="utf-8"))
        if rel not in EXCLUDE:
            if not "".join(parser.titles).strip(): errors.append(f"{rel}: missing title")
            if not "".join(parser.headings).strip(): errors.append(f"{rel}: missing h1")
            if not parser.meta.get("description"): errors.append(f"{rel}: missing description")
        for href in parser.links:
            url = urlsplit(href)
            if url.scheme or url.netloc or href.startswith(("#", "//", "mailto:", "tel:", "javascript:")): continue
            if not url.path: continue
            dest = (ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/") else (path.parent / unquote(url.path))
            if dest.is_dir(): dest = dest / "index.html"
            elif not dest.suffix: dest = dest / "index.html"
            if not dest.is_file(): errors.append(f"{rel}: broken local link {href}")
        if rel not in EXCLUDE and len("".join(parser.headings).strip()) < 5: warnings.append(f"{rel}: short heading")
    for issue in errors: print("FAIL:", issue)
    for issue in warnings: print("WARN:", issue)
    print(f"CHECKED: {len(pages)} HTML pages, {len(errors)} broken metadata/link checks, {len(warnings)} warnings")
    print("NOTE: manual content originality, browser E2E, privacy/CMP and Google review remain necessary.")
    return int(bool(errors))
if __name__ == "__main__": sys.exit(main())
