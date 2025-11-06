/*jslint node: true */
"use strict";
const eventBus = require('ocore/event_bus.js');
const network = require('ocore/network.js');

const operator = require('aabot/operator.js');
const watcher = require('./watcher.js');
const webserver = require('./webserver/index.js');
const chatbot = require('./chatbot/index.js');
const db_import = require('./db_import.js');


eventBus.on('headless_wallet_ready', async () => {
	await db_import.initDB();
	await operator.start();

	network.start();
	await watcher.startWatching();

	chatbot.start();
	webserver.start();
});

process.on('unhandledRejection', up => {
	console.error('unhandledRejection event', up, up.stack);
	throw up;
});
