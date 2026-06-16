/**
 * NEXUS — Portal tier entry (main hub, community chat, auth, messaging).
 */
'use strict';

process.env.NEXUS_SERVICE_TIER = process.env.NEXUS_SERVICE_TIER || 'portal';
require('./server.js');
