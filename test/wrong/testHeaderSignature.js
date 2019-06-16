const assert = require('assert');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const encodeToBase58 = require('../lib/utils').encodeToBase58;
const stringToArray = require('../lib/utils').stringToArray;


function generateRequestFromBody(body) {
    const keypair = nacl.sign.keyPair();
    const signature = nacl.sign.detached(stringToArray(body), keypair.secretKey);

    return {
        headers: {
            'x-fbtrex-userid': 31337, // eh eh eh
            'x-fbtrex-publickey': encodeToBase58(keypair.publicKey),
            'x-fbtrex-signature': encodeToBase58(signature)
        },

        body: body
    };
}

describe('Signature validation', function () {
    it('accepts a valid payloads signature', function () {
        const verifyRequestSignature = require('../lib/utils').verifyRequestSignature;
        const req = generateRequestFromBody('hurr durr hello internets');

        assert.equal(verifyRequestSignature(req), true);
    });

    it('rejects invalid payload signature', function () {
        const verifyRequestSignature = require('../lib/utils').verifyRequestSignature;
        const req = generateRequestFromBody('hurr durr hello internets');
        req.body = 'hurr durr hello internet'; // removing the last 's'

        assert.equal(verifyRequestSignature(req), false);
    });
});
