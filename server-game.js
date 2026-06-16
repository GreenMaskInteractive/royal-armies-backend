/**
 * NEXUS — Game tier entry (Age client, game chat, battle systems).
 */
'use strict';

process.env.NEXUS_SERVICE_TIER = process.env.NEXUS_SERVICE_TIER || 'game';
require('./server.js');
