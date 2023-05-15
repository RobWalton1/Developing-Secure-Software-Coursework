const clickJacking = require('../clickJacking.js');
const assert = require('assert');
require('dotenv').config();

describe('Testing ClickJacking', function() {
    let req, res;

    this.beforeEach(() => {
        req = {};
        res = {
            headers: {},
            setHeader: function(name, value) {
                this.headers[name] = value;
            }
        };
        clickJacking(req, res, () => {});
    });

    it("X-Frame-Options header set to SAMEORIGIN", () => {
        assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
    });

    it("X-Content-Type-Options header set to nosniff", () => {
        assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    });

    it("Content-Security-Policy header set to frame-ancestors 'self'", () => {
        assert.equal(res.headers['Content-Security-Policy'], "frame-ancestors 'self'");
    });

});