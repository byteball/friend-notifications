const eventBus = require('ocore/event_bus.js');
const conf = require('ocore/conf.js');
const db = require("ocore/db.js");
const { LRUCache } = require('lru-cache');

const { isValidAddress } = require('ocore/validation_utils');
const aa_state = require('aabot/aa_state.js');
const getSignedData = require('../utils/getSignedData');

const MAX_PAIRING_KEY_LENGTH = 73;

// Cache device address -> selected ghost name
const deviceAddressToGhostName = new LRUCache({
	max: 1000,
	ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
	allowStale: false,
	ttlAutopurge: true
});

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

		deviceAddressToGhostName.set(from_address, ghostName);

		return device.sendMessageToDevice(from_address, 'text', `Please sign this message to choose ${ghostName} as your future friend at the end of the current streak: [${address}](sign-message-request: choose ${ghostName} as ${address} future friend)`);
	});


	eventBus.on('text', async (from_address, text) => {
		text = text.trim();
		
		let device = require('ocore/device');
		
		const selectedGhost = deviceAddressToGhostName.get(from_address).trim();

		if (!selectedGhost) return device.sendMessageToDevice(from_address, 'text', 'Please select a ghost name on the website first.');

		if (text.trim().startsWith("[Signed message]") && selectedGhost) {
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

			const address = signedData.walletAddress;

			await db.query("REPLACE INTO user_ghost (address, ghost_name) VALUES(?,?)", [address, selectedGhost]);

			deviceAddressToGhostName.delete(from_address);
			return device.sendMessageToDevice(from_address, 'text', `Thank you! The ghost ${selectedGhost} has been successfully linked to your wallet address.`);
		} else {
			return device.sendMessageToDevice(from_address, 'text', 'Please return to the website and select the ghost again.');
		}
	});
}

module.exports = {
	start: startChatBot
}
