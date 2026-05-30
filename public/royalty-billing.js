/**
 * RIFT — Royalty membership billing (standby until payment processor is connected).
 */
(function initRoyalArmiesRoyaltyBilling(global) {
    'use strict';

    const CHECKOUT_COMPLIANCE_HTML = `
        <p id="royalty-checkout-compliance-note" class="royalty-checkout-compliance" role="note">
            By clicking <strong>Purchase</strong>, you agree that this is a recurring monthly subscription and that
            all sales of premium features are final and non-refundable per our
            <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
        </p>
    `;

    const BILLING_CONFIG = {
        checkoutLive: false,
        provider: null,
        recurringInterval: 'month',
        currency: 'USD'
    };

    function buildRoyaltyCheckoutComplianceMarkup() {
        return CHECKOUT_COMPLIANCE_HTML;
    }

    function isRoyaltyCheckoutLive() {
        return BILLING_CONFIG.checkoutLive === true;
    }

    async function beginRoyaltyMembershipCheckout(options = {}) {
        if (typeof global.playSelectSFX === 'function') {
            global.playSelectSFX();
        }

        if (!isRoyaltyCheckoutLive()) {
            const premiumPassLabel = options.premiumPassLabel || 'Premium Pass';
            const priceLabel = options.priceLabel || '$4.99 / month';
            await global.showPortalAlert(
                `Royalty membership (${priceLabel}) checkout is not live yet.\n\n`
                + 'When billing is connected, subscribing grants the Royalty Member title and unlocks the '
                + `${premiumPassLabel} on The Chronicles.\n\n`
                + 'Your purchase will be processed as a recurring monthly subscription. '
                + 'All premium feature sales are final and non-refundable per our Terms of Service.',
                'Checkout (standby)'
            );
            return {
                status: 'standby',
                message: 'Billing integration pending.'
            };
        }

        // Payment processor hook — implement when Stripe/PayPal (etc.) is wired.
        const checkoutSession = await createRoyaltyCheckoutSession(options);
        if (checkoutSession?.redirectUrl) {
            global.location.assign(checkoutSession.redirectUrl);
        }
        return checkoutSession;
    }

    async function createRoyaltyCheckoutSession(_options) {
        const response = await fetch(
            typeof global.resolveRoyalArmiesApiUrl === 'function'
                ? global.resolveRoyalArmiesApiUrl('/api/portal/billing/royalty/checkout-session')
                : '/api/portal/billing/royalty/checkout-session',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: typeof global.canUsePortalAuthSessionApi === 'function' && global.canUsePortalAuthSessionApi()
                    ? 'include'
                    : 'same-origin',
                body: JSON.stringify({})
            }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Checkout session could not be created.');
        }
        return payload;
    }

    global.RoyalArmiesRoyaltyBilling = {
        buildRoyaltyCheckoutComplianceMarkup,
        beginRoyaltyMembershipCheckout,
        isRoyaltyCheckoutLive,
        getBillingConfig: () => ({ ...BILLING_CONFIG })
    };

    global.buildRoyaltyCheckoutComplianceMarkup = buildRoyaltyCheckoutComplianceMarkup;
    global.beginRoyaltyMembershipCheckout = beginRoyaltyMembershipCheckout;
})(window);
