/*jslint node: true */
"use strict";

//exports.port = 6611;
//exports.myUrl = 'wss://mydomain.com/bb';

// for local testing
//exports.WS_PROTOCOL === 'ws://';
//exports.port = 16611;
//exports.myUrl = 'ws://127.0.0.1:' + exports.port;

exports.bServeAsHub = false;
exports.bLight = true;

exports.storage = 'sqlite';

exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.deviceName = 'Friend notifications';
exports.permanent_pairing_secret = '*';
exports.control_addresses = ['DEVICE ALLOWED TO CHAT'];
exports.payout_address = 'WHERE THE MONEY CAN BE SENT TO';
exports.bSingleAddress = true;
exports.bWantNewPeers = true;
exports.KEYS_FILENAME = 'keys.json';

// TOR
exports.socksHost = '127.0.0.1';
exports.socksPort = 9050;

exports.bNoPassphrase = true;

exports.explicitStart = true;

exports.webserverPort = 3050;

exports.lib_aas = [
	'5GG2PDVJ555WEUFGNPX55W2Z2T4P6BG5', // oswap v2 pool-lib
	'ASXH57GPNWI5FO5KJWJWLRMVZTXBRKJX', // oswap v2 pool-lib-by-price
];

exports.friend_aa = process.env.testnet ? 'GOP6M6NJ3DM4UQD6DNTUTM424YKPMTED' : 'FRDOQ56MP3RSPYUT2FJZKIGBTPRA57SW';

exports.attestors = process.env.testnet
	? {
		'EJC4A7WQGHEZEKW6RLO7F26SAR4LAQBU': 'discord',
		'V3QPTTW5PSTKNP5UCGCAPMKAJWUK2GC3': 'telegram',
		'7JJMSQDS7VG2F5XO23BAUSA5IZ35XBCN': 'mock-real-name-attestation',
	}
	: {
		'5KM36CFPBD2QJLVD65PHZG34WEM4RPY2': 'discord',
		'JBW7HT5CRBSF7J7RD26AYLQG6GZDPFPS': 'telegram',
		'JFKWGRMXP3KHUAFMF4SJZVDXFL6ACC6P': 'veriff',
	};


exports.DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
exports.DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
exports.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
exports.TELEGRAM_CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME;
exports.TELEGRAM_WEBHOOK_DOMAIN = process.env.TELEGRAM_WEBHOOK_DOMAIN;
exports.TELEGRAM_WEBHOOK_PORT = process.env.TELEGRAM_WEBHOOK_PORT || 3000;

exports.TELEGRAM_APPID = process.env.TELEGRAM_APPID;
exports.TELEGRAM_APIHASH = process.env.TELEGRAM_APIHASH;

console.log('finished friend notifications conf');
