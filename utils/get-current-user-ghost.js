const db = require("ocore/db.js");
const { isValidAddress } = require("ocore/validation_utils");

const getAaGhostList = require("./get-aa-ghost-list");
const getUserFriends = require("./get-user-friends");
const getNumberByAddress = require("./get-number-by-address");


async function getCurrentUserGhost(vars, address) {
	const [row] = await db.query("SELECT ghost_name FROM user_ghosts WHERE address=?", [address]);
	if (row && row.ghost_name) return row.ghost_name;

	const allGhosts = getAaGhostList(vars);

	const friends = getUserFriends(vars, address);

	const userGhostFriends = friends.filter(f => !isValidAddress(f));
	const ghostFriendsIds = userGhostFriends.map(f => allGhosts.findIndex(g => g.name === f));
	const ghostIndex = getNumberByAddress(address, allGhosts.length - 1, ghostFriendsIds);
	
	return allGhosts[ghostIndex]?.name || null;
}

module.exports = getCurrentUserGhost;