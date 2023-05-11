//Required modules
const { pool } = require("./dbConfig");
require('dotenv').config();

//This function sets 3 different headers to a specific setting to prevent multiple types of clickJacking on all pages
async function clickJackingHeaders(req, res, next) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    next();
}

module.exports = clickJackingHeaders;