CREATE TABLE IF NOT EXISTS sent_followup_notifications (
	address1 VARCHAR(50) NOT NULL,
	address2 CHAR(32) NOT NULL,
	reward_number CHAR(4) NOT NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (address1, address2)
);

-- query separator
CREATE TABLE IF NOT EXISTS user_ghosts (
    address CHAR(32) NOT NULL PRIMARY KEY,
    ghost_name VARCHAR(40) DEFAULT NULL
);

-- query separator
CREATE TABLE IF NOT EXISTS user_balances (
	address CHAR(32) NOT NULL,
	trigger_unit CHAR(44) NOT NULL,
	event VARCHAR(10) NOT NULL,
	total_balance_with_reducers DOUBLE NOT NULL,
	total_balance_sans_reducers DOUBLE NOT NULL,
	locked_reward INT NOT NULL DEFAULT 0,
	liquid_reward INT NOT NULL DEFAULT 0,
	new_user_reward INT NOT NULL DEFAULT 0,
	referral_reward INT NOT NULL DEFAULT 0,
	is_stable TINYINT NOT NULL DEFAULT 0,
	trigger_date TIMESTAMP NOT NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (trigger_unit, address)
);
-- query separator
CREATE INDEX IF NOT EXISTS byAddressTs ON user_balances(address, trigger_date);
