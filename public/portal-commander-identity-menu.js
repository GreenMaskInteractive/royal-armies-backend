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
        return !!global.document.getElementById('age-page-canvas')
            && !!global.document.querySelector('.age-map-bottom-commander-nametag #portal-desktop-commander-menu');
    }

    function getAgeFloatingMenuAnchor() {
        return getPortalCommanderIdentityTrigger()
            || global.document.getElementById('portal-commander-identity-card');
    }

    function clearAgeFloatingMenuInlinePosition(menu) {
        if (!menu) return;
        menu.style.removeProperty('position');
        menu.style.removeProperty('top');
        menu.style.removeProperty('bottom');
        menu.style.removeProperty('left');
        menu.style.removeProperty('right');
        menu.style.removeProperty('width');
        menu.style.removeProperty('min-width');
        menu.style.removeProperty('max-width');
        menu.style.removeProperty('transform');
    }

    function positionAgeFloatingCommanderMenu(menu) {
        const anchor = getAgeFloatingMenuAnchor();
        if (!menu || !anchor) return;

        const rect = anchor.getBoundingClientRect();
        const viewportPadding = 12;
        const menuWidth = Math.min(340, Math.max(268, rect.width), global.innerWidth - viewportPadding * 2);
        const rightOffset = Math.max(
            viewportPadding,
            global.innerWidth - rect.right
        );

        menu.style.position = 'fixed';
        menu.style.top = 'auto';
        menu.style.left = 'auto';
        menu.style.bottom = `${Math.max(viewportPadding, global.innerHeight - rect.top + AGE_FLOATING_MENU_GAP_PX)}px`;
        menu.style.right = `${rightOffset}px`;
        menu.style.width = `${menuWidth}px`;
        menu.style.minWidth = '268px';
        menu.style.maxWidth = `${global.innerWidth - viewportPadding * 2}px`;
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
            case 'chronicles-battle-pass':
                if (typeof global.openAgeChroniclesBattlePassModal === 'function') {
                    global.openAgeChroniclesBattlePassModal(event);
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
                if (typeof global.handleHeaderAuthAction === 'function') {
                    global.handleHeaderAuthAction();
                } else if (typeof global.triggerMainDashboardLogout === 'function') {
                    global.triggerMainDashboardLogout();
                }
                break;
            default:
                break;
        }
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
            if (event.target.closest('#portal-commander-identity-trigger')) return;
            closePortalCommanderIdentityMenu();
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePortalCommanderIdentityMenu();
        });
    }

    function initPortalCommanderIdentityMenuBindings() {
        bindPortalCommanderIdentityTriggerHandlers();
        bindPortalCommanderIdentityMenuDismissHandlers();
    }

    global.isPortalCommanderIdentityMenuOpen = isPortalCommanderIdentityMenuOpen;
    global.closePortalCommanderIdentityMenu = closePortalCommanderIdentityMenu;
    global.togglePortalCommanderIdentityMenu = togglePortalCommanderIdentityMenu;
    global.portalDesktopCommanderMenuAction = portalDesktopCommanderMenuAction;
    global.bindPortalCommanderIdentityMenuDismissHandlers = bindPortalCommanderIdentityMenuDismissHandlers;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initPortalCommanderIdentityMenuBindings, { once: true });
    } else {
        initPortalCommanderIdentityMenuBindings();
    }
})(window);
