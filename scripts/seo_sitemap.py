#!/usr/bin/env python3
"""Maintain static GitHub Pages SEO sitemap; no external services or dependencies."""
import argparse
import json
import re
import subprocess
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://eentost.github.io/"
SITEMAP = ROOT / "sitemap.xml"
EXCLUDED = {"404.html"}

class SEOParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.meta = {}
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            if key:
                self.meta[key.lower()] = attrs.get("content", "")
        elif tag == "link":
            self.links.append(attrs)
    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
    def handle_data(self, data):
        if self._in_title:
            self.title += data

def page_url(path):
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return BASE
    if rel.endswith("/index.html"):
        return BASE + rel[:-10]
    return BASE + rel

def pages():
    for path in sorted(ROOT.rglob("*.html")):
        if any(part.startswith(".") or part in {"node_modules", "test-results", "coverage"} for part in path.relative_to(ROOT).parts):
            continue
        if path.relative_to(ROOT).as_posix() not in EXCLUDED:
            yield path

def parse_page(path):
    source = path.read_text(encoding="utf-8")
    parsed = SEOParser()
    parsed.feed(source)
    return source, parsed

def should_index(parsed):
    return "noindex" not in parsed.meta.get("robots", "").lower().split(",")

def last_modified(path):
    try:
        completed = subprocess.run(
            ["git", "-C", str(ROOT), "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
            capture_output=True, text=True, check=True, timeout=10
        )
        when = completed.stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", when):
            return when
    except (FileNotFoundError, subprocess.SubprocessError):
        pass
    return date.today().isoformat()

def listed_pages():
    return [(path, parsed) for path in pages() for _, parsed in [parse_page(path)] if should_index(parsed)]

def render_sitemap():
    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", ns)
    root = ET.Element(f"{{{ns}}}urlset")
    for path, _ in listed_pages():
        entry = ET.SubElement(root, f"{{{ns}}}url")
        ET.SubElement(entry, f"{{{ns}}}loc").text = page_url(path)
        ET.SubElement(entry, f"{{{ns}}}lastmod").text = last_modified(path)
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"

def validate():
    errors = []
    seen = set()
    for path, parsed in listed_pages():
        url = page_url(path)
        relative = path.relative_to(ROOT).as_posix()
        canonical = [link.get("href", "") for link in parsed.links if link.get("rel", "").lower() == "canonical"]
        if len(canonical) != 1 or canonical[0] != url:
            errors.append(f"{relative}: incorrect or duplicate canonical: {canonical}")
        if url in seen:
            errors.append(f"{relative}: duplicated URL {url}")
        seen.add(url)
        if not parsed.title.strip():
            errors.append(f"{relative}: missing title")
        if not parsed.meta.get("description"):
            errors.append(f"{relative}: missing description")
        if not parsed.meta.get("og:title") or not parsed.meta.get("og:description"):
            errors.append(f"{relative}: missing OG title or description")
        if parsed.meta.get("og:url") != url:
            errors.append(f"{relative}: incorrect OG URL")
        image = parsed.meta.get("og:image", "")
        if not image.startswith(BASE):
            errors.append(f"{relative}: invalid OG image URL")
        elif not (ROOT / urlparse(image).path.lstrip("/")).is_file():
            errors.append(f"{relative}: OG image file missing: {image}")
        if not parsed.meta.get("twitter:card"):
            errors.append(f"{relative}: missing Twitter card")
        source = path.read_text(encoding="utf-8")
        schemas = re.findall(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', source, re.I | re.S)
        if not schemas:
            errors.append(f"{relative}: missing JSON-LD")
        for block in schemas:
            try:
                value = json.loads(block)
                if not isinstance(value, (dict, list)):
                    errors.append(f"{relative}: JSON-LD is not an object/list")
            except json.JSONDecodeError as exc:
                errors.append(f"{relative}: invalid JSON-LD: {exc}")
    if errors:
        print("\n".join("FAIL: " + error for error in errors), file=sys.stderr)
        return 1
    print(f"PASS: {len(seen)} indexable HTML pages have required SEO metadata and valid JSON-LD")
    return 0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()
    if args.validate and validate():
        return 1
    expected = render_sitemap()
    if args.write:
        SITEMAP.write_text(expected, encoding="utf-8")
        print(f"Updated sitemap.xml: {len(listed_pages())} URLs")
    if args.check:
        if not SITEMAP.is_file() or SITEMAP.read_text(encoding="utf-8") != expected:
            print("FAIL: sitemap.xml is outdated; run python3 scripts/seo_sitemap.py --write", file=sys.stderr)
            return 1
        print("PASS: sitemap.xml matches source HTML pages and git history")
    return 0

if __name__ == "__main__":
    sys.exit(main())
