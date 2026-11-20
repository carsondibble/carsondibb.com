import html
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.carsondibb.com"
SITE_HOSTS = {"carsondibb.com", "www.carsondibb.com"}


def _rewrite_href(value, routes, current_route):
    parsed = urlsplit(html.unescape(value))
    if parsed.scheme and parsed.netloc.casefold() not in SITE_HOSTS:
        return value
    if parsed.netloc and parsed.netloc.casefold() not in SITE_HOSTS:
        return value

    if not parsed.path and parsed.fragment:
        destination = current_route
    else:
        filename = Path(parsed.path).name.casefold()
        destination = "/" if filename == "index.html" else routes.get(filename)
    if destination is None:
        return value

    rewritten = urlunsplit(
        (parsed.scheme, parsed.netloc, destination, parsed.query, parsed.fragment)
    )
    return html.escape(rewritten, quote=True)


def _rewrite_document(document, routes, current_route):
    def replace_href(match):
        value = _rewrite_href(match.group("value"), routes, current_route)
        return f'{match.group("prefix")}{match.group("quote")}{value}{match.group("quote")}'

    document = re.sub(
        r'(?P<prefix>\bhref\s*=\s*)(?P<quote>["\'])(?P<value>.*?)(?P=quote)',
        replace_href,
        document,
        flags=re.IGNORECASE,
    )
    for filename, route in routes.items():
        document = document.replace(f"{SITE}/{filename}", f"{SITE}{route}")
    document = document.replace(f"{SITE}/index.html", f"{SITE}/")

    if not re.search(r"<base\b", document, flags=re.IGNORECASE):
        document, count = re.subn(
            r"(<head\b[^>]*>)",
            r'\1\n    <base href="/" />',
            document,
            count=1,
            flags=re.IGNORECASE,
        )
        if count == 0:
            raise ValueError("Cannot add a root base URL: document has no <head> element.")
    return document


def _redirect_document(route):
    destination = html.escape(route, quote=True)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="canonical" href="{SITE}{destination}" />
    <meta http-equiv="refresh" content="0;url={destination}" />
    <title>Page moved</title>
  </head>
  <body>
    <p>This page has moved to <a href="{destination}">{destination}</a>.</p>
  </body>
</html>
"""


def build_pretty_urls(root=ROOT):
    root = Path(root)
    source_pages = {}
    for path in root.glob("*.html"):
        if path.name.casefold() in {"index.html", "404.html"}:
            continue
        document = path.read_text(encoding="utf-8")
        if re.search(r'<meta\s+http-equiv=["\']refresh["\']', document, flags=re.IGNORECASE):
            pretty_page = root / path.stem / "index.html"
            if pretty_page.is_file():
                document = pretty_page.read_text(encoding="utf-8")
        source_pages[path.name] = document
    routes = {filename.casefold(): f"/{Path(filename).stem}/" for filename in source_pages}

    for filename, document in source_pages.items():
        route = routes[filename.casefold()]
        output = root / Path(filename).stem / "index.html"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            _rewrite_document(document, routes, route),
            encoding="utf-8",
            newline="\n",
        )

    documents = [root / "index.html", root / "404.html"]
    documents.extend((root / "archive").rglob("*.html") if (root / "archive").exists() else [])
    for path in documents:
        if not path.is_file():
            continue
        if path.parent == root:
            route = "/"
        else:
            route = "/" + path.parent.relative_to(root).as_posix().strip("/") + "/"
        document = _rewrite_document(path.read_text(encoding="utf-8"), routes, route)
        if (
            path == root / "index.html"
            and 'window.location.pathname.toLowerCase() === "/index.html"' not in document
        ):
            document, count = re.subn(
                r"(<head\b[^>]*>)",
                r'\1\n    <script>if (window.location.pathname.toLowerCase() === "/index.html") window.location.replace("/" + window.location.search + window.location.hash);</script>',
                document,
                count=1,
                flags=re.IGNORECASE,
            )
            if count == 0:
                raise ValueError("Cannot add the homepage URL redirect: document has no <head> element.")
        path.write_text(document, encoding="utf-8", newline="\n")

    for filename, route in routes.items():
        (root / filename).write_text(
            _redirect_document(route),
            encoding="utf-8",
            newline="\n",
        )

    print(f"Generated {len(routes)} extension-free page routes.")


if __name__ == "__main__":
    build_pretty_urls()
