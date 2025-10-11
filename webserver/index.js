const fastify = require('fastify');
const cors = require('@fastify/cors');
const db = require("ocore/db.js");
const conf = require('ocore/conf.js');

const app = fastify({ logger: false });


app.get('/history/:address', async (request, reply) => {
	const { address } = request.params;

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
