require('dotenv').config();
const pg = require('pg');

const pool = new pg.Pool({
    user: 'postgres',
    password: 'password',
    host: 'localhost',
    port: 5432,
    database: 'secureSoftware',
    
});

module.exports = { pool };