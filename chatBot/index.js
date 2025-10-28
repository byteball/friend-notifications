const eventBus = require('ocore/event_bus.js');
const conf = require('ocore/conf.js');
const db = require("ocore/db.js");

const { isValidAddress } = require('ocore/validation_utils');
const aa_state = require('aabot/aa_state.js');
const getSignedData = require('../utils/getSignedData');
const deviceToGhostAndAddress = require('./cache.js');

const MAX_PAIRING_KEY_LENGTH = 73;

const startChatBot = () => {
	eventBus.on('paired', async (from_address, pairingKey) => {
		const vars = aa_state.getAAStateVars(conf.friend_aa);
		const [ghostName, address] = pairingKey.trim().slice(0, MAX_PAIRING_KEY_LENGTH).split("_"); // max 40 chars + address + 1 for split

		let device = require('ocore/device');

		if (isValidAddress(ghostName)) return device.sendMessageToDevice(from_address, 'text', 'Invalid ghost name');
		if (!isValidAddress(address)) return device.sendMessageToDevice(from_address, 'text', 'Invalid wallet address');

		const key = `friendship_${ghostName}_${address}`;

		if (!vars || !vars[`user_${ghostName}`]) return device.sendMessageToDevice(from_address, 'text', 'Unknown ghost name');
		if (vars[key]) return device.sendMessageToDevice(from_address, 'text', 'We\'re already friends! No need to link again.');

		deviceToGhostAndAddress.set(from_address, {
			ghostName: ghostName,
			address: address
		});

		return device.sendMessageToDevice(from_address, 'text', `Please sign this message to choose ${ghostName} as your future friend at the end of the current streak: [${address}](sign-message-request: choose ${ghostName} as future friend)`);
	});


	eventBus.on('text', async (from_address, text) => {
		text = text.trim();

		let device = require('ocore/device');

		const { ghostName, address } = (deviceToGhostAndAddress.get(from_address) || {});

		if (!ghostName) return device.sendMessageToDevice(from_address, 'text', 'Please select a ghost name on the website first.');

		if (text.trim().startsWith("[Signed message]") && ghostName && address) {
			let signedData;

			try {
				signedData = await getSignedData(from_address, address, text);
			} catch (error) {
				console.error('Error getting signed data:', error);
				return device.sendMessageToDevice(from_address, 'text', "Failed to retrieve signed data: " + (error?.error || ""));
			}

			if (signedData?.deviceAddress !== from_address) {
				return device.sendMessageToDevice(from_address, 'text', "Unknown device address in the signed message");
			}

			if (!signedData?.data?.name || signedData?.data?.name !== ghostName) {
				return device.sendMessageToDevice(from_address, 'text', `Please return to the website and select the ghost again.`);
			}

			await db.query("REPLACE INTO user_ghost (address, ghost_name) VALUES(?,?)", [address, ghostName]);

			deviceToGhostAndAddress.delete(from_address);

			return device.sendMessageToDevice(from_address, 'text', `Thank you! The ghost ${ghostName} has been successfully linked to your wallet address.`);
		} else {
			return device.sendMessageToDevice(from_address, 'text', 'Please return to the website and select the ghost again.');
		}
	});
}

module.exports = {
	start: startChatBot
}
