'use strict';

const AWS = require('aws-sdk');
const url = require('url');
const https = require('https');

const kmsEncryptedHookUrl = process.env.kmsEncryptedHookUrl;
const slackChannel = process.env.slackChannel;
let hookUrl = process.env.hookUrl;

function postMessage(message, callback) {
    const body = JSON.stringify(message);
    const options = url.parse(hookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    };

    const postReq = https.request(options, (res) => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            if (callback) {
                callback({
                    body: chunks.join(''),
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                });
            }
        });
        return res;
    });

    postReq.write(body);
    postReq.end();
}

function processEvent(event, callback) {
    console.log(event.Records[0].Sns.Message);
    const message = event.Records[0].Sns.Message;

    const slackMessage = {
        channel: slackChannel,
        text: message,
    };

    postMessage(slackMessage, (response) => {
        if (response.statusCode < 400) {
            console.info('Message posted successfully');
            callback(null);
        } else if (response.statusCode < 500) {
            console.error(`Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`);
            callback(null);  // Don't retry because the error is due to a problem with the request
        } else {
            // Let Lambda retry
            callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
        }
    });
}


exports.handler = (event, context, callback) => {
    if (hookUrl) {
        // Container reuse, simply process the event with the key in memory
        processEvent(event, callback);
    } else if (kmsEncryptedHookUrl && kmsEncryptedHookUrl !== '<kmsEncryptedHookUrl>') {
        const encryptedBuf = new Buffer(kmsEncryptedHookUrl, 'base64');
        const cipherText = { CiphertextBlob: encryptedBuf };

        const kms = new AWS.KMS();
        kms.decrypt(cipherText, (err, data) => {
            if (err) {
                console.log('Decrypt error:', err);
                return callback(err);
            }
            hookUrl = `https://${data.Plaintext.toString('ascii')}`;
            processEvent(event, callback);
        });
    } else {
        callback('Hook URL has not been set.');
    }
};

