"use strict";
const eventBus = require('ocore/event_bus.js');
const conf = require('ocore/conf.js');
const network = require('ocore/network.js');
const storage = require("ocore/storage.js");
const db = require("ocore/db.js");
const walletGeneral = require("ocore/wallet_general.js");
const light_wallet = require("ocore/light_wallet.js");
const constants = require("ocore/constants.js");
const { isValidAddress } = require("ocore/validation_utils.js");

const dag = require('aabot/dag.js');
const operator = require('aabot/operator.js');
const aa_state = require('aabot/aa_state.js');

const discordInstance = require('./discordInstance');
const telegramInstance = require('./telegramInstance');

const website = 'https://friend.obyte.org';

const followup_reward_days = [
	['1st', 60],
	['2nd', 150],
	['3rd', 270],
	['4th', 450],
	['5th', 720],
	['6th', 1080],
	['7th', 1620],
];

let notifiedRewards = {};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function onAAResponse(objAAResponse) {
	const { aa_address, trigger_unit, trigger_address, bounced, response } = objAAResponse;
	if (bounced && trigger_address === operator.getAddress())
		return console.log(`=== our request ${trigger_unit} bounced with error`, response.error);
	if (bounced)
		return console.log(`request ${trigger_unit} bounced with error`, response.error);
	handleAAResponse(objAAResponse);
}

async function onAARequest(objAARequest, arrResponses) {
	const address = objAARequest.unit.authors[0].address;
	if (address === operator.getAddress())
		return console.log(`skipping our own request`);
	if (arrResponses[0].bounced)
		return console.log(`trigger ${objAARequest.unit.unit} from ${address} will bounce`, arrResponses[0].response.error);
	const aas = arrResponses.map(r => r.aa_address);
	console.log(`request from ${address} trigger ${objAARequest.unit.unit} affected AAs`, aas);
	for (let objAAResponse of arrResponses)
		handleAAResponse(objAAResponse, true)
}

async function handleAAResponse(objAAResponse, bEstimated) {
	const { aa_address, trigger_unit, timestamp, response: { responseVars } } = objAAResponse;
	if (aa_address === conf.friend_aa && responseVars) {
		const { event } = responseVars;
		if (event) {
			const is_stable = bEstimated ? 0 : 1;
			const objEvent = JSON.parse(event);
			console.log('friend event', objEvent);
			const { type } = objEvent;
			if (type === 'rewards') {
				const { user1, user2, rewards, followup, days, ghost } = objEvent;
				notifyAboutRewards(user1, user2, rewards, followup, days, ghost);
				const total_balance1_with_reducers = rewards.total_balances.user1.with_reducers + rewards.user1.locked;
				const total_balance1_sans_reducers = rewards.total_balances.user1.sans_reducers + rewards.user1.locked;
				await db.query("REPLACE INTO user_balances (address, trigger_unit, event, total_balance_with_reducers, total_balance_sans_reducers, locked_reward, liquid_reward, new_user_reward, referral_reward, is_stable, trigger_date) VALUES (?, ?, 'rewards', ?, ?, ?, ?, ?, 0, ?, datetime(?, 'unixepoch'))", [user1, trigger_unit, total_balance1_with_reducers, total_balance1_sans_reducers, rewards.user1.locked, rewards.user1.liquid, rewards.user2.is_new ? rewards.user1.new_user_reward : 0, is_stable, timestamp]);
				if (!ghost) {
					const total_balance2_with_reducers = rewards.total_balances.user2.with_reducers + rewards.user2.locked;
					const total_balance2_sans_reducers = rewards.total_balances.user2.sans_reducers + rewards.user2.locked;
					await db.query("REPLACE INTO user_balances (address, trigger_unit, event, total_balance_with_reducers, total_balance_sans_reducers, locked_reward, liquid_reward, new_user_reward, referral_reward, is_stable, trigger_date) VALUES (?, ?, 'rewards', ?, ?, ?, ?, ?, 0, ?, datetime(?, 'unixepoch'))", [user2, trigger_unit, total_balance2_with_reducers, total_balance2_sans_reducers, rewards.user2.locked, rewards.user2.liquid, rewards.user1.is_new ? rewards.user2.new_user_reward : 0, is_stable, timestamp]);
				}
				for (let ref in rewards.referrers) {
					const reward = rewards.referrers[ref];
					if (ref === user1 || ref === user2)
						await db.query("UPDATE user_balances SET referral_reward=?, locked_reward=locked_reward+?, total_balance_with_reducers=total_balance_with_reducers+?, total_balance_sans_reducers=total_balance_sans_reducers+? WHERE trigger_unit=? AND address=?", [reward, reward, reward, reward, trigger_unit, ref]);
					else {
						const [{ total_balance_with_reducers, total_balance_sans_reducers }] = await db.query("SELECT total_balance_with_reducers, total_balance_sans_reducers FROM user_balances WHERE address=? ORDER BY trigger_date DESC LIMIT 1", [ref]);
						await db.query("REPLACE INTO user_balances (address, trigger_unit, event, total_balance_with_reducers, total_balance_sans_reducers, locked_reward, referral_reward, is_stable, trigger_date) VALUES (?, ?, 'rewards', ?, ?, ?, ?, ?, datetime(?, 'unixepoch'))", [ref, trigger_unit, total_balance_with_reducers + reward, reward, total_balance_sans_reducers + reward, reward, is_stable, timestamp]);
					}
				}

				if (ghost) {
					const address = isValidAddress(user2) ? user2 : user1;
					await db.query("REPLACE INTO user_ghost (address, ghost_name) VALUES(?,?)", [address, null]);
				}
			}
			else if (type === 'deposit') {
				const { owner, total_balance: incomplete_total_balance_sans_reducers } = objEvent;
				const vars = bEstimated ? aa_state.getUpcomingAAStateVars(conf.friend_aa) : aa_state.getAAStateVars(conf.friend_aa);
				const total_balance_with_reducers = await getUserTotalBalance(vars, owner, true);
				const total_balance_sans_reducers = await getUserTotalBalance(vars, address, false);
				await db.query("REPLACE INTO user_balances (address, trigger_unit, event, total_balance_with_reducers, total_balance_sans_reducers, is_stable, trigger_date) VALUES (?, ?, 'deposit', ?, ?, ?, datetime(?, 'unixepoch'))", [owner, trigger_unit, total_balance_with_reducers, total_balance_sans_reducers, is_stable, timestamp]);
			}
			else if (type === 'replace' || type === 'withdrawal') {
				const { address } = objEvent;
				const vars = bEstimated ? aa_state.getUpcomingAAStateVars(conf.friend_aa) : aa_state.getAAStateVars(conf.friend_aa);
				const total_balance_with_reducers = await getUserTotalBalance(vars, address, true);
				const total_balance_sans_reducers = await getUserTotalBalance(vars, address, false);
				await db.query("REPLACE INTO user_balances (address, trigger_unit, event, total_balance_with_reducers, total_balance_sans_reducers, is_stable, trigger_date) VALUES (?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch'))", [address, trigger_unit, type, total_balance_with_reducers, total_balance_sans_reducers, is_stable, timestamp]);
			}
			else
				console.log(`ignored event`);
		}
		else
			console.log(`no event from friends`);
	}
}


async function getDiscordChannelAndGuild() {
	const channel = await discordInstance.channels.fetch(conf.DISCORD_CHANNEL_ID);
	if (!channel)
		throw Error(`failed to get discord channel`);
		
	const guild = channel.guild;
	if (!guild) throw Error('server not found');
	
	await guild.members.fetch();
	
	return { channel, guild };
}

async function sendDiscordMessage(channel, content) {
	await channel.send({
		content,
		allowedMentions: { parse: ['users'] }
	});
	
	return true;
}

async function formatDiscordMention(guild, username) {
	const discordMember = guild.members.cache.find(m => m.user.username === username);
	return discordMember ? `<@${discordMember.user.id}>` : '@' + username;
}




async function notify(address1, address2, getText) {
	let usernames = {
		[address1]: await getUsernames(address1),
		[address2]: await getUsernames(address2),
	};
	const { channel, guild } = await getDiscordChannelAndGuild();
	let mentions = {};
	for (let address in usernames) {
		const { discord, telegram } = usernames[address];
		mentions[address] = {
			discord: discord ? await formatDiscordMention(guild, discord) : `telegram user @${telegram}`,
			telegram: telegram ? await telegramInstance.formatTagUser(telegram) : `discord user @${discord}`,
		};
	}

	let bSent = false;
	if (usernames[address1].discord && usernames[address2].discord) {
		await sendDiscordMessage(channel, getText(mentions[address1].discord, mentions[address2].discord));
		bSent = true;
	}
	
	if (usernames[address1].telegram && usernames[address2].telegram) {		
		await telegramInstance.sendMessage(getText(mentions[address1].telegram, mentions[address2].telegram));
		bSent = true;
	}

	// users are on different networks
	if (
		usernames[address1].discord && !usernames[address1].telegram && !usernames[address2].discord && usernames[address2].telegram
		||
		usernames[address2].discord && !usernames[address2].telegram && !usernames[address1].discord && usernames[address1].telegram
	) {
		if (bSent)
			throw Error(`already sent to ${address1} and ${address2}`);
		await sendDiscordMessage(channel, getText(mentions[address1].discord, mentions[address2].discord));
		await telegramInstance.sendMessage(getText(mentions[address1].telegram, mentions[address2].telegram));
		bSent = true;
	}

	if (!bSent)
		console.error(`not notified`, usernames);
}

// get usernames of a user on discord, telegram, etc
async function getUsernames(address) {
	if (!isValidAddress(address)) // ghost
		return {};
	const rows = await db.query("SELECT attested_fields.attestor_address, messages.payload FROM messages INNER JOIN attested_fields USING(unit, message_index) WHERE attested_fields.attestor_address IN(?) AND attested_fields.address=? AND attested_fields.field='username' ORDER BY attested_fields.rowid DESC", [Object.keys(conf.attestors), address]);
	if (rows.length === 0)
		throw Error(`no attestations for ${address}`);

	let usernames = {};
	let tgId;

	for (let { attestor_address, payload } of rows) {
		const profile = JSON.parse(payload).profile;
		const service = conf.attestors[attestor_address];

		for (const [field, value] of Object.entries(profile)) {
			if (service === 'telegram' && field === 'userId') {
				if (tgId) continue;
				tgId = value;
				continue;
			}

			if (!usernames[service] && field === 'username') // the later attestation has precedence
				usernames[service] = value;
		}
	}

	if (tgId) {
		const newUsername = telegramInstance.getUsernameById(tgId);

		if (newUsername)
			usernames.telegram = newUsername;
	}

	return usernames;
}

async function loadLibs() {
	for (let address of conf.lib_aas) {
	//	await dag.loadAA(address);
		const definition = await dag.readAADefinition(address);
		const payload = { address, definition };
		await storage.insertAADefinitions(db, [payload], constants.GENESIS_UNIT, 0, false);
	}
}




function initAsset() {
	const vars = aa_state.getAAStateVars(conf.friend_aa);
	const asset = vars.constants?.asset;
	if (!asset)
		throw Error(`asset not defined yet in ${conf.friend_aa}`);
	network.requestHistoryFor([asset]);
}



function getFollowupRewardInfo(elapsed_days, bWithExpiry) {
	for (let i = followup_reward_days.length - 1; i >= 0; i--) {
		const [fu_reward_number, days] = followup_reward_days[i];
		if (elapsed_days >= days && (!bWithExpiry || elapsed_days <= days + 10))
			return { fu_reward_number, days, next_days: followup_reward_days[i + 1] ? followup_reward_days[i + 1][1] : null };
	}
	return {};
}

async function get_deposit_asset_exchange_rate(vars, asset) {
	const pool = vars['deposit_asset_' + asset];
	if (!pool)
		throw Error(`no pool for asset ${asset}`);
	const params = await dag.readAAParams(pool);
	const bX = params.x_asset == asset && params.y_asset == 'base';
	const pool_vars = aa_state.getAAStateVars(pool);
	const recent = pool_vars.recent;
	const pmax = Math.max(recent.current.pmax, recent.prev.pmax);
	const pmin = Math.min(recent.current.pmin, recent.prev.pmin);
	return bX ? pmin : 1 / pmax;
}

async function getUserTotalBalance(vars, address, bWithReducers = true) {
	const user = vars['user_' + address];
	const ceiling_price = 2 ** ((Date.now() / 1000 - vars.constants.launch_ts) / (365 * 24 * 3600));
	let total_balance = 0;
	for (let asset in user.balances) {
		const bal = user.balances[asset];
		if (asset === 'frd')
			total_balance += bal;
		else if (asset === 'base')
			total_balance += (bWithReducers ? 0.75 : 1) * bal / ceiling_price;
		else {
			const rate = await get_deposit_asset_exchange_rate(vars, asset);
			total_balance += (bWithReducers ? 0.5 : 1) * bal * rate / ceiling_price;
		}
	}
	return total_balance;
}

async function checkForFollowups() {
	console.log(`checking for followups`);
	const vars = aa_state.getAAStateVars(conf.friend_aa);

	for (let name in vars) {
		const m = name.match(/^friendship_(\w+)_([0-9A-Z]+)$/);
		if (m) {
			const address1 = m[1];
			const address2 = m[2];
			const bGhost = !isValidAddress(address1);
			const friendship = vars[name];
			if (!friendship.initial.accept_ts) {
				console.log(`not friends yet`, name);
				continue;
			}
			const elapsed_days = (Date.now() / 1000 - friendship.initial.accept_ts) / 3600 / 24;
			const { fu_reward_number, days } = getFollowupRewardInfo(elapsed_days, true);
			if (!fu_reward_number) continue;
			const rows = await db.query("SELECT 1 FROM sent_followup_notifications WHERE address1=? AND address2=? AND reward_number=?", [address1, address2, fu_reward_number]);
			if (rows.length > 0) {
				console.log(`${fu_reward_number} followup reward notification already sent to friends ${address1}-${address2}`);
				continue;
			}
			const total_balance1 = getUserTotalBalance(vars, address1);
			const total_balance2 = getUserTotalBalance(vars, address2);
			const rewards = {
				user1: {
					locked: Math.floor(total_balance1 * 0.01 * friendship.followup_reward_share),
					liquid: Math.floor(total_balance1 * 0.001 * friendship.followup_reward_share),
				},
				user2: {
					locked: Math.floor(total_balance2 * 0.01 * friendship.followup_reward_share),
					liquid: Math.floor(total_balance2 * 0.001 * friendship.followup_reward_share),
				},
			};

			const getText = (mention1, mention2) => {
				const both = mention1.includes(' user ') // reorder
					? `${mention2} and ${mention1}`
					: `${mention1} and ${mention2}`;
				const claimUrl = `${website}/followup/${address1}-${address2}`;
				if (bGhost)
					return `${mention2} you are eligible for your ${fu_reward_number} follow-up reward after becoming friends with the ghost of ${address1} ${days} days ago. You will receive ${rewards.user2.locked / 1e9} FRD to the locked account and ${rewards.user2.liquid / 1e9} liquid FRD tokens. Please claim the rewards at ${claimUrl} within 10 days, otherwise they'll be lost.`;
				else
					return `${both} you are eligible for your ${fu_reward_number} follow-up reward after becoming friends ${days} days ago. ${mention1} will receive ${rewards.user1.locked / 1e9} FRD to the locked account and ${rewards.user1.liquid / 1e9} liquid FRD tokens. ${mention2} will receive ${rewards.user2.locked / 1e9} FRD to the locked account and ${rewards.user2.liquid / 1e9} liquid FRD tokens. You both need to claim the rewards at ${claimUrl} within 10 minutes of each other, like you claimed your initial rewards. Please claim the rewards within 10 days, otherwise they'll be lost. Please message each other to agree when you send your claiming transactions.`;
			};

			await notify(address1, address2, getText);
			await db.query("INSERT INTO sent_followup_notifications (address1, address2, reward_number) VALUES (?,?,?)", [address1, address2, fu_reward_number]);
			console.log(`notified ${address1}-${address2} about the ${fu_reward_number} followup reward`);
		}
	}
	console.log(`done checking for followups`);
}


async function notifyAboutRewards(user1, user2, rewards, followup, days, ghost) {
	const key = (user1 < user2 ? (user1 + '-' + user2) : (user2 + '-' + user1)) + '-' + days;
	if (notifiedRewards[key])
		return console.log(`already notified ${key}`);
	if (followup) {
		var { fu_reward_number, next_days } = getFollowupRewardInfo(days);
		if (!fu_reward_number)
			throw Error(`unrecognized followup reward in ${days} days`);
	}
	const vars = aa_state.getAAStateVars(conf.friend_aa);
	const user1Info = vars['user_' + user1];
	const current_ghost_num = user1Info.current_ghost_num - 1; // it has just been incremented
	const required_streak = (current_ghost_num + 1) ** 2;

	const getRewardText = (user, referrer_reward) => {
		let text = `${user.locked / 1e9} FRD to the locked account and ${user.liquid / 1e9} liquid FRD`;
		if (user.new_user_reward)
			text += `, including new user reward ${user.new_user_reward / 1e9} FRD to the locked account`;
		if (user.referred_user_reward) // someone referred me and this is my first friendship
			text += `, including referred user reward ${user.referred_user_reward / 1e9} FRD to the locked account`;
		if (referrer_reward) // referrer reward is not included in .locked, that's why "plus"
			text += `, plus referrer reward ${referrer_reward / 1e9} FRD to the locked account`;
		return text;
	};

	const getText = (mention1, mention2) => {
		const both = mention1.includes(' user ') // reorder
			? `${mention2} and ${mention1}`
			: `${mention1} and ${mention2}`;
		if (followup) {
			let text = (
				ghost
					? `${mention1} you've just claimed your ${fu_reward_number} follow-up reward for becoming friends with the ghost of ${user2}, congratulations! You receive ${rewards.user1.locked / 1e9} FRD to your locked account and ${rewards.user1.liquid / 1e9} liquid FRD.`
					: `${both} you've claimed your ${fu_reward_number} follow-up rewards, congratulations! ${mention1} receives ${rewards.user1.locked / 1e9} FRD to the locked account and ${rewards.user1.liquid / 1e9} liquid FRD. ${mention2} receives ${rewards.user2.locked / 1e9} FRD to the locked account and ${rewards.user2.liquid / 1e9} liquid FRD.`
			);
			if (next_days)
				text += ` The next follow-up reward will be available in ${next_days - days} days.`;
			return text;
		}
		else {
			return (
				ghost
					? `${mention1} you've just become friends with the ghost of ${user2} after completing your ${required_streak}-day streak, congratulations! You receive ${rewards.user1.locked / 1e9} FRD to your locked account and ${rewards.user1.liquid / 1e9} liquid FRD.`
					: `${both} you've just become friends and claimed your rewards, congratulations! ${mention1} receives ${getRewardText(rewards.user1, rewards.referrers[user1])}. ${mention2} receives ${getRewardText(rewards.user2, rewards.referrers[user2])}.`
			) + ` The first follow-up reward will be available in 60 days.`;
		}
	};

	await notify(user1, user2, getText);
	notifiedRewards[key] = true;
}

async function watchDepositAssetsPools() {
	const vars = aa_state.getAAStateVars(conf.friend_aa);
	for (let name in vars) {
		const m = name.match(/^deposit_asset_(.+)$/);
		if (m) {
			const deposit_asset = m[1];
			const pool = vars[name];
			await aa_state.followAA(pool);
		}
	}
}

// wait until all the addresses added in addWatchedAddress() are processed
async function waitForUnprocessedAddresses() {
	while (true) {
		const rows = await db.query("SELECT address FROM unprocessed_addresses");
		if (rows.length === 0)
			return;
		console.log(`still have unprocessed addresses, will wait`, rows);
		await sleep(1000);
	}
}

async function startWatching() {
	await loadLibs();

	if (!conf.DISCORD_BOT_TOKEN) throw new Error('error: DISCORD_BOT_TOKEN is required');
	if (!conf.DISCORD_CHANNEL_ID) throw new Error('error: DISCORD_CHANNEL_ID is required');
	if (!conf.TELEGRAM_BOT_TOKEN) throw new Error('error: TELEGRAM_BOT_TOKEN is required');
	if (!conf.TELEGRAM_CHANNEL_USERNAME) throw new Error('error: TELEGRAM_CHANNEL_USERNAME is required');
	if (!conf.TELEGRAM_APPID) throw new Error('error: TELEGRAM_APPID is required');
	if (!conf.TELEGRAM_APIHASH) throw new Error('error: TELEGRAM_APIHASH is required');

	await discordInstance.login(conf.DISCORD_BOT_TOKEN);
	await telegramInstance.startBot();
	
	eventBus.on("aa_request_applied", onAARequest);
	eventBus.on("aa_response", onAAResponse);

	await aa_state.followAA(conf.friend_aa);
	await watchDepositAssetsPools();

	await light_wallet.waitUntilFirstHistoryReceived();
	console.log('first history received');

	for (let address in conf.attestors)
		walletGeneral.addWatchedAddress(address);
	walletGeneral.addWatchedAddress(conf.friend_aa);

	initAsset();
	
	await waitForUnprocessedAddresses(); // for update attestors history


	await checkForFollowups();
	setInterval(checkForFollowups, 12 * 3600_000);
}

exports.startWatching = startWatching;
