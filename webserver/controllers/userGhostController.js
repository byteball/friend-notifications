const db = require("ocore/db.js");
const { isValidAddress } = require('ocore/validation_utils');

const userGhostController = async (request, reply) => {
    const { address } = request.params;

    if (!address || !isValidAddress(address))
        return reply.status(400).send({ error: 'Invalid address' });

    const rows = await db.query("SELECT address, ghost_name FROM user_ghost WHERE address=?", [address]);

    if (rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
    }

    return rows[0];
}

module.exports = userGhostController;