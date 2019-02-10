const expect    = require("chai").expect;
const rss = require("../lib/rss");

describe("RSS feed generation (calls made by bin/buildrsserv.js)", testBuildRSServ());

/*
 * components to be tested
 *
 * from bin/buildrsserver.js
 *    getFreshlySubscribed - db dependent - returns the new feeds users subscribed at
 *
 *    composeXMLfromFeed
 *        retrieveNewData - db dependent - returns the new post matching with the feed, within the timelimit
 *        composeXML
 */

function testBuildRSServ() {

    describe("getFreshlySubscribed", function() {
        it("retrieve data", function() {

            
        });

    });

};


describe("Color Code Converter", function() {
  describe("RGB to Hex conversion", function() {
    it("converts the basic colors", function() {
      var redHex   = converter.rgbToHex(255, 0, 0);
      var greenHex = converter.rgbToHex(0, 255, 0);
      var blueHex  = converter.rgbToHex(0, 0, 255);

      expect(redHex).to.equal("ff0000");
      expect(greenHex).to.equal("00ff00");
      expect(blueHex).to.equal("0000ff");
    });
  });

  describe("Hex to RGB conversion", function() {
    it("converts the basic colors", function() {
      var red   = converter.hexToRgb("ff0000");
      var green = converter.hexToRgb("00ff00");
      var blue  = converter.hexToRgb("0000ff");

      expect(red).to.deep.equal([255, 0, 0]);
      expect(green).to.deep.equal([0, 255, 0]);
      expect(blue).to.deep.equal([0, 0, 255]);
    });
  });

});

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
