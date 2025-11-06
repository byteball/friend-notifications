const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
	max: 1000,
	ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
	allowStale: false,
	ttlAutopurge: true,
});

module.exports = cache;