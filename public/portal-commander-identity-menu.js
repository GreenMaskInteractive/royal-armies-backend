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
                if (typeof global.returnToGameAgePortal === 'function') {
                    global.returnToGameAgePortal();
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
                if (typeof global.requestPortalLogout === 'function') {
                    global.requestPortalLogout();
                } else if (typeof global.triggerMainDashboardLogout === 'function') {
                    global.triggerMainDashboardLogout();
                } else if (typeof global.executePortalLogoutRedirect === 'function') {
                    global.executePortalLogoutRedirect();
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
        if (button.id === 'game-nav-dropdown-return-portal-btn') return 'return-to-portal';
        if (button.id === 'game-nav-dropdown-logout-btn') return 'logout';
        if (button.classList.contains('dropdown-action-item-report-player')) return 'report-player';

        const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'edit profile') return 'edit-profile';
        if (label === 'settings') return 'settings';
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

    function initPortalCommanderIdentityMenuBindings() {
        removeChroniclesBattlePassMenuItems();
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

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initPortalCommanderIdentityMenuBindings, { once: true });
    } else {
        initPortalCommanderIdentityMenuBindings();
    }
})(window);
