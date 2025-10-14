const fastify = require('fastify');
const cors = require('@fastify/cors');
const db = require("ocore/db.js");
const conf = require('ocore/conf.js');
const { isValidAddress } = require('ocore/validation_utils');

const app = fastify({ logger: false });


app.get('/history/:address', async (request, reply) => {
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
});

app.get('/user-ghost/:address', async (request, reply) => {
	const { address } = request.params;

	if (!address || !isValidAddress(address))
		return reply.status(400).send({ error: 'Invalid address' });

	const rows = await db.query("SELECT * FROM user_ghost WHERE address=?", [address]);

	if (rows.length === 0)
		return reply.status(404).send({ error: 'User not found' });

	return rows[0];
});

const startWebServer = async () => {
	await app.register(cors, {
		origin: '*',
		methods: ['GET'],
		allowedHeaders: ['Content-Type']
	});

	await app.listen({ port: conf.webserverPort, host: '0.0.0.0' });
	app.log.info(`Server listening on port ${conf.webserverPort}`);
};

module.exports = {
	start: startWebServer
}
