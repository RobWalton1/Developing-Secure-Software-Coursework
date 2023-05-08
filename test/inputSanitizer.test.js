const assert = require('assert');
const inputSanitizer = require('../index.js');

describe('inputSanitizer', function()
{
    it('Should return a string that has had html tags removed', function()
    {
        const input = '<script>alert("Hacked!");</script>';
        const expectedOutput = 'alert("Hacked!");';
        assert.equal(inputSanitizer(input),expectedOutput);
    });
});module.exports = inputSanitizer;