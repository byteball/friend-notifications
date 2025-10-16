const db = require("ocore/db.js");
const { isValidAddress } = require('ocore/validation_utils');

const historyController = async (request, reply) => {
    const { address } = request.params;

    if (!address || isValidAddress(address) === false)
        return reply.status(400).send({ error: 'Invalid address' });

    const history = await db.query("SELECT * FROM user_balances WHERE address=? ORDER BY trigger_date", [address]);
    if (history.length === 0)
        return reply.status(404).send({ error: 'User not found' });

    // add totals for rewards
    let total_locked_rewards = 0;
    let total_liquid_rewards = 0;
    for (let tx of history) {
        total_locked_rewards += tx.locked_reward;
        total_liquid_rewards += tx.liquid_reward;
        tx.total_locked_rewards = total_locked_rewards;
        tx.total_liquid_rewards = total_liquid_rewards;
    }

    return history;
}

module.exports = historyController;