const { pool } = require("./dbConfig");

const saltCharacters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSalt(length) {
    let salt = '';
    const saltCharactersLength = saltCharacters.length;
    for ( let i = 0; i < length; i++ ) {
        salt += saltCharacters.charAt(Math.floor(Math.random() * saltCharactersLength));
    }

    return salt;
}

module.exports = {generateSalt}