/**
 * Desktop commander identity card — settings menu toggle and actions.
 */
(function initPortalCommanderIdentityMenu(global) {
    'use strict';

    function isPortalCommanderIdentityMenuOpen() {
        const card = global.document.getElementById('portal-commander-identity-card');
        return !!card && card.classList.contains('is-commander-menu-open');
    }

    function closePortalCommanderIdentityMenu() {
        const card = global.document.getElementById('portal-commander-identity-card');
        const menu = global.document.getElementById('portal-desktop-commander-menu');
        const settingsBtn = global.document.getElementById('portal-commander-identity-settings-btn');

        if (card) card.classList.remove('is-commander-menu-open');
        if (menu) menu.hidden = true;
        if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
    }

    function togglePortalCommanderIdentityMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const card = global.document.getElementById('portal-commander-identity-card');
        const menu = global.document.getElementById('portal-desktop-commander-menu');
        const settingsBtn = global.document.getElementById('portal-commander-identity-settings-btn');
        if (!card || !menu || !settingsBtn) return;

        const willOpen = !isPortalCommanderIdentityMenuOpen();
        if (willOpen) {
            card.classList.add('is-commander-menu-open');
            menu.hidden = false;
            settingsBtn.setAttribute('aria-expanded', 'true');
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
            case 'return-to-portal':
                if (typeof global.returnToGameAgePortal === 'function') {
                    global.returnToGameAgePortal();
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

    function bindPortalCommanderIdentityMenuDismissHandlers() {
        if (global.document.documentElement.dataset.portalCommanderMenuBound === 'true') return;
        global.document.documentElement.dataset.portalCommanderMenuBound = 'true';

        global.document.addEventListener('click', (event) => {
            if (!isPortalCommanderIdentityMenuOpen()) return;
            if (event.target.closest('#portal-commander-identity-card')) return;
            closePortalCommanderIdentityMenu();
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePortalCommanderIdentityMenu();
        });
    }

    global.isPortalCommanderIdentityMenuOpen = isPortalCommanderIdentityMenuOpen;
    global.closePortalCommanderIdentityMenu = closePortalCommanderIdentityMenu;
    global.togglePortalCommanderIdentityMenu = togglePortalCommanderIdentityMenu;
    global.portalDesktopCommanderMenuAction = portalDesktopCommanderMenuAction;
    global.bindPortalCommanderIdentityMenuDismissHandlers = bindPortalCommanderIdentityMenuDismissHandlers;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bindPortalCommanderIdentityMenuDismissHandlers, { once: true });
    } else {
        bindPortalCommanderIdentityMenuDismissHandlers();
    }
})(window);
