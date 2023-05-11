const crypto = require('crypto');
const algorithmUsed = 'aes-256-cbc';
const key = crypto.randomBytes(32);
//Function to decrypt the data from our postgres database
function decryption(text) {
    const iv = Buffer.from(parts.shift(), 'hex');
    const parts = text.split(':');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithmUsed, key, iv);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
  }
//Function to encrypt the data from our postgres database
function encryption(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithmUsed, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
module.exports = { decryption, encryption };