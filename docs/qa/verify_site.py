"""Check the generated Jekyll site; run after building into _site.

Uses only the Python standard library. Reports real generated links, XML,
language and advertising behavior, not the template implementation.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote, urljoin
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / '_site'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.scripts = set(), [], []
        self.lang = None
        self.h1 = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'h1':
            self.h1 += 1

def main():
    assert (BUILD / 'index.html').exists(), 'Build the site first'
    pages = {path: Page(path.read_text(encoding='utf-8')) for path in BUILD.rglob('*.html')}
    errors = []
    for path, page in pages.items():
        if path.relative_to(BUILD).parts[0] in ('toy', 'aim-practice'):
            continue
        relative = path.relative_to(BUILD).as_posix()
        if page.lang != 'ko':
            errors.append(f'{relative}: expected Korean document language, got {page.lang}')
        if page.h1 != 1:
            errors.append(f'{relative}: expected one main heading, got {page.h1}')
        base = 'https://eentost.github.io/' + relative
        for href in page.links:
            link = urlsplit(urljoin(base, href))
            if link.scheme not in ('http', 'https') or link.netloc != 'eentost.github.io':
                continue
            dest = BUILD / unquote(link.path).lstrip('/')
            if dest.is_dir():
                dest /= 'index.html'
            if not dest.exists():
                errors.append(f'{relative}: missing link {href}')
            elif link.fragment and dest in pages and unquote(link.fragment) not in pages[dest].ids:
                errors.append(f'{relative}: missing fragment {href}')
    for relative in ['404.html', 'privacy/index.html', 'contact/index.html',
                     'privacy-policy/index.html', 'terms/index.html']:
        page = pages.get(BUILD / relative)
        if not page:
            errors.append(f'missing utility page {relative}')
        elif any('adsbygoogle.js' in s for s in page.scripts):
            errors.append(f'{relative}: advertising script on utility/error page')
    for name in ['feed.xml', 'sitemap.xml']:
        try:
            ET.parse(BUILD / name)
        except (ET.ParseError, FileNotFoundError) as exc:
            errors.append(f'{name}: {exc}')
    sitemap = ET.parse(BUILD / 'sitemap.xml')
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    for entry in sitemap.findall('s:url', ns):
        loc = entry.findtext('s:loc', namespaces=ns)
        lastmod = entry.findtext('s:lastmod', default='', namespaces=ns)
        if loc and '/2026/' in loc and '.html' in loc and not lastmod.startswith('2026-09-23'):
            errors.append(f'stale revision date: {loc} {lastmod}')
    if errors:
        print('\n'.join(sorted(set(errors))))
        print(f'FAIL: {len(set(errors))} generated-site checks')
        return 1
    print(f'PASS: {len(pages)} HTML pages; local links/fragments, language, headings, utility ad exclusions, XML and revision dates')
    return 0

if __name__ == '__main__':
    sys.exit(main())
