const fastify = require('fastify');
const cors = require('@fastify/cors');
const conf = require('ocore/conf.js');

const historyController = require('./controllers/historyController');
const userGhostController = require('./controllers/userGhostController');

const app = fastify({ logger: false });

app.get('/history/:address', historyController);
app.get('/user-ghost/:address', userGhostController);

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
