const accountAuth = require('./accountAuthentication')
import assert from 'node:assert/strict';

describe('Testing new password validation', function() {
    it("Test should not allow null values", function(){
        assert.notEqual(accountAuth.validateInput(), []);
    });
});
