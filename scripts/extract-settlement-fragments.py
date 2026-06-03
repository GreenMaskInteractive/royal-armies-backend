from pathlib import Path

repo = Path(__file__).resolve().parents[1]
root = repo / "public"
out = repo / "scripts"
text = (root / "agealpha.html").read_text(encoding="utf-8")
start = text.index('<div id="age-barracks-workspace"')
end = text.index('<div id="age-dispatch-alert-border"')
workspaces = text[start:end].strip()
fstart = text.index('<footer class="age-map-hud age-map-hud--bottom')
fend = text.index("    </main>", fstart)
footer = text[fstart:fend].strip()
(out / "_settlement-workspaces.fragment.html").write_text(workspaces, encoding="utf-8")
(out / "_settlement-footer.fragment.html").write_text(footer, encoding="utf-8")
print("ok", len(workspaces), len(footer))
