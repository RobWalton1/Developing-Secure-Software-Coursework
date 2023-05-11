const inputValidation = require('../inputValidation.js');
const assert = require('assert');
require('dotenv').config();

describe('Testing email validation', function() {
    it("If input is valid it returns true and test is successful", function(){
        assert.equal(inputValidation.emailValidation("krys@gmail.com"), true);
    });
    it("If input is not valid it returns false and test is successful", function(){
        assert.equal(inputValidation.emailValidation("krys@gmail"), false);
    });
    it("If input consists of only numeric characters it returns true and test is successful", function(){
        assert.equal(inputValidation.numbersOnly("15342122"), true);
    });
    it("If input consists of any non-numeric characters it returns false and test is successful", function(){
        assert.equal(inputValidation.numbersOnly("432saw213"), false);
    });
    it("If input is empty or containts only whitespaces it returns true and test is successful", function(){
        assert.equal(inputValidation.ifEmpty("  "), true);
    });
    it("If input is not empty or contains any characters it returns false and test is succesful", function(){
        assert.equal(inputValidation.ifEmpty("testing"), false);
    });
    it("If input consists of any common sql phrases it returns true and test is successful", function(){
        assert.equal(inputValidation.commonSqlPhrases("(OR 1=1)"), true);
    });
    it("If input does not consist of any common sql phrases it returns false and test is successful", function(){
        assert.equal(!inputValidation.commonSqlPhrases("testing"), false);
    });
});