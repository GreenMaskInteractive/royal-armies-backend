/**
 * NEXUS — Status tier entry (public operational dashboard + alert monitor).
 */
'use strict';

process.env.NEXUS_SERVICE_TIER = process.env.NEXUS_SERVICE_TIER || 'status';
require('./server.js');
