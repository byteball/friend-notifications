const eventBus = require('ocore/event_bus.js');
const conf = require('ocore/conf.js');
const db = require("ocore/db.js");
const { LRUCache } = require('lru-cache');

const { isValidAddress } = require('ocore/validation_utils');
const aa_state = require('aabot/aa_state.js');
const getSignedData = require('../utils/getSignedData');

// Cache device address -> selected ghost name
const deviceAddressToGhostName = new LRUCache({
	max: 1000,
	ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
	allowStale: false,
	ttlAutopurge: true
});

const startChatBot = () => {
	eventBus.on('paired', async (from_address, ghostName) => {
		ghostName = ghostName.trim().slice(0, 40); // max 40 chars

		let device = require('ocore/device');
		if (isValidAddress(ghostName)) return device.sendMessageToDevice(from_address, 'text', 'Invalid ghost name');

		const vars = aa_state.getAAStateVars(conf.friend_aa);

		if (!vars || !vars[`user_${ghostName}`]) return device.sendMessageToDevice(from_address, 'text', 'Unknown ghost name');

		deviceAddressToGhostName.set(from_address, ghostName);

		device.sendMessageToDevice(from_address, 'text', 'Please send me your address that you wish to assign with ghost (click ... and Insert my address)');
	});


	eventBus.on('text', async (from_address, text) => {
		text = text.trim();
		let device = require('ocore/device');

		const selectedGhost = deviceAddressToGhostName.get(from_address);

		if (!selectedGhost) return device.sendMessageToDevice(from_address, 'text', 'Please select a ghost name on the website first.');

		if (isValidAddress(text)) {
			return device.sendMessageToDevice(from_address, 'text', `Please sign this message to prove that you own the address: [${text}](sign-message-request: I own the address: ${text}. And I select ghost: ${selectedGhost}).`);
		} else if (text.trim().startsWith("[Signed message]") && selectedGhost) {
			let signedData;
			
			try {
				signedData = await getSignedData(from_address, text);
			} catch (error) {
				return device.sendMessageToDevice(from_address, 'text', "Failed to retrieve signed data");
			}

			if (signedData?.deviceAddress !== from_address) {
				return device.sendMessageToDevice(from_address, 'text', "Unknown device address in the signed message");
			}

			if (!signedData?.data?.name || signedData?.data?.name !== selectedGhost) {
				return device.sendMessageToDevice(from_address, 'text', `Please return to the website and select the ghost again.`);
			}

			const address = signedData.attestationWalletAddress;

			await db.query("REPLACE INTO user_ghost (address, ghost_name) VALUES(?,?)", [address, selectedGhost]);

			deviceAddressToGhostName.delete(from_address);
			return device.sendMessageToDevice(from_address, 'text', `Thank you! The ghost ${selectedGhost} has been successfully linked to your address ${address}.`);
		} else {
			return device.sendMessageToDevice(from_address, 'text', 'Please return to the website and select the ghost again.');
		}
	});
}

module.exports = {
	start: startChatBot
}
