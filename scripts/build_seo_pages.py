import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.carsondibb.com"
PROJECTS_FILE = ROOT / "archive-projects.json"
SITEMAP_FILE = ROOT / "sitemap.xml"
STATIC_PAGES = [
    "/",
    "/gallery.html",
    "/about.html",
    "/contact.html",
    "/archive.html",
    "/sports-photography.html",
    "/event-photography.html",
    "/portrait-photography.html",
    "/concert-photography.html",
]


def escape(value):
    return html.escape(str(value), quote=True)


def json_ld(value):
    return json.dumps(value, ensure_ascii=True).replace("</", "<\\/")


def list_drive_images(folder_id, api_key):
    files = []
    page_token = ""
    while True:
        params = {
            "key": api_key,
            "q": f"'{folder_id}' in parents and trashed = false and mimeType contains 'image/'",
            "pageSize": "1000",
            "orderBy": "name",
            "fields": "nextPageToken,files(id,name,mimeType)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
        if page_token:
            params["pageToken"] = page_token
        url = "https://www.googleapis.com/drive/v3/files?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"Referer": f"{SITE}/"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.load(response)
        except (urllib.error.URLError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Unable to generate archive pages from Google Drive: {error}") from error
        files.extend(result.get("files", []))
        page_token = result.get("nextPageToken", "")
        if not page_token:
            return sorted(
                (file for file in files if file.get("id") and file.get("name")),
                key=lambda file: file["name"].casefold(),
            )


def thumbnail(file_id, size=1200):
    return (
        "https://drive.google.com/thumbnail?"
        + urllib.parse.urlencode({"id": file_id, "sz": f"w{size}"})
    )


def render_project(project, photos, api_key_available):
    title = project["title"]
    description = project["description"]
    project_url = f"{SITE}/archive/{project['slug']}/"
    cover_id = project.get("coverFileId", "")
    if photos:
        cover_id = photos[0]["id"]
    cover = thumbnail(cover_id) if cover_id else ""

    image_markup = []
    image_metadata = []
    for photo in photos:
        name = Path(photo["name"]).stem
        image_url = thumbnail(photo["id"])
        alt = f"{title} project photo: {name}, by Carson Dibb."
        image_markup.append(
            '<figure class="drive-photo">'
            f'<img src="{escape(image_url)}" alt="{escape(alt)}" loading="lazy" decoding="async" />'
            f"<figcaption>{escape(name)}</figcaption>"
            "</figure>"
        )
        image_metadata.append(
            {
                "@type": "ImageObject",
                "contentUrl": image_url,
                "name": name,
                "description": alt,
                "creator": {"@id": f"{SITE}/#carson-dibb"},
                "copyrightNotice": "© Carson Dibb",
                "isPartOf": {"@id": f"{SITE}/#website"},
            }
        )
    if not image_metadata and cover_id:
        image_metadata.append(
            {
                "@type": "ImageObject",
                "contentUrl": cover,
                "name": f"{title} project cover",
                "description": f"{title} project cover image by Carson Dibb.",
                "creator": {"@id": f"{SITE}/#carson-dibb"},
                "copyrightNotice": "© Carson Dibb",
                "isPartOf": {"@id": f"{SITE}/#website"},
            }
        )

    if not api_key_available:
        status = (
            '<p class="archive-status">Project preview. Full gallery photos will appear after '
            "the Google Drive API key is configured.</p>"
        )
    elif not photos:
        status = '<p class="archive-status">No public photos were found in this project.</p>'
    else:
        status = ""

    schema = {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "name": f"{title} | Carson Dibb Photography",
        "description": description,
        "url": project_url,
        "creator": {"@id": f"{SITE}/#carson-dibb"},
        "isPartOf": {"@id": f"{SITE}/#website"},
        "image": image_metadata,
    }

    cover_markup = (
        f'<img class="project-cover" src="{escape(cover)}" alt="{escape(title)} project cover, by Carson Dibb." />'
        if cover
        else ""
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="author" content="Carson Dibb" />
    <meta name="description" content="{escape(description)}" />
    <link rel="canonical" href="{escape(project_url)}" />
    <title>{escape(title)} Photography Project | Carson Dibb</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Carson Dibb Photography" />
    <meta property="og:url" content="{escape(project_url)}" />
    <meta property="og:title" content="{escape(title)} Photography Project | Carson Dibb" />
    <meta property="og:description" content="{escape(description)}" />
    {f'<meta property="og:image" content="{escape(cover)}" />' if cover else ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escape(title)} Photography Project | Carson Dibb" />
    <meta name="twitter:description" content="{escape(description)}" />
    {f'<meta name="twitter:image" content="{escape(cover)}" />' if cover else ""}
    <script type="application/ld+json">{json_ld(schema)}</script>
    <link rel="icon" type="image/png" href="../../favicon.png" />
    <link rel="stylesheet" href="../../archive.css" />
    <link rel="stylesheet" href="../../mobile.css" />
  </head>
  <body>
    <nav id="sidebar" aria-label="Main navigation">
      <a href="../../index.html" class="logo"><img class="sidebar-signature" src="../../Images/signature.svg" alt="" aria-hidden="true" /></a>
      <nav class="sidebar-links" aria-label="Main pages">
        <a href="../../gallery.html">Gallery</a>
        <a href="../../archive.html" aria-current="page">Archive</a>
        <a href="../../about.html">About Me</a>
        <a href="../../contact.html">Contact</a>
      </nav>
      <details class="mobile-navigation">
        <summary aria-label="Toggle site navigation">Menu</summary>
        <nav class="mobile-navigation-links" aria-label="Site">
          <a href="../../index.html">Home</a>
          <a href="../../gallery.html">Gallery</a>
          <a href="../../archive.html">Archive</a>
          <a href="../../about.html">About Me</a>
          <a href="../../contact.html">Contact</a>
        </nav>
      </details>
    </nav>
    <main class="archive-main">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="../../index.html">Home</a></li>
          <li><a href="../../archive.html">Archive</a></li>
          <li aria-current="page">{escape(title)}</li>
        </ol>
      </nav>
      <header class="archive-heading">
        <p class="archive-eyebrow">PHOTOGRAPHY PROJECT</p>
        <h1>{escape(title)}</h1>
        <p>{escape(description)}</p>
        {cover_markup}
      </header>
      {status}
      <section class="drive-gallery" aria-label="{escape(title)} project photos">
        {"".join(image_markup)}
      </section>
      <a class="archive-back-link" href="../../archive.html">← All projects</a>
      <a class="archive-back-link" href="../../contact.html">Contact Carson Dibb about a photography project</a>
    </main>
  </body>
</html>
"""


def render_sitemap(urls):
    entries = "\n".join(f"  <url><loc>{escape(SITE + url)}</loc></url>" for url in urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>\n"
    )


def main():
    projects = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    if not isinstance(projects, list):
        raise ValueError("archive-projects.json must contain a list of projects.")

    api_key = os.environ.get("GOOGLE_DRIVE_API_KEY", "").strip()
    sitemap_urls = list(STATIC_PAGES)
    for project in projects:
        slug = project.get("slug", "")
        if not re.fullmatch(r"[a-z0-9-]+", slug):
            raise ValueError(f"Invalid public project slug: {slug!r}")
        if project.get("access") != "public":
            continue
        title = project.get("title", "").strip()
        description = project.get("description", "").strip()
        if not title or not description:
            raise ValueError(f"Public project {slug!r} must have a title and description.")

        match = re.search(
            r"/drive/folders/([a-zA-Z0-9_-]+)",
            project.get("folderUrl", ""),
        )
        if not match:
            raise ValueError(f"Public project {slug!r} has an invalid Google Drive folder URL.")
        photos = list_drive_images(match.group(1), api_key) if api_key else []
        output = ROOT / "archive" / slug / "index.html"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            render_project(project, photos, bool(api_key)),
            encoding="utf-8",
            newline="\n",
        )
        sitemap_urls.append(f"/archive/{slug}/")

    SITEMAP_FILE.write_text(
        render_sitemap(sitemap_urls),
        encoding="utf-8",
        newline="\n",
    )
    print(f"Generated {len(sitemap_urls) - len(STATIC_PAGES)} project pages and updated sitemap.xml.")
    if not api_key:
        print("GOOGLE_DRIVE_API_KEY is unset; generated project pages contain their public cover only.")


if __name__ == "__main__":
    main()
