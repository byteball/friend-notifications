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
                const message = signed_message.trim();
                let data = {};


                const dataArray = message.trim().replace("choose ", "").replace(" as ", "_").replace(" future friend", "").trim().split("_");

                data = {
                    name: dataArray[0],
                    address: dataArray[1]
                };

                if (dataArray.length !== 2 || isValidAddress(dataArray[1]) === false) {
                    return reject({ error: 'Invalid message format' });
                } else if (data.address !== senderWalletAddress) {
                    return reject({ error: 'Address in message does not match sender address' });
                }

                return resolve({ message, data, walletAddress: data.address, deviceAddress });
            } catch (err) {
                console.error('Error in signed message:', err);
                reject({ error: 'Unknown error! Please try again.' });
            }
        });
    });
}