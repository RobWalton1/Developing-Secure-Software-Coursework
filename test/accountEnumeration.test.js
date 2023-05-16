const assert = require('assert');
const request = require('supertest');
const app = require('../index.js')

describe('Account Enumeration test', () => {
    it('should return generic message', function(){
        const username = 'test';
        const password = 'pass';
        const authCode = '1234';
        request(app)
        .post('/login')
        .send({username, password, authenticationCode: authCode})
        .end((err, res) => {
        assert.equal(res.body.message, 'The username, password and/or authentication code are incorrect. Please try again. ');
        done(err)
    });
});
});
