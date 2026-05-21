/* ==========================================================================
   COMMANDER HUB MODAL — Age Portal Profile / Messages / Settings
   ========================================================================== */

function getCommanderHubUIMount() {
    const pageRoot = document.getElementById('portal-commander-hub-page');
    if (pageRoot) {
        return {
            container: document.getElementById('portal-commander-hub-subnav'),
            body: document.getElementById('portal-commander-hub-body'),
            detailsHeader: document.getElementById('portal-commander-hub-section-title'),
            leftHeader: document.getElementById('portal-commander-hub-subnav-label'),
            modalFrame: pageRoot,
            profileHeaderHost: document.getElementById('portal-commander-hub-profile-header'),
            profileFooterHost: document.getElementById('portal-commander-hub-profile-footer-host'),
            profileActiveClass: 'commander-hub-profile-active',
            subnavItemClass: 'commander-hub-subnav-item',
            hideSubnavOnProfile: true
        };
    }

    return {
        container: document.getElementById('commander-hub-subnav'),
        body: document.getElementById('commander-hub-body'),
        detailsHeader: document.getElementById('commander-hub-section-title'),
        leftHeader: document.getElementById('commander-hub-subnav-label'),
        modalFrame: document.getElementById('commander-hub-modal'),
        profileHeaderHost: document.getElementById('commander-hub-profile-header'),
        profileFooterHost: document.getElementById('commander-hub-profile-footer-host'),
        profileActiveClass: 'commander-hub-profile-active',
        subnavItemClass: 'commander-hub-subnav-item',
        hideSubnavOnProfile: true
    };
}

function isCommanderHubPortalPageActive() {
    return Boolean(document.getElementById('portal-commander-hub-page'));
}

function isCommanderHubModalOpen() {
    const modal = document.getElementById('commander-hub-modal');
    return Boolean(modal && modal.classList.contains('is-visible'));
}

function isCommanderHubSurfaceActive() {
    return isCommanderHubPortalPageActive() || isCommanderHubModalOpen();
}

function normalizeCommanderHubTabName(tabName) {
    if (tabName === 'edit-profile') return 'profile';
    return tabName || 'profile';
}

function openCommanderHubPortalPage(initialTab, clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();

    const tab = normalizeCommanderHubTabName(initialTab);
    window.activeCommanderHubPortalTab = tab;

    if (typeof switchMainPortalView === 'function') {
        switchMainPortalView('commander', clickEvent);
    }
}

function teardownCommanderHubPortalView() {
    if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges && typeof revertSettings === 'function') {
        revertSettings();
    }

    if (typeof hideSaveChangesConfirmation === 'function') {
        hideSaveChangesConfirmation();
    }

    const pageRoot = document.getElementById('portal-commander-hub-page');
    if (pageRoot) {
        pageRoot.classList.remove(
            'commander-hub-profile-active',
            'commander-hub-settings-active',
            'commander-hub-messages-active'
        );
    }
}

function syncCommanderHubPlayerFromStorage() {
    if (typeof syncPlayerFromActiveCommanderStorage === 'function') {
        syncPlayerFromActiveCommanderStorage();
        return;
    }
    if (typeof player === 'undefined') return;
    const savedUser = localStorage.getItem('activeCommanderUser');
    const savedAvatar = localStorage.getItem('savedProfileAvatarUrl');
    if (savedUser) player.name = savedUser;
    if (savedAvatar) player.avatarUrl = savedAvatar;
}

function openCommanderHubModal(initialTab, clickEvent) {
    if (typeof isPortalMobileNavLayout === 'function' && isPortalMobileNavLayout()) {
        openCommanderHubPortalPage(initialTab, clickEvent);
        return;
    }

    const modal = document.getElementById('commander-hub-modal');
    if (!modal) return;

    syncCommanderHubPlayerFromStorage();
    if (typeof loadCommanderMailboxDossiersFromStorage === 'function') {
        loadCommanderMailboxDossiersFromStorage();
    }
    if (typeof autoDetectPlayerLocale === 'function') autoDetectPlayerLocale();

    modal.classList.add('is-visible');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });

    const tab = initialTab || 'profile';
    loadCommanderHubSection(tab, clickEvent);
}

function openCommanderHubMessagesInbox(clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();
    window.pendingMessagesHubChannel = 'messages';
    window.pendingMessagesFolder = 'inbox';
    openCommanderHubModal('messages', clickEvent);
}

function closeCommanderHubModal() {
    if (isCommanderHubPortalPageActive()) {
        teardownCommanderHubPortalView();
        if (typeof switchMainPortalView === 'function') {
            switchMainPortalView('portal', null);
        }
        return;
    }

    if (typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges && typeof revertSettings === 'function') {
        revertSettings();
    }

    if (typeof hideSaveChangesConfirmation === 'function') {
        hideSaveChangesConfirmation();
    }

    const modal = document.getElementById('commander-hub-modal');
    if (!modal) return;

    modal.style.opacity = '0';
    modal.classList.remove(
        'is-visible',
        'commander-hub-profile-active',
        'commander-hub-settings-active',
        'commander-hub-messages-active'
    );
    syncCommanderHubSettingsActionDeck(null);
    window.setTimeout(() => {
        modal.style.display = 'none';
    }, 280);

    if (typeof currentNarration !== 'undefined' && currentNarration) {
        if (!currentNarration.src.includes('background_music') && !currentNarration.isAmbientTrack) {
            currentNarration.pause();
            currentNarration.currentTime = 0;
            currentNarration = null;
        }
    }
}

function setCommanderHubTopNavActive(tabName, clickEvent) {
    document.querySelectorAll('.commander-hub-top-tab').forEach((tab) => {
        tab.classList.remove('active');
    });

    const clickedTab = clickEvent?.target?.closest?.('.commander-hub-top-tab');
    if (clickedTab) {
        clickedTab.classList.add('active');
        return;
    }

    const fallbackTab = document.querySelector(`.commander-hub-top-tab[data-hub-tab="${tabName}"]`);
    if (fallbackTab) fallbackTab.classList.add('active');
}

function syncCommanderHubSettingsActionDeck(tabName) {
    const deck = document.getElementById('portal-commander-hub-settings-action-deck')
        || document.getElementById('commander-hub-settings-action-deck');
    if (!deck) return;

    const showSettingsDeck = tabName === 'settings';
    deck.hidden = !showSettingsDeck;
}

function syncCommanderHubModalSectionState(tabName) {
    const frame = document.getElementById('portal-commander-hub-page')
        || document.getElementById('commander-hub-modal');
    if (!frame) return;

    frame.classList.remove(
        'commander-hub-profile-active',
        'commander-hub-settings-active',
        'commander-hub-messages-active'
    );

    if (tabName === 'profile') frame.classList.add('commander-hub-profile-active');
    else if (tabName === 'settings') frame.classList.add('commander-hub-settings-active');
    else if (tabName === 'messages') frame.classList.add('commander-hub-messages-active');

    syncCommanderHubSettingsActionDeck(tabName);
}

function loadCommanderHubSection(tabName, clickEvent) {
    if (typeof loadLore !== 'function') {
        console.warn('loadLore is unavailable — include script.js on main.html');
        return;
    }

    const resolvedTab = normalizeCommanderHubTabName(tabName);
    window.activeCommanderHubPortalTab = resolvedTab;

    setCommanderHubTopNavActive(resolvedTab, clickEvent);
    syncCommanderHubModalSectionState(resolvedTab);
    loadLore(resolvedTab, getCommanderHubUIMount());

    if (isCommanderHubPortalPageActive() && typeof syncPortalMobileNavChrome === 'function') {
        syncPortalMobileNavChrome('commander');
    }
}

function buildCommanderHubTopTabMarkup(activeTab) {
    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'messages', label: 'Messages' },
        { id: 'settings', label: 'Settings' },
    ];

    return tabs.map((entry) => {
        const isActive = activeTab === entry.id;
        return `<button type="button" class="commander-hub-top-tab${isActive ? ' active' : ''}" data-hub-tab="${entry.id}" onclick="loadCommanderHubSection('${entry.id}', event)">${entry.label}</button>`;
    }).join('');
}

function renderCommanderHubPortalCanvas(viewport, initialTab) {
    if (!viewport) return;

    const tab = normalizeCommanderHubTabName(initialTab || window.activeCommanderHubPortalTab);
    window.activeCommanderHubPortalTab = tab;

    viewport.innerHTML = `
        <div id="portal-commander-hub-page" class="portal-commander-hub-page commander-hub-page-canvas" role="region" aria-label="Commander account">
            <header class="portal-commander-hub-intro">
                <h2 class="portal-commander-hub-title">My Commander</h2>
                <p class="portal-commander-hub-subtitle">Manage your profile, messages, and account settings.</p>
            </header>

            <nav class="commander-hub-top-nav portal-commander-hub-top-nav" aria-label="Account sections">
                <div class="commander-hub-top-nav-bg" aria-hidden="true"></div>
                ${buildCommanderHubTopTabMarkup(tab)}
            </nav>

            <div class="portal-save-confirmation-toast" aria-live="polite" hidden></div>

            <div class="commander-hub-body-frame portal-commander-hub-body-frame">
                <aside class="commander-hub-subnav-column" id="portal-commander-hub-subnav-column">
                    <h4 class="commander-hub-subnav-label" id="portal-commander-hub-subnav-label">CHANNELS</h4>
                    <div class="commander-hub-subnav-list" id="portal-commander-hub-subnav"></div>
                </aside>

                <div class="commander-hub-content-pane portal-commander-hub-content-pane" id="portal-commander-hub-content-pane">
                    <h4 class="commander-hub-section-title" id="portal-commander-hub-section-title"></h4>
                    <div id="portal-commander-hub-profile-header" class="commander-hub-profile-header-host"></div>
                    <div id="portal-commander-hub-body" class="commander-hub-body"></div>
                    <div id="portal-commander-hub-profile-footer-host" class="commander-hub-profile-footer-host"></div>
                    <div id="portal-commander-hub-settings-action-deck" class="commander-hub-settings-action-deck" hidden>
                        <button type="button" class="confirm-btn" onclick="saveSettings()">Confirm Changes</button>
                        <button type="button" class="revert-btn" onclick="revertSettings()">Revert to Defaults</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    syncCommanderHubPlayerFromStorage();
    if (typeof loadCommanderMailboxDossiersFromStorage === 'function') {
        loadCommanderMailboxDossiersFromStorage();
    }
    if (typeof autoDetectPlayerLocale === 'function') autoDetectPlayerLocale();

    loadCommanderHubSection(tab, null);
}

function hydrateCommanderHubPortalPage(initialTab) {
    const viewport = document.getElementById('main-portal-dynamic-viewport');
    if (!viewport) return;
    renderCommanderHubPortalCanvas(viewport, initialTab);
}

function escapePublicProfileHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isViewingCommanderInActiveAge() {
    if (typeof isCommanderEnrolledInActiveAgeRound === 'function') {
        return isCommanderEnrolledInActiveAgeRound();
    }
    return localStorage.getItem('savedCommanderInActiveAge') === 'true';
}

function getCommanderRankTitle(rankNum, pathCode) {
    if (!isViewingCommanderInActiveAge()) return 'N/A';

    const rank = parseInt(rankNum, 10);
    if (!Number.isFinite(rank) || rank < 1) return 'N/A';

    const magicPath = pathCode === 'MAG' || pathCode === 'MAGIC';
    const rankTable = magicPath
        ? (typeof magicRanks !== 'undefined' ? magicRanks : null)
        : (typeof groundRanks !== 'undefined' ? groundRanks : null);

    if (rankTable && rankTable[rank] && rankTable[rank].title) {
        return rankTable[rank].title;
    }

    return 'N/A';
}

function getCommanderClassTitle(pathCode) {
    if (!isViewingCommanderInActiveAge()) return 'N/A';

    const labels = {
        PHYS: 'Battlemaster',
        MAG: 'Archmage',
        MAGIC: 'Archmage'
    };
    return labels[pathCode] || 'N/A';
}

const PUBLIC_PROFILE_MIN_AGE_HOURS = 24;
const PUBLIC_PROFILE_MAX_AGE_ENTRIES = 5;

function loadCommanderAgeHistoryRecords(sourcePlayer) {
    let records = [];
    if (sourcePlayer && Array.isArray(sourcePlayer.ageHistory)) {
        records = sourcePlayer.ageHistory;
    }
    if (!records.length) {
        try {
            const cached = localStorage.getItem('savedCommanderAgeHistory');
            if (cached) records = JSON.parse(cached);
        } catch (err) {
            records = [];
        }
    }
    if (!Array.isArray(records)) return [];

    return records
        .filter((entry) => {
            const hours = Number(entry.hoursServed ?? entry.hours ?? 0);
            return Number.isFinite(hours) && hours >= PUBLIC_PROFILE_MIN_AGE_HOURS;
        })
        .sort((a, b) => {
            const aTime = Date.parse(a.endedAt || a.completedAt || a.startedAt || 0) || 0;
            const bTime = Date.parse(b.endedAt || b.completedAt || b.startedAt || 0) || 0;
            return bTime - aTime;
        })
        .slice(0, PUBLIC_PROFILE_MAX_AGE_ENTRIES);
}

function loadCommanderAwardRecords(sourcePlayer) {
    let awards = [];
    if (sourcePlayer && Array.isArray(sourcePlayer.awards)) {
        awards = sourcePlayer.awards;
    }
    if (!awards.length) {
        try {
            const cached = localStorage.getItem('savedCommanderAwards');
            if (cached) awards = JSON.parse(cached);
        } catch (err) {
            awards = [];
        }
    }
    return Array.isArray(awards) ? awards : [];
}

function getPublicProfileSnapshot(subjectPlayer) {
    const source = subjectPlayer || (typeof player !== 'undefined' ? player : null);
    if (!source) return null;

    const viewingSelf = !subjectPlayer;
    const storedBio = viewingSelf ? localStorage.getItem('savedCommanderBio') : null;
    const storedPrivacy = viewingSelf ? localStorage.getItem('savedCommanderPrivacy') : null;
    const description = storedBio !== null ? storedBio : (source.description || '');
    const privacy = viewingSelf
        ? (storedPrivacy === 'Public' || storedPrivacy === 'Private' ? storedPrivacy : (source.privacy || 'Public'))
        : (source.privacy === 'Private' ? 'Private' : 'Public');

    return {
        name: source.name || 'Unknown Commander',
        viewingSelf,
        avatarUrl: source.avatarUrl || 'images/avatars/commanderprofile01.png',
        country: source.country || '—',
        timezone: source.timezone || '—',
        membershipTitle: (typeof resolveCommanderMembershipTitleForUsername === 'function'
            ? resolveCommanderMembershipTitleForUsername(source.name, source.membershipTitle || 'Bronze')
            : (typeof isPortalSiteOwner === 'function' && isPortalSiteOwner(source.name)
                ? 'Royalty'
                : (source.membershipTitle || 'Bronze'))),
        description,
        privacy,
        rank: source.rank ?? 1,
        path: source.path || '',
        ageHistory: loadCommanderAgeHistoryRecords(source),
        awards: loadCommanderAwardRecords(source)
    };
}

function buildPublicProfileAgeHistoryHtml(ageHistory) {
    if (!ageHistory.length) {
        return '<p class="public-profile-empty-state">Nothing to Report</p>';
    }

    const rows = ageHistory.map((entry) => {
        const ageLabel = entry.ageName || entry.name || (entry.ageNumber ? `Age ${entry.ageNumber}` : 'Unknown Age');
        const nation = entry.nation || entry.country || '';
        const hours = Number(entry.hoursServed ?? entry.hours ?? 0);
        const hoursLabel = Number.isFinite(hours) ? `${Math.floor(hours)}h served` : '';
        const metaParts = [nation, hoursLabel].filter(Boolean);

        return `
            <li class="public-profile-age-entry">
                <span class="public-profile-age-name">${escapePublicProfileHtml(ageLabel)}</span>
                ${metaParts.length ? `<span class="public-profile-age-meta">${escapePublicProfileHtml(metaParts.join(' · '))}</span>` : ''}
            </li>
        `;
    }).join('');

    return `<ul class="public-profile-age-history-list">${rows}</ul>`;
}

function buildPublicProfileAwardsHtml(awards) {
    if (!awards.length) {
        return '<p class="public-profile-empty-state public-profile-awards-empty">No achievements recorded yet.</p>';
    }

    const chips = awards.map((award, index) => {
        const label = award.label || award.name || `Award ${index + 1}`;
        const achievement = award.achievement || award.description || 'Achievement details forthcoming.';
        const iconUrl = award.iconUrl || award.icon || '';
        const iconMarkup = iconUrl
            ? `<img class="public-profile-award-icon-img" src="${escapePublicProfileHtml(iconUrl)}" alt="">`
            : `<span class="public-profile-award-icon-fallback" aria-hidden="true">🏅</span>`;

        return `
            <div class="public-profile-award-chip" tabindex="0" role="img" aria-label="${escapePublicProfileHtml(label)}: ${escapePublicProfileHtml(achievement)}">
                <span class="public-profile-award-icon-shell">${iconMarkup}</span>
                <span class="public-profile-award-tooltip" role="tooltip">${escapePublicProfileHtml(achievement)}</span>
            </div>
        `;
    }).join('');

    return `<div class="public-profile-awards-grid" role="list">${chips}</div>`;
}

function renderPublicProfileCardContent(snapshot) {
    const isPublic = snapshot.privacy === 'Public';
    const viewingSelf = !!snapshot.viewingSelf;
    const hideSensitiveDetails = !isPublic && !viewingSelf;

    const membershipBadgeRowMarkup = typeof buildCommanderMembershipBadgeRowMarkup === 'function'
        ? buildCommanderMembershipBadgeRowMarkup(snapshot.name, 'public-profile-membership')
        : `<span class="public-profile-membership tier-${String(snapshot.membershipTitle).toLowerCase()}">${escapePublicProfileHtml(snapshot.membershipTitle)} Member</span>${
            typeof isPortalSiteOwner === 'function' && isPortalSiteOwner(snapshot.name)
                ? '<span class="commander-owner-tag" title="Site owner"><span class="commander-owner-tag-icon" aria-hidden="true">👑</span>Owner</span>'
                : ''
        }`;
    const rankTitle = getCommanderRankTitle(snapshot.rank, snapshot.path);
    const classTitle = getCommanderClassTitle(snapshot.path);

    const bioColumnContent = snapshot.description
        ? `<p class="public-profile-bio-text">${escapePublicProfileHtml(snapshot.description)}</p>`
        : '<p class="public-profile-empty-state public-profile-bio-empty">No bio written yet.</p>';

    const locationMetaRow = hideSensitiveDetails
        ? ''
        : `<div class="public-profile-meta-row">
                <span><strong>Nation:</strong> ${escapePublicProfileHtml(snapshot.country)}</span>
                <span><strong>Time Zone:</strong> ${escapePublicProfileHtml(snapshot.timezone)}</span>
           </div>`;

    const statsColumnSection = hideSensitiveDetails
        ? ''
        : `<div class="public-profile-split-column public-profile-split-right">
                <section class="public-profile-section public-profile-awards-section">
                    <h4 class="public-profile-section-label">Achievements</h4>
                    ${buildPublicProfileAwardsHtml(snapshot.awards)}
                </section>
                <section class="public-profile-section public-profile-age-section">
                    <h4 class="public-profile-section-label">Last 5 Ages (24+ Hours Served)</h4>
                    ${buildPublicProfileAgeHistoryHtml(snapshot.ageHistory)}
                </section>
           </div>`;

    const splitBodySection = `
        <div class="public-profile-split-body${hideSensitiveDetails ? ' public-profile-split-body--restricted' : ''}">
            <div class="public-profile-split-column public-profile-split-left">
                <section class="public-profile-section public-profile-bio-section">
                    <h4 class="public-profile-section-label">Bio</h4>
                    <div class="public-profile-bio-panel">${bioColumnContent}</div>
                </section>
            </div>
            ${statsColumnSection}
        </div>
    `;

    const editProfileBtn = viewingSelf
        ? `<button type="button" class="public-profile-edit-link-btn" onclick="closePublicCommanderProfileCard(event); openCommanderHubModal('profile', event);">Edit My Profile</button>`
        : '';

    return `
        <header class="public-profile-identity-header">
            <div class="public-profile-avatar-ring">
                <img class="public-profile-avatar-img" src="${escapePublicProfileHtml(snapshot.avatarUrl)}" alt="${escapePublicProfileHtml(snapshot.name)} emblem">
            </div>
            <div class="public-profile-identity-copy">
                <p class="public-profile-eyebrow">Player profile</p>
                <h2 id="public-profile-card-title" class="public-profile-commander-name">${escapePublicProfileHtml(snapshot.name)}</h2>
                <div class="public-profile-badge-row commander-membership-badge-row">
                    ${membershipBadgeRowMarkup}
                </div>
                ${locationMetaRow}
                <div class="public-profile-meta-row">
                    <span><strong>Rank:</strong> ${escapePublicProfileHtml(rankTitle)}</span>
                    <span><strong>Class:</strong> ${escapePublicProfileHtml(classTitle)}</span>
                </div>
            </div>
        </header>
        ${splitBodySection}
        <footer class="public-profile-card-actions">
            ${editProfileBtn}
            <button type="button" class="public-profile-dismiss-btn" onclick="closePublicCommanderProfileCard(event)">Close</button>
        </footer>
    `;
}

function openPublicCommanderProfileCard(clickEvent, subjectPlayer) {
    if (clickEvent) clickEvent.stopPropagation();
    syncCommanderHubPlayerFromStorage();

    const snapshot = getPublicProfileSnapshot(subjectPlayer);
    if (!snapshot) return;

    const overlay = document.getElementById('public-commander-profile-overlay');
    const mount = document.getElementById('public-profile-card-mount');
    if (!overlay || !mount) return;

    mount.innerHTML = renderPublicProfileCardContent(snapshot);
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });

    document.addEventListener('keydown', handlePublicProfileCardEscapeKey);
}

function closePublicCommanderProfileCard(clickEvent) {
    if (clickEvent) clickEvent.stopPropagation();

    const overlay = document.getElementById('public-commander-profile-overlay');
    if (!overlay) return;

    overlay.style.opacity = '0';
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handlePublicProfileCardEscapeKey);
    window.setTimeout(() => {
        overlay.style.display = 'none';
    }, 220);
}

function handlePublicProfileCardEscapeKey(e) {
    if (e.key === 'Escape') closePublicCommanderProfileCard();
}

window.openCommanderHubModal = openCommanderHubModal;
window.openCommanderHubPortalPage = openCommanderHubPortalPage;
window.openCommanderHubMessagesInbox = openCommanderHubMessagesInbox;
window.closeCommanderHubModal = closeCommanderHubModal;
window.loadCommanderHubSection = loadCommanderHubSection;
window.renderCommanderHubPortalCanvas = renderCommanderHubPortalCanvas;
window.hydrateCommanderHubPortalPage = hydrateCommanderHubPortalPage;
window.teardownCommanderHubPortalView = teardownCommanderHubPortalView;
window.isCommanderHubPortalPageActive = isCommanderHubPortalPageActive;
window.openPublicCommanderProfileCard = openPublicCommanderProfileCard;
window.closePublicCommanderProfileCard = closePublicCommanderProfileCard;
