import tempfile
import unittest
from pathlib import Path

from build_pretty_urls import build_pretty_urls


class BuildPrettyUrlsTests(unittest.TestCase):
    def test_builds_routes_updates_links_and_preserves_old_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<html><head><title>Home</title></head><body><a href="about.html">About</a></body></html>',
                encoding="utf-8",
            )
            (root / "about.html").write_text(
                '<html><head><link rel="canonical" href="https://www.carsondibb.com/about.html">'
                '<link rel="stylesheet" href="/assets/css/about.css"></head><body>'
                '<a href="gallery.html?from=about#photos">Gallery</a>'
                '<a href="#top">Top</a></body></html>',
                encoding="utf-8",
            )
            (root / "gallery.html").write_text(
                '<html><head><title>Gallery</title></head><body></body></html>',
                encoding="utf-8",
            )

            build_pretty_urls(root)

            about = (root / "about" / "index.html").read_text(encoding="utf-8")
            self.assertIn('<base href="/" />', about)
            self.assertIn('href="https://www.carsondibb.com/about/"', about)
            self.assertIn('href="/gallery/?from=about#photos"', about)
            self.assertIn('href="/about/#top"', about)
            self.assertIn('href="/assets/css/about.css"', about)
            homepage = (root / "index.html").read_text(encoding="utf-8")
            self.assertIn('href="/about/"', homepage)
            self.assertIn('window.location.pathname.toLowerCase() === "/index.html"', homepage)
            self.assertIn(
                'content="0;url=/about/"',
                (root / "about.html").read_text(encoding="utf-8"),
            )

            build_pretty_urls(root)
            self.assertIn(
                'href="/gallery/?from=about#photos"',
                (root / "about" / "index.html").read_text(encoding="utf-8"),
            )
            homepage = (root / "index.html").read_text(encoding="utf-8")
            self.assertEqual(
                1,
                homepage.count('window.location.pathname.toLowerCase() === "/index.html"'),
            )

    def test_updates_pretty_project_page_navigation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "archive" / "project"
            archive.mkdir(parents=True)
            (root / "index.html").write_text(
                "<html><head></head><body></body></html>",
                encoding="utf-8",
            )
            (root / "about.html").write_text(
                "<html><head></head><body></body></html>",
                encoding="utf-8",
            )
            (root / "404.html").write_text(
                "<html><head></head><body></body></html>",
                encoding="utf-8",
            )
            (archive / "index.html").write_text(
                '<html><head><link rel="stylesheet" href="/assets/css/archive.css"></head>'
                '<body><a href="../../about.html">About</a></body></html>',
                encoding="utf-8",
            )

            build_pretty_urls(root)

            project = (archive / "index.html").read_text(encoding="utf-8")
            self.assertIn('href="/about/"', project)
            self.assertIn('<base href="/" />', project)
            self.assertIn('href="/assets/css/archive.css"', project)


if __name__ == "__main__":
    unittest.main()
