const accountAuth = require('../accountAuthentication.js')
const assert = require('assert').strict;
require('dotenv').config();

describe('Testing new password validation', function() {
    it("Test should not allow null values", function(){
        assert.notEqual(accountAuth.validateInput(), []);
    });
    it("Test should not allow passwords less then 8 characters long", function(){
        assert.notEqual(accountAuth.validateInput(username="Jim123", email="jim@gmail.com", password="abcdef", password2="abcdef"), []);
    });
    it("Test should not accept passwords that match the username", function(){
        assert.notEqual(accountAuth.validateInput(username="Jim123", email="jim@gmail.com", password="Jim123", password2="Jim123"), []);
    });
    it("Test should not accept passwords that match an email", function(){
        assert.notEqual(accountAuth.validateInput(username="Jim123", email="jim@gmail.com", password="jim@gmail.com", password2="jim@gmail.com"), []);
    });
    it("Test should not allow passwords that don't match", function(){
        assert.notEqual(accountAuth.validateInput(username="Jim123", email="jim@gmail.com", password="jim123", password2="jim1234"), []);
    });
});

describe('Testing unique functions', function() {
    it("Test should return false as username doesn't exisit", () => {
        return accountAuth.uniqueUsername("testUsernameFalse").then(result => {
          assert.equal(result, false);
        });
      });

    it("Test should return true as username exisits", () => {
        return accountAuth.uniqueUsername("testUsernameTrue").then(result => {
          assert.equal(result, true);
        });
      });

      it("Test should return false as email doesn't exisit", () => {
        return accountAuth.uniqueEmail("testUsernameFalse@gmail.com").then(result => {
          assert.equal(result, false);
        });
      });

      it("Test should return true as email exisits", () => {
        return accountAuth.uniqueEmail("testUsernameTrue@gmail.com").then(result => {
          assert.equal(result, true);
        });
      });

});