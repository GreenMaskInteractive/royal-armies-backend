"""Strip agealpha.html to map-only scripts and remove inline handlers."""
from pathlib import Path
import re

repo = Path(__file__).resolve().parents[1]
path = repo / "public" / "agealpha.html"
text = path.read_text(encoding="utf-8")

text = text.replace(
    '<body id="age-page-canvas" class="age-page-canvas game-page-canvas" data-age-slug="alpha">',
    '<body id="age-page-canvas" class="age-page-canvas game-page-canvas age-map-shell-only"'
    ' data-age-slug="alpha" data-age-map-only="true" data-age-view="map">',
)

text = text.replace(
    '<script src="page-route-transition.js?v=route-fade-1"></script>\n',
    '',
)

if "style-age-map-only.css" not in text:
    text = text.replace(
        '    <link rel="stylesheet" href="custom-cursor.css?v=finger-press-7">\n</head>',
        '    <link rel="stylesheet" href="custom-cursor.css?v=finger-press-7">\n'
        '    <link rel="stylesheet" href="style-age-map-only.css?v=age-map-only-1">\n</head>',
    )

text = re.sub(r'\s+onclick="[^"]*"', '', text)

scripts = """
    <script src="dev-environment.js"></script>
    <script src="age-world-water-routes.js?v=age-map-only-1"></script>
    <script src="rift-player-loc-pins.js?v=age-map-only-1"></script>
    <script src="age-world-map.js?v=age-map-only-1"></script>
    <script src="rift-age-movement.js?v=age-map-only-1"></script>
    <script src="age-movement-panel.js?v=age-map-only-1"></script>
    <script src="age-world-plan-overlay.js?v=age-map-only-1"></script>
    <script src="age-map-only-page.js?v=age-map-only-1"></script>
"""

marker = '    <script src="rift-confirm-buttons.js'
if marker in text:
    start = text.index(marker)
    end = text.rindex('</body>')
    text = text[:start] + scripts + '\n' + text[end:]
else:
    raise SystemExit('script block marker not found')

path.write_text(text, encoding="utf-8")
print('updated', path.name, 'bytes', path.stat().st_size)
