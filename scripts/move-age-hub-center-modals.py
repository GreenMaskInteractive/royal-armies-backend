#!/usr/bin/env python3
"""Move Council Room and Records into centered modals after </main> (War Room pattern)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "public" / "agealpha.html"
text = HTML.read_text(encoding="utf-8")

COUNCIL_START = '<div id="age-council-room-workspace"'
DISPATCH_START = '<div id="age-hq-dispatch-panel"'
RECORDS_START = '<div id="age-records-workspace"'
BARRACKS_START = '<div id="age-barracks-workspace"'
DISPATCH_ALERT_START = '<div id="age-dispatch-alert-border"'
MAIN_END = "    </main>"


def extract_block(source: str, start_marker: str, end_marker: str) -> tuple[str, str]:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    block = source[start:end]
    remainder = source[:start] + source[end:]
    return block, remainder


def wrap_council(block: str, dispatch: str) -> str:
    close_btn = (
        '                <button type="button" id="age-council-room-close" '
        'class="age-age-center-modal-close" aria-label="Close Council Room">×</button>\n'
    )
    header_close = block.replace(
        '                    <p id="age-hq-load-status"',
        f'{close_btn}                    <p id="age-hq-load-status"',
        1,
    )
    return (
        '    <div\n'
        '        id="age-council-room-modal"\n'
        '        class="age-age-center-modal age-council-room-modal"\n'
        '        hidden\n'
        '        aria-hidden="true"\n'
        '        role="dialog"\n'
        '        aria-modal="true"\n'
        '        aria-labelledby="age-council-room-title">\n'
        '        <div id="age-council-room-backdrop" class="age-age-center-modal-backdrop" aria-hidden="true"></div>\n'
        '        <div class="age-age-center-modal-dialog age-council-room-dialog">\n'
        f'{header_close}\n'
        f'{dispatch}\n'
        '        </div>\n'
        '    </div>\n\n'
    )


def wrap_records(block: str) -> str:
    close_btn = (
        '                    <button type="button" id="age-records-close" '
        'class="age-age-center-modal-close" aria-label="Close Records">×</button>\n'
    )
    block = block.replace(
        '                <header class="age-records-page-header"',
        f'{close_btn}                <header class="age-records-page-header"',
        1,
    )
    return (
        '    <div\n'
        '        id="age-records-modal"\n'
        '        class="age-age-center-modal age-records-modal"\n'
        '        hidden\n'
        '        aria-hidden="true"\n'
        '        role="dialog"\n'
        '        aria-modal="true"\n'
        '        aria-labelledby="age-records-page-title">\n'
        '        <div id="age-records-backdrop" class="age-age-center-modal-backdrop" aria-hidden="true"></div>\n'
        '        <div class="age-age-center-modal-dialog age-records-dialog">\n'
        f'{block}\n'
        '        </div>\n'
        '    </div>\n\n'
    )


def patch_nation_hub(menu: str) -> str:
    old_tabs = (
        '                                    <div class="age-map-view-tabs age-nation-hub-view-tabs" role="tablist" aria-label="View mode">\n'
        '                                        <button type="button" class="age-map-view-tab age-nation-hub-menu-item is-active" data-age-view-tab="map" role="tab" aria-selected="true">Map</button>\n'
        '                                        <button type="button" id="age-map-view-tab-city" class="age-map-view-tab age-nation-hub-menu-item" data-age-view-tab="city" role="tab" aria-selected="false" tabindex="-1">City</button>\n'
        '                                        <button type="button" class="age-map-view-tab age-nation-hub-menu-item" data-age-view-tab="council-room" role="tab" aria-selected="false" tabindex="-1">Council Room</button>\n'
        '                                        <button type="button" class="age-map-view-tab age-nation-hub-menu-item" data-age-view-tab="records" role="tab" aria-selected="false" tabindex="-1">Records</button>\n'
        '                                    </div>\n'
        '                                    <button\n'
        '                                        type="button"\n'
        '                                        id="age-war-room-open"\n'
        '                                        class="age-nation-hub-menu-item age-nation-hub-menu-item--war-room"\n'
        '                                        role="menuitem">\n'
        '                                        War Room\n'
        '                                    </button>\n'
    )
    new_tabs = (
        '                                    <div class="age-map-view-tabs age-nation-hub-view-tabs" role="tablist" aria-label="View mode">\n'
        '                                        <button type="button" class="age-map-view-tab age-nation-hub-menu-item is-active" data-age-view-tab="map" role="tab" aria-selected="true">Map</button>\n'
        '                                        <button type="button" id="age-map-view-tab-city" class="age-map-view-tab age-nation-hub-menu-item" data-age-view-tab="city" role="tab" aria-selected="false" tabindex="-1">City</button>\n'
        '                                    </div>\n'
        '                                    <button\n'
        '                                        type="button"\n'
        '                                        id="age-council-room-open"\n'
        '                                        class="age-nation-hub-menu-item age-nation-hub-menu-item--council-room"\n'
        '                                        role="menuitem">\n'
        '                                        Council Room\n'
        '                                    </button>\n'
        '                                    <button\n'
        '                                        type="button"\n'
        '                                        id="age-records-open"\n'
        '                                        class="age-nation-hub-menu-item age-nation-hub-menu-item--records"\n'
        '                                        role="menuitem">\n'
        '                                        Records\n'
        '                                    </button>\n'
        '                                    <button\n'
        '                                        type="button"\n'
        '                                        id="age-war-room-open"\n'
        '                                        class="age-nation-hub-menu-item age-nation-hub-menu-item--war-room"\n'
        '                                        role="menuitem">\n'
        '                                        War Room\n'
        '                                    </button>\n'
    )
    if old_tabs not in menu:
        raise SystemExit("Nation Hub menu block not found")
    return menu.replace(old_tabs, new_tabs, 1)


# Remove bottom-up so indices stay valid
records_block, text = extract_block(text, RECORDS_START, DISPATCH_ALERT_START)
dispatch_block, text = extract_block(text, DISPATCH_START, BARRACKS_START)
council_block, text = extract_block(text, COUNCIL_START, BARRACKS_START)

text = patch_nation_hub(text)

modals = wrap_council(council_block, dispatch_block) + wrap_records(records_block)
if MAIN_END not in text:
    raise SystemExit("</main> not found")
text = text.replace(MAIN_END, f"{MAIN_END}\n\n{modals}", 1)

HTML.write_text(text, encoding="utf-8")
print("Updated", HTML)
