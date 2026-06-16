/**
 * Desktop commander identity card — menu toggle on avatar/name plate and actions.
 */
(function initPortalCommanderIdentityMenu(global) {
    'use strict';

    const AGE_FLOATING_MENU_GAP_PX = 6;
    let ageFloatingMenuHome = null;
    let ageFloatingRepositionBound = false;

    function getPortalCommanderIdentityTrigger() {
        return global.document.getElementById('portal-commander-identity-trigger');
    }

    function shouldFloatAgeMapCommanderMenu() {
        const body = global.document.body;
        return Boolean(body && body.dataset && body.dataset.ageMapOnly === 'true');
    }

    function getAgeFloatingMenuAnchor() {
        return getPortalCommanderIdentityTrigger()
            || global.document.getElementById('portal-commander-identity-card');
    }

    function clearAgeFloatingMenuInlinePosition(menu) {
        if (!menu) return;
        [
            'position',
            'top',
            'bottom',
            'left',
            'right',
            'width',
            'min-width',
            'max-width',
            'transform'
        ].forEach((prop) => menu.style.removeProperty(prop));
    }

    function positionAgeFloatingCommanderMenu(menu) {
        const anchor = getAgeFloatingMenuAnchor();
        if (!menu || !anchor) return;

        const rect = anchor.getBoundingClientRect();
        const viewportPadding = 12;
        const menuWidth = Math.min(340, Math.max(268, rect.width), global.innerWidth - viewportPadding * 2);
        const left = Math.max(
            viewportPadding,
            Math.min(rect.right - menuWidth, global.innerWidth - menuWidth - viewportPadding)
        );
        const bottom = Math.max(
            viewportPadding,
            global.innerHeight - rect.top + AGE_FLOATING_MENU_GAP_PX
        );

        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('top', 'auto', 'important');
        menu.style.setProperty('right', 'auto', 'important');
        menu.style.setProperty('left', `${left}px`, 'important');
        menu.style.setProperty('bottom', `${bottom}px`, 'important');
        menu.style.setProperty('width', `${menuWidth}px`, 'important');
        menu.style.setProperty('min-width', '268px', 'important');
        menu.style.setProperty('max-width', `${global.innerWidth - viewportPadding * 2}px`, 'important');
    }

    function bindAgeFloatingMenuReposition() {
        if (ageFloatingRepositionBound) return;
        ageFloatingRepositionBound = true;

        const reposition = () => {
            if (!isPortalCommanderIdentityMenuOpen()) return;
            const menu = global.document.getElementById('portal-desktop-commander-menu');
            if (!menu || menu.dataset.ageFloatingActive !== 'true') return;
            positionAgeFloatingCommanderMenu(menu);
        };

        global.addEventListener('resize', reposition);
        global.addEventListener('scroll', reposition, true);
    }

    function mountAgeFloatingCommanderMenu(menu) {
        if (!menu || menu.dataset.ageFloatingActive === 'true') return;

        ageFloatingMenuHome = {
            parent: menu.parentElement,
            nextSibling: menu.nextSibling
        };

        global.document.body.appendChild(menu);
        menu.dataset.ageFloatingActive = 'true';
        menu.classList.add('portal-commander-identity-menu--age-floating');
        bindAgeFloatingMenuReposition();
        positionAgeFloatingCommanderMenu(menu);
    }

    function restoreAgeFloatingCommanderMenu(menu) {
        if (!menu || menu.dataset.ageFloatingActive !== 'true' || !ageFloatingMenuHome?.parent) return;

        menu.classList.remove('portal-commander-identity-menu--age-floating');
        clearAgeFloatingMenuInlinePosition(menu);
        menu.dataset.ageFloatingActive = '';

        if (ageFloatingMenuHome.nextSibling) {
            ageFloatingMenuHome.parent.insertBefore(menu, ageFloatingMenuHome.nextSibling);
        } else {
            ageFloatingMenuHome.parent.appendChild(menu);
        }

        ageFloatingMenuHome = null;
    }

    function isPortalCommanderIdentityMenuOpen() {
        const card = global.document.getElementById('portal-commander-identity-card');
        return !!card && card.classList.contains('is-commander-menu-open');
    }

    function closePortalCommanderIdentityMenu() {
        const card = global.document.getElementById('portal-commander-identity-card');
        const menu = global.document.getElementById('portal-desktop-commander-menu');
        const trigger = getPortalCommanderIdentityTrigger();

        collapseCommanderMenuSuicideOptions();
        if (card) card.classList.remove('is-commander-menu-open');
        if (menu) {
            menu.hidden = true;
            restoreAgeFloatingCommanderMenu(menu);
        }
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function togglePortalCommanderIdentityMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const card = global.document.getElementById('portal-commander-identity-card');
        const menu = global.document.getElementById('portal-desktop-commander-menu');
        const trigger = getPortalCommanderIdentityTrigger();
        if (!card || !menu || !trigger) return;

        const willOpen = !isPortalCommanderIdentityMenuOpen();
        if (willOpen) {
            card.classList.add('is-commander-menu-open');
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            if (shouldFloatAgeMapCommanderMenu()) {
                mountAgeFloatingCommanderMenu(menu);
            }
            if (typeof global.syncNavMailboxIndicators === 'function') {
                global.syncNavMailboxIndicators();
            }
        } else {
            closePortalCommanderIdentityMenu();
        }
    }

    function portalDesktopCommanderMenuAction(action, event) {
        if (event) event.stopPropagation();
        closePortalCommanderIdentityMenu();

        switch (action) {
            case 'view-profile':
                if (typeof global.openPublicCommanderProfileCard === 'function') {
                    global.openPublicCommanderProfileCard(event);
                }
                break;
            case 'edit-profile':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('profile', event);
                }
                break;
            case 'messages':
                if (typeof global.openCommanderHubMessagesInbox === 'function') {
                    global.openCommanderHubMessagesInbox(event);
                }
                break;
            case 'settings':
                if (typeof global.openCommanderHubModal === 'function') {
                    global.openCommanderHubModal('settings', event);
                }
                break;
            case 'discoveries':
                if (typeof global.openDiscoveriesWorkspace === 'function') {
                    global.openDiscoveriesWorkspace(event);
                }
                break;
            case 'return-to-portal':
            case 'exit-server':
                if (typeof global.exitGameServerSession === 'function') {
                    global.exitGameServerSession();
                } else if (typeof global.returnToGameAgePortal === 'function') {
                    global.returnToGameAgePortal();
                } else if (typeof global.exitAgePortalToMain === 'function') {
                    global.exitAgePortalToMain();
                }
                break;
            case 'report-player':
                if (typeof global.openReportPlayerFromCommanderMenu === 'function') {
                    global.openReportPlayerFromCommanderMenu(event);
                } else if (global.RoyalArmiesPlayerReport?.openFromCommanderMenu) {
                    global.RoyalArmiesPlayerReport.openFromCommanderMenu(event);
                }
                break;
            case 'logout':
                if (typeof global.isMainPortalHub === 'function' && global.isMainPortalHub()) {
                    if (typeof global.requestPortalLogout === 'function') {
                        global.requestPortalLogout();
                    } else if (typeof global.triggerMainDashboardLogout === 'function') {
                        global.triggerMainDashboardLogout();
                    } else if (typeof global.executePortalLogoutRedirect === 'function') {
                        global.executePortalLogoutRedirect();
                    }
                } else if (typeof global.exitGameServerSession === 'function') {
                    global.exitGameServerSession();
                } else if (typeof global.returnToGameAgePortal === 'function') {
                    global.returnToGameAgePortal();
                }
                break;
            default:
                break;
        }
    }

    function resolveCommanderMenuItemAction(button) {
        if (!button) return null;
        if (button.classList.contains('dropdown-action-item-view-profile')) return 'view-profile';
        if (button.id === 'nav-dropdown-messages-btn') return 'messages';
        if (button.classList.contains('dropdown-action-item-discoveries')) return 'discoveries';
        if (button.id === 'game-nav-dropdown-logout-btn') return 'exit-server';
        if (button.classList.contains('dropdown-action-item-report-player')) return 'report-player';

        const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'edit profile') return 'edit-profile';
        if (label === 'settings') return 'settings';
        if (label === 'exit server') return 'exit-server';
        return null;
    }

    function bindPortalCommanderIdentityMenuActionHandlers() {
        const menu = global.document.getElementById('portal-desktop-commander-menu');
        if (!menu || menu.dataset.commanderMenuActionsBound === 'true') return;
        menu.dataset.commanderMenuActionsBound = 'true';

        menu.querySelectorAll('.dropdown-action-item').forEach((button) => {
            const action = resolveCommanderMenuItemAction(button);
            if (!action) return;
            button.addEventListener('click', (event) => {
                portalDesktopCommanderMenuAction(action, event);
            });
        });
    }

    function bindPortalCommanderIdentityTriggerHandlers() {
        const trigger = getPortalCommanderIdentityTrigger();
        if (!trigger || trigger.dataset.commanderMenuTriggerBound === 'true') return;
        trigger.dataset.commanderMenuTriggerBound = 'true';

        trigger.addEventListener('click', (event) => {
            togglePortalCommanderIdentityMenu(event);
        });

        trigger.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            togglePortalCommanderIdentityMenu(event);
        });
    }

    function bindPortalCommanderIdentityMenuDismissHandlers() {
        if (global.document.documentElement.dataset.portalCommanderMenuBound === 'true') return;
        global.document.documentElement.dataset.portalCommanderMenuBound = 'true';

        global.document.addEventListener('click', (event) => {
            if (!isPortalCommanderIdentityMenuOpen()) return;
            if (event.target.closest('#portal-commander-identity-card')) return;
            if (event.target.closest('#portal-desktop-commander-menu')) return;
            if (event.target.closest('.portal-commander-identity-menu--age-floating')) return;
            if (event.target.closest('#portal-commander-identity-trigger')) return;
            closePortalCommanderIdentityMenu();
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePortalCommanderIdentityMenu();
        });
    }

    function removeChroniclesBattlePassMenuItems() {
        global.document.querySelectorAll('.dropdown-action-item-chronicles-bp').forEach((button) => {
            button.remove();
        });
        global.document.querySelectorAll('#game-mobile-commander-submenu .portal-mobile-submenu-item').forEach((button) => {
            const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (label === 'the chronicles battle pass') {
                button.remove();
            }
        });
    }

    let commanderMenuSuicideInjectSeq = 0;

    function findCommanderMenuLogoutButton(menu) {
        if (!menu) return null;
        return menu.querySelector(
            '.dropdown-action-item-logout, .portal-mobile-submenu-item-logout, [id*="logout"][role="menuitem"], [onclick*="logout"]'
        );
    }

    function collapseCommanderMenuSuicideOptions() {
        global.document.querySelectorAll('[data-commander-menu-suicide-block]').forEach((block) => {
            block.classList.remove('is-suicide-open');
            const options = block.querySelector('[data-commander-menu-suicide-options]');
            if (options) options.hidden = true;
            const toggle = block.querySelector('[data-commander-menu-action="suicide-toggle"]');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    }

    function buildCommanderMenuSuicideOptionButton(mode, label, isMobile) {
        const button = global.document.createElement('button');
        button.type = 'button';
        button.className = isMobile
            ? 'portal-mobile-submenu-item commander-menu-suicide-option'
            : 'dropdown-action-item commander-menu-suicide-option';
        button.setAttribute('role', 'menuitem');
        button.setAttribute('data-commander-menu-action', mode === 'rank' ? 'suicide-rank' : 'suicide-exile');
        button.setAttribute('data-commander-reset-mode', mode);
        button.textContent = label;
        return button;
    }

    function buildCommanderMenuSuicideBlock(isMobile) {
        commanderMenuSuicideInjectSeq += 1;
        const optionsId = `commander-menu-suicide-options-${commanderMenuSuicideInjectSeq}`;

        const block = global.document.createElement('div');
        block.className = isMobile
            ? 'commander-menu-suicide-block portal-mobile-commander-suicide-block'
            : 'commander-menu-suicide-block';
        block.setAttribute('data-commander-menu-suicide-block', '');

        const toggle = global.document.createElement('button');
        toggle.type = 'button';
        toggle.className = isMobile
            ? 'portal-mobile-submenu-item dropdown-action-item-suicide'
            : 'dropdown-action-item dropdown-action-item-suicide';
        toggle.setAttribute('role', 'menuitem');
        toggle.setAttribute('data-commander-menu-action', 'suicide-toggle');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', optionsId);
        toggle.textContent = 'Suicide';

        const options = global.document.createElement('div');
        options.id = optionsId;
        options.className = 'commander-menu-suicide-options';
        options.setAttribute('data-commander-menu-suicide-options', '');
        options.hidden = true;
        options.appendChild(buildCommanderMenuSuicideOptionButton('rank', 'Secede Rank', isMobile));
        options.appendChild(buildCommanderMenuSuicideOptionButton('exile', 'Suicide out of Country', isMobile));

        block.appendChild(toggle);
        block.appendChild(options);
        return block;
    }

    function toggleCommanderMenuSuicideOptions(block) {
        if (!block) return;

        const willOpen = !block.classList.contains('is-suicide-open');
        collapseCommanderMenuSuicideOptions();

        if (!willOpen) return;

        block.classList.add('is-suicide-open');
        const options = block.querySelector('[data-commander-menu-suicide-options]');
        const toggle = block.querySelector('[data-commander-menu-action="suicide-toggle"]');
        if (options) options.hidden = false;
        if (toggle) toggle.setAttribute('aria-expanded', 'true');

        if (typeof global.applyProfileRankResetButtonState === 'function') {
            global.applyProfileRankResetButtonState();
        }
    }

    function handleCommanderMenuSuicideClick(event) {
        const button = event.target.closest('[data-commander-menu-action]');
        if (!button) return;

        const action = button.getAttribute('data-commander-menu-action');
        if (action === 'suicide-toggle') {
            event.preventDefault();
            event.stopPropagation();
            toggleCommanderMenuSuicideOptions(button.closest('[data-commander-menu-suicide-block]'));
            return;
        }

        if (action !== 'suicide-rank' && action !== 'suicide-exile') return;

        event.preventDefault();
        event.stopPropagation();

        collapseCommanderMenuSuicideOptions();
        if (typeof global.closeMobileCommanderSubmenu === 'function') {
            global.closeMobileCommanderSubmenu();
        }
        closePortalCommanderIdentityMenu();

        const mode = action === 'suicide-rank' ? 'rank' : 'exile';
        if (typeof global.triggerCommanderSuicide === 'function') {
            global.triggerCommanderSuicide(mode);
        }
    }

    function injectCommanderMenuSuicideItems() {
        global.document.querySelectorAll('#portal-desktop-commander-menu').forEach((menu) => {
            if (menu.querySelector('[data-commander-menu-suicide-block]')) return;
            const logoutBtn = findCommanderMenuLogoutButton(menu);
            if (!logoutBtn) return;
            logoutBtn.insertAdjacentElement('beforebegin', buildCommanderMenuSuicideBlock(false));
        });

        [
            'game-mobile-commander-submenu',
            'portal-mobile-commander-submenu'
        ].forEach((submenuId) => {
            const submenu = global.document.getElementById(submenuId);
            if (!submenu || submenu.querySelector('[data-commander-menu-suicide-block]')) return;
            const logoutBtn = findCommanderMenuLogoutButton(submenu);
            if (!logoutBtn) return;
            logoutBtn.insertAdjacentElement('beforebegin', buildCommanderMenuSuicideBlock(true));
        });
    }

    function bindCommanderMenuSuicideHandlers() {
        if (global.document.documentElement.dataset.commanderMenuSuicideBound === 'true') return;
        global.document.documentElement.dataset.commanderMenuSuicideBound = 'true';
        global.document.addEventListener('click', handleCommanderMenuSuicideClick);
    }

    function initPortalCommanderIdentityMenuBindings() {
        removeChroniclesBattlePassMenuItems();
        injectCommanderMenuSuicideItems();
        bindCommanderMenuSuicideHandlers();
        bindPortalCommanderIdentityTriggerHandlers();
        bindPortalCommanderIdentityMenuActionHandlers();
        bindPortalCommanderIdentityMenuDismissHandlers();
    }

    function bindPortalCommanderIdentityMenu() {
        initPortalCommanderIdentityMenuBindings();
    }

    global.isPortalCommanderIdentityMenuOpen = isPortalCommanderIdentityMenuOpen;
    global.closePortalCommanderIdentityMenu = closePortalCommanderIdentityMenu;
    global.togglePortalCommanderIdentityMenu = togglePortalCommanderIdentityMenu;
    global.portalDesktopCommanderMenuAction = portalDesktopCommanderMenuAction;
    global.bindPortalCommanderIdentityMenuDismissHandlers = bindPortalCommanderIdentityMenuDismissHandlers;
    global.bindPortalCommanderIdentityMenu = bindPortalCommanderIdentityMenu;
    global.removeChroniclesBattlePassMenuItems = removeChroniclesBattlePassMenuItems;
    global.injectCommanderMenuSuicideItems = injectCommanderMenuSuicideItems;
    global.collapseCommanderMenuSuicideOptions = collapseCommanderMenuSuicideOptions;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initPortalCommanderIdentityMenuBindings, { once: true });
    } else {
        initPortalCommanderIdentityMenuBindings();
    }
})(window);
