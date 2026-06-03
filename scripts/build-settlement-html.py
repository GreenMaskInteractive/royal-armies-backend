from pathlib import Path

repo = Path(__file__).resolve().parents[1]
public = repo / "public"
workspaces = (repo / "scripts/_settlement-workspaces.fragment.html").read_text(encoding="utf-8")
footer = (repo / "scripts/_settlement-footer.fragment.html").read_text(encoding="utf-8")

head = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Royal Armies — Settlement</title>
    <link rel="stylesheet" href="style.css?v=cursor-modal-layer-fix-1">
    <link rel="stylesheet" href="style2.css?v=settlement-page-1">
    <link rel="stylesheet" href="style-settlement.css?v=settlement-page-1">
    <link rel="stylesheet" href="mobile-responsive.css?v=settlement-page-1">
    <link rel="stylesheet" href="dev-page-navigator.css">
    <link rel="stylesheet" href="custom-cursor.css?v=finger-press-7">
</head>
<body
    id="age-page-canvas"
    class="age-page-canvas game-page-canvas age-page-settlement-only"
    data-age-slug="alpha"
    data-age-settlement-page="true"
    data-age-view="city">
<script src="rift-viewport-metrics.js?v=rift-iife-fix-1"></script>
<script src="rift-display-resolution.js?v=rift-iife-fix-1"></script>
<script src="rift-page-loading-gate.js?v=page-loading-gate-1"></script>
<script src="page-route-transition.js?v=route-fade-1"></script>

    <main class="age-page-main" aria-label="Age Alpha — Settlement">
        <div class="age-map-shell" id="age-map-shell">
            <header class="age-map-hud age-map-hud--top" aria-label="Settlement overview">
                <div class="age-map-hud-panel age-map-hud-top-bar">
                    <div class="age-map-top-bar-brand">
                        <div class="age-map-top-bar-logo-wrap">
                            <img
                                src="images/royalarmiestitle.png?v=logo-trim-gimp-1"
                                alt="Royal Armies"
                                class="age-map-top-bar-logo"
                                width="320"
                                height="64">
                        </div>
                        <div class="age-map-top-bar-separator" aria-hidden="true"></div>
                        <div class="age-map-age-badge">
                            <span class="age-map-age-badge-eyebrow">Current Age</span>
                            <h1 id="age-map-age-title" class="age-map-age-badge-title">Age Alpha</h1>
                        </div>
                        <div class="age-map-top-bar-separator age-map-top-bar-separator--nation" aria-hidden="true"></div>
                        <div class="age-map-top-bar-nation" id="age-nation-welcome-panel" aria-label="Nation welcome">
                            <div class="age-nation-welcome-identity">
                                <img
                                    src="images/aesthenecrest.png"
                                    alt=""
                                    id="age-nation-welcome-crest"
                                    class="age-map-top-bar-nation-crest"
                                    width="52"
                                    height="52"
                                    decoding="async"
                                    aria-hidden="true">
                                <p id="age-nation-welcome-text" class="age-map-top-bar-nation-text">Welcome to Aesthine</p>
                            </div>
                        </div>
                        <div class="age-settlement-page-nav" aria-label="Settlement navigation">
                            <a
                                id="age-settlement-world-map-link"
                                class="age-settlement-world-map-link"
                                href="agealpha.html?riftAgeDevBypass=1">World Map</a>
                        </div>
                    </div>
                    <ul class="age-map-resource-strip" aria-label="Realm resources">
                        <li class="age-map-resource-item age-map-resource-item--commander-rank" id="age-hud-commander-rank-item" title="Commander rank">
                            <span class="age-map-resource-label">Rank</span>
                            <span class="age-map-resource-value" id="age-hud-commander-rank" aria-live="polite">1</span>
                        </li>
                        <li class="age-map-resource-item">
                            <span class="age-map-resource-label">Gold</span>
                            <span class="age-map-resource-value" id="age-hud-gold">—</span>
                        </li>
                        <li class="age-map-resource-item">
                            <span class="age-map-resource-label">Provisions</span>
                            <span class="age-map-resource-value" id="age-hud-provisions">—</span>
                        </li>
                        <li class="age-map-resource-item age-map-resource-item--units" id="age-hud-units-item">
                            <span class="age-map-resource-label">Units</span>
                            <span class="age-map-resource-value age-map-resource-value--units" id="age-hud-units" aria-label="Units">
                                <span class="age-hud-units-uninjured" id="age-hud-units-uninjured">0</span><span class="age-hud-units-separator" aria-hidden="true">|</span><span class="age-hud-units-total" id="age-hud-units-total">0</span>
                            </span>
                        </li>
                        <li class="age-map-resource-item age-map-resource-item--move-points" id="age-hud-move-points-item">
                            <span class="age-map-resource-label">Move Points</span>
                            <span class="age-map-resource-value" id="age-hud-move-points">—</span>
                        </li>
                    </ul>
                </div>
                <div class="age-map-top-bar-clock-cluster portal-desktop-nav-only" aria-label="Game time">
                    <div id="portal-universal-game-time-panel" class="portal-universal-game-time-panel" aria-label="Game time">
                        <div id="portal-universal-game-time-display" class="portal-universal-game-time-display" aria-live="polite">--:--:--</div>
                    </div>
                </div>
            </header>

            <aside class="age-map-hud age-map-hud--right is-settlement-view-open" id="age-map-hud-right" aria-label="Settlement venues">
                <div class="age-map-hud-panel-inner age-map-hud-panel-inner--right">
                    <section
                        id="age-settlement-menu-panel"
                        class="age-map-hud-section age-settlement-menu-panel"
                        aria-label="Settlement venues">
                        <header class="age-settlement-menu-header">
                            <div class="age-settlement-menu-header-row">
                                <h2 id="age-settlement-menu-title" class="age-settlement-menu-title">Phariis</h2>
                                <p id="age-settlement-menu-tier-label" class="age-settlement-menu-tier-label">Kingdom</p>
                            </div>
                            <div class="age-settlement-dev-tier" aria-label="Dev settlement tier">
                                <label class="age-settlement-dev-tier-label" for="age-settlement-dev-tier-select">Dev tier</label>
                                <select id="age-settlement-dev-tier-select" class="age-settlement-dev-tier-select" title="Override settlement tier for venue testing">
                                    <option value="village">Village</option>
                                    <option value="town">Town</option>
                                    <option value="city">City</option>
                                    <option value="kingdom" selected>Kingdom</option>
                                    <option value="citadel">Citadel</option>
                                </select>
                            </div>
                        </header>
                        <nav
                            id="age-settlement-menu-list"
                            class="age-settlement-menu-list"
                            aria-label="Settlement locations"></nav>
                    </section>
                </div>
            </aside>

            <div class="age-map-anchor">
                <div id="age-world-map" class="game-region-map-stage" role="application" aria-label="Settlement map">
                    <div id="age-world-map-frame" class="game-region-map-frame age-map-frame age-world-map-frame is-settlement-map-frame">
                        <img
                            id="age-world-map-settlement-bg"
                            class="age-world-map-settlement-bg game-region-map-bg"
                            src="images/kingdom.png"
                            alt="Settlement map"
                            width="1642"
                            height="1642"
                            decoding="async"
                            draggable="false">
                    </div>
                </div>
            </div>

"""

dispatch_and_close = """
            <div id="age-dispatch-alert-border" class="age-dispatch-alert-border" hidden aria-hidden="true">
                <button
                    type="button"
                    id="age-dispatch-alert-dismiss"
                    class="age-dispatch-alert-dismiss"
                    hidden
                    aria-label="Dismiss emergency dispatch alert">
                    Dismiss Alert
                </button>
            </div>

"""

tail = """
        </div>
    </main>

"""

scripts_tail = """
    <script src="rift-confirm-buttons.js?v=hub-action-btn-compact-1"></script>
    <script src="dev-environment.js"></script>
    <script src="rift-page-paths.js?v=settlement-page-1"></script>
    <script src="rift-error-codes.js?v=army-group-battle-1"></script>
    <script src="portal-alerts.js?v=update-complete-notice-1"></script>
    <script src="rift-error-display.js?v=local-dev-api-quiet-1"></script>
    <script src="commander-dossier-sync.js?v=commander-rank-pills-1"></script>
    <script src="rift-ui-sfx.js?v=discovery-wav-sync-1"></script>
    <script src="rank-data.js?v=commander-rank-pills-1"></script>
    <script src="rift-commander-rank-titles.js?v=commander-rank-roster-1"></script>
    <script src="script.js?v=commander-rank-roster-1"></script>
    <script src="commander-hub.js?v=commander-rank-pills-1"></script>
    <script src="portal-commander-identity-menu.js?v=nametag-menu-anchor-1"></script>
    <script src="rift-official-age.js?v=official-age-page-1"></script>
    <script src="game-chat.js?v=local-dev-api-quiet-1"></script>
    <script src="age-movement-panel.js?v=settlement-page-1"></script>
    <script src="rift-age-movement.js?v=army-group-assault-1"></script>
    <script src="rift-age-gold.js?v=age-gold-sync-1"></script>
    <script src="rift-age-commander-rank.js?v=commander-rank-hud-1"></script>
    <script src="rift-age-provisions.js?v=provisions-deplete-1"></script>
    <script src="rift-age-recruitment.js?v=swarm-recruit-1"></script>
    <script src="age-view-tabs.js?v=settlement-page-1"></script>
    <script src="rift-unit-purchase-catalog.js?v=swarm-recruit-1"></script>
    <script src="rift-age-guild-training.js?v=settlement-page-1"></script>
    <script src="rift-age-unit-evolution.js?v=unit-evolution-qty-1"></script>
    <script src="age-adventurers-guild.js?v=settlement-page-1"></script>
    <script src="age-unit-evolution.js?v=settlement-page-1"></script>
    <script src="age-barracks.js?v=settlement-page-1"></script>
    <script src="age-settlement-page.js?v=settlement-page-1"></script>
    <script src="dev-page-navigator.js?v=settlement-page-1"></script>
    <script src="custom-cursor.js?v=finger-press-hold-1"></script>
</body>
</html>
"""

(public / "settlement.html").write_text(
    head + workspaces + dispatch_and_close + footer + tail + scripts_tail,
    encoding="utf-8",
)
print("wrote settlement.html", (public / "settlement.html").stat().st_size)
