const assert = require('assert');
const request = require('supertest');
const app = require('../index.js')

describe('Testing session hijacking is working', function() {
    it('Test should check that all prevention methods are working.', function() {
        request(app)
        .get('/')
        .end((err, res) => {
            if (err) return done(err);
            const cookie = res.header['set-cookie'];
            assert.equal(cookie[0].includes('HttpOnly'), true);
            assert.equal(cookie[0].includes('Secure'), true);
            assert.equal(cookie[0].includes('SameSite'), true);
            assert.equal(cookie[0].includes('max-age'), true);
            done();
        });
    });
});