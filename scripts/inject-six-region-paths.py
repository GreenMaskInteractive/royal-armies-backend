"""Extract Region1-6 SVG paths into dual-layer overlay (visual + hit-test) in game.html."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"
GAME = ROOT / "public" / "game.html"
OUT_FRAGMENT = ROOT / "public" / "data" / "game-region-paths-extract.html"


def _load_season_0_assets_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "season_0_city_assets", ROOT / "scripts" / "season-0-city-assets.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _region_files() -> list[tuple[int, Path]]:
    season_0 = _load_season_0_assets_module()
    files: list[tuple[int, Path]] = []
    for _rid, _slug, _nations, region_num in season_0.REGION_REGISTRY:
        svg_path = season_0.resolve_region_map_svg(region_num)
        if svg_path and svg_path.is_file():
            files.append((region_num, svg_path))
            continue
        legacy = IMAGES / f"Region{region_num}map.svg"
        if legacy.is_file():
            files.append((region_num, legacy))
    return files


REGION_FILES = _region_files()  # legacy alias for tooling


REGION_SECTION = """        <section class="game-page-view game-page-view--region" data-game-view="region" aria-label="Choose a Region" hidden>
            <div id="game-region-map" class="game-region-map">
                <div class="game-region-map-stage" role="application" aria-label="Amnek world map — choose a region">
                    <div class="game-region-map-frame">
                        <img
                            class="game-region-map-bg"
                            src="images/amnekmap.png"
                            alt=""
                            width="1642"
                            height="1642"
                            decoding="async"
                            draggable="false"
                        >
                        <svg
                            id="game-region-map-svg"
                            class="game-region-map-overlay"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 1642 1642"
                            preserveAspectRatio="xMidYMid meet"
                            aria-hidden="true"
                            focusable="false"
                        >
                        <g id="game-region-map-visual" class="game-region-map-layer game-region-map-layer--visual">
{visual_paths}
                        </g>
                        <g id="game-region-map-hit" class="game-region-map-layer game-region-map-layer--hit" aria-hidden="true">
{hit_paths}
                        </g>
                        </svg>
                    </div>
                </div>
                <p id="game-region-map-selection" class="game-region-map-selection" hidden></p>
            </div>
            <button
                type="button"
                class="portal-rejoin-age-btn confirm-btn game-region-skip-btn"
                onclick="advanceGameOnboarding()">
                Continue
            </button>
        </section>

"""


def parse_paths(svg_text: str) -> list[tuple[str, str]]:
    blocks = re.findall(r"<path\s+([^>]*?)\s*/>", svg_text, re.S | re.I)
    out: list[tuple[str, str]] = []
    for attrs in blocks:
        dm = re.search(r'\sd="([\s\S]*?)"', attrs, re.I)
        if not dm:
            continue
        other = re.sub(r'\s+d="[\s\S]*?"', "", attrs, count=1, flags=re.I).strip()
        out.append((other, dm.group(1)))
    return out


def format_visual_path(region_num: int, path_index: int, other_attrs: str, d: str) -> str:
    region_id = f"region-{region_num}"
    lines = [
        "                            <path",
        f'                                id="game-region-visual-{region_num}-{path_index}"',
        f'                                class="game-region-zone game-region-visual region-{region_num}-path"',
        f'                                data-region-id="{region_id}"',
        f'                                data-path-index="{path_index}"',
    ]
    if other_attrs:
        for piece in re.split(r"\s+(?=\w)", other_attrs.strip()):
            if piece.startswith('class="'):
                continue
            lines.append(f"                                {piece}")
    lines.append(f'                                d="{d}"')
    lines.append("                            />")
    return "\n".join(lines)


def format_hit_path(region_num: int, path_index: int, other_attrs: str, d: str) -> str:
    region_id = f"region-{region_num}"
    lines = [
        "                            <path",
        f'                                id="game-region-hit-{region_num}-{path_index}"',
        f'                                class="game-region-hit region-{region_num}-path"',
        f'                                data-region-id="{region_id}"',
        f'                                data-path-index="{path_index}"',
        f'                                data-visual-target="game-region-visual-{region_num}-{path_index}"',
    ]
    if other_attrs:
        for piece in re.split(r"\s+(?=\w)", other_attrs.strip()):
            if piece.startswith('class="') or piece.startswith('fill="'):
                continue
            lines.append(f"                                {piece}")
    lines.append(f'                                d="{d}"')
    lines.append("                            />")
    return "\n".join(lines)


def build_layers() -> tuple[str, str]:
    visual_lines: list[str] = []
    hit_lines: list[str] = []
    totals: list[tuple[int, int]] = []

    for num, svg_path in _region_files():
        if not svg_path.is_file():
            raise SystemExit(f"Missing SVG: {svg_path}")
        paths = parse_paths(svg_path.read_text(encoding="utf-8", errors="replace"))
        totals.append((num, len(paths)))
        for path_index, (attrs, d) in enumerate(paths):
            visual_lines.append(format_visual_path(num, path_index, attrs, d))
            hit_lines.append(format_hit_path(num, path_index, attrs, d))

    print("Path counts:")
    for num, count in totals:
        print(f"  Region{num}map.svg: {count} paths")
    print(f"  Total: {sum(c for _, c in totals)} path pairs")
    return "\n".join(visual_lines), "\n".join(hit_lines)


def main() -> None:
    visual_paths, hit_paths = build_layers()
    fragment = (
        f"                        <g id=\"game-region-map-visual\" class=\"game-region-map-layer game-region-map-layer--visual\">\n"
        f"{visual_paths}\n"
        f"                        </g>\n"
        f"                        <g id=\"game-region-map-hit\" class=\"game-region-map-layer game-region-map-layer--hit\" aria-hidden=\"true\">\n"
        f"{hit_paths}\n"
        f"                        </g>"
    )
    OUT_FRAGMENT.parent.mkdir(parents=True, exist_ok=True)
    OUT_FRAGMENT.write_text(fragment + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FRAGMENT}")

    html = GAME.read_text(encoding="utf-8")
    pattern = (
        r'        <section class="game-page-view game-page-view--region".*?'
        r'</section>\n\n        <section class="game-page-view game-page-view--nation"'
    )
    region_section = REGION_SECTION.format(visual_paths=visual_paths, hit_paths=hit_paths)
    replacement = region_section + '        <section class="game-page-view game-page-view--nation"'
    new_html, n = re.subn(pattern, replacement, html, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"Could not replace region section (n={n})")

    if "game-regions-map.js" not in new_html:
        new_html = new_html.replace(
            "    <script src=\"game-class-picker.js?v=game-class-archmage-match-bm-h-1\"></script>\n",
            "    <script src=\"game-class-picker.js?v=game-class-archmage-match-bm-h-1\"></script>\n"
            "    <script src=\"game-regions-map.js?v=game-region-map-11\"></script>\n",
        )
    else:
        new_html = re.sub(
            r'game-regions-map\.js\?v=[^"]+',
            "game-regions-map.js?v=game-region-map-11",
            new_html,
            count=1,
        )

    new_html = re.sub(
        r'style2\.css\?v=[^"]+',
        "style2.css?v=game-region-map-11",
        new_html,
        count=1,
    )

    GAME.write_text(new_html, encoding="utf-8")
    print(f"Updated {GAME}")


if __name__ == "__main__":
    main()
