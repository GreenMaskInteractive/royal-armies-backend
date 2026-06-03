from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
html_path = ROOT / "agealpha.html"
frag_path = ROOT / "_hq-workspace-fragment.html"
css_path = ROOT / "style-age-headquarters.css"

html = html_path.read_text(encoding="utf-8")
frag = frag_path.read_text(encoding="utf-8")
start = html.index('<div id="age-headquarters-workspace"')
end = html.index('<div id="age-barracks-workspace"')
html_path.write_text(html[:start] + frag + "\n\n            " + html[end:], encoding="utf-8")

css = css_path.read_text(encoding="utf-8")
if "Headquarters nation leadership" in css and "—" not in css.split("\n")[1]:
    lines = css.splitlines()
    lines[1] = "/* Age — Headquarters nation leadership workspace */"
    css = "\n".join(lines) + ("\n" if css.endswith("\n") else "")
    css_path.write_text(css, encoding="utf-8")

print("patched agealpha HQ block", start, end)
