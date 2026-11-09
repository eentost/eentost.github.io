#!/usr/bin/env python3
"""Add deterministic SEO metadata to the generated Claudeball static entry page."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://eentost.github.io/baseball/"
OG_IMAGE = "https://eentost.github.io/assets/og-site.png"
TITLE = "Claudeball | 3D Baseball Simulation"
DESCRIPTION = (
    "Watch a detailed 3D baseball simulation in your browser, with pitch-by-pitch play, "
    "fielding, baserunning, score tracking and a broadcast-style presentation."
)

TAG_RE = re.compile(r"<(?P<tag>meta|link|script)\b[^>]*>", re.IGNORECASE)
ATTR_RE = re.compile(r"""\b([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2""", re.DOTALL)


def attrs(tag: str) -> dict[str, str]:
    return {m.group(1).lower(): m.group(3) for m in ATTR_RE.finditer(tag)}


def remove_managed_tags(source: str) -> str:
    pieces: list[str] = []
    cursor = 0
    for match in TAG_RE.finditer(source):
        tag = match.group(0)
        a = attrs(tag)
        kind = match.group("tag").lower()
        remove = False
        if kind == "link" and a.get("rel", "").lower() == "canonical":
            remove = True
        elif kind == "meta":
            key = a.get("property", "").lower()
            name = a.get("name", "").lower()
            remove = key.startswith("og:") or name.startswith("twitter:") or name == "description"
        elif kind == "script" and a.get("type", "").lower() == "application/ld+json":
            end = re.search(r"</script\s*>", source[match.end():], re.IGNORECASE)
            if end:
                end_at = match.end() + end.end()
                pieces.append(source[cursor:match.start()])
                cursor = end_at
                continue
        if remove:
            pieces.append(source[cursor:match.start()])
            cursor = match.end()
    pieces.append(source[cursor:])
    cleaned = "".join(pieces)
    cleaned = re.sub(r"<title\b[^>]*>.*?</title\s*>", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    return cleaned


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: prepare_claudeball_seo.py <generated-index.html>", file=sys.stderr)
        return 2

    target = Path(sys.argv[1]).resolve()
    if not target.is_file():
        print(f"FAIL: generated HTML not found: {target}", file=sys.stderr)
        return 1
    image_file = ROOT / "assets" / "og-site.png"
    if not image_file.is_file():
        print(f"FAIL: Open Graph image not found: {image_file}", file=sys.stderr)
        return 1

    source = target.read_text(encoding="utf-8")
    if not re.search(r"</head\s*>", source, re.IGNORECASE):
        print("FAIL: generated HTML has no closing </head>", file=sys.stderr)
        return 1

    source = remove_managed_tags(source)
    structured_data = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": "Claudeball",
        "url": BASE_URL,
        "description": DESCRIPTION,
        "gamePlatform": "Web browser",
        "applicationCategory": "GameApplication",
        "genre": "Sports",
        "inLanguage": "en",
    }
    block = "\n".join(
        [
            f'<title>{TITLE}</title>',
            f'<meta name="description" content="{DESCRIPTION}">',
            f'<link rel="canonical" href="{BASE_URL}">',
            '<meta property="og:type" content="website">',
            f'<meta property="og:title" content="{TITLE}">',
            f'<meta property="og:description" content="{DESCRIPTION}">',
            f'<meta property="og:url" content="{BASE_URL}">',
            f'<meta property="og:image" content="{OG_IMAGE}">',
            '<meta property="og:image:alt" content="Claudeball 3D baseball simulation">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{TITLE}">',
            f'<meta name="twitter:description" content="{DESCRIPTION}">',
            f'<meta name="twitter:image" content="{OG_IMAGE}">',
            '<script type="application/ld+json">'
            + json.dumps(structured_data, ensure_ascii=False, separators=(",", ":"))
            + "</script>",
        ]
    )
    source = re.sub(r"</head\s*>", block + "\n</head>", source, count=1, flags=re.IGNORECASE)
    target.write_text(source, encoding="utf-8")
    print(f"PASS: SEO metadata added to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
