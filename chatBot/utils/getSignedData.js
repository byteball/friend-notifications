const { isValidAddress } = require('ocore/validation_utils');

module.exports = async (deviceAddress, dataString) => {
    const validation = require('ocore/validation.js');

    if (typeof dataString !== 'string') {
        throw new Error('Expected data to be a string');
    }

    const arrSignedMessageMatches = dataString.match(/\(signed-message:(.+?)\)/);

    if (!arrSignedMessageMatches || arrSignedMessageMatches.length < 2) throw new Error('Invalid format');

    const signedMessageBase64 = arrSignedMessageMatches[1];
    const signedMessageJson = Buffer.from(signedMessageBase64, 'base64').toString('utf8');
    let objSignedMessage;

    try {
        objSignedMessage = JSON.parse(signedMessageJson);
    } catch (err) {
        throw new Error('Failed to parse signed message JSON');
    }

    return new Promise((resolve, reject) => {
        validation.validateSignedMessage(objSignedMessage, async err => {
            if (err) return reject({ error: 'Signature validation failed' });

            if (!objSignedMessage.authors || objSignedMessage.authors.length === 0) {
                return reject({ error: 'Validation failed' });
            }

            const { signed_message, authors: [{ address: senderWalletAddress }] } = objSignedMessage;

            try {
                const messageSplit = signed_message.trim().split(".");

                const message = messageSplit[0].trim();
                let data = {};
                
                if (messageSplit.length > 1) {
                    const dataArray = messageSplit[1].trim().replace(" And I select ghost: ", "").trim().split(", ");

                    dataArray.forEach(dataItem => {
                        const dataItemSplit = dataItem.split(":");
                        data[dataItemSplit[0].trim().replace("And I select ghost", "name")] = dataItemSplit[1].trim();
                    });
                }

                let attestationWalletAddress = data?.address;

                if (message && message.includes('I own the address:')) {
                    attestationWalletAddress = message.replace('I own the address: ', '').trim();

                    if (!isValidAddress(attestationWalletAddress)) {
                        return reject({ error: 'Invalid format' });
                    }
                }

                return resolve({ message, data, senderWalletAddress, attestationWalletAddress, deviceAddress });
            } catch (err) {
                console.error('Error in signed message:', err);
                reject({ error: 'Unknown error! Please try again.' });
            }
        });
    });
}