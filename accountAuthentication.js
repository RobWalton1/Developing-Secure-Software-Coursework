//Required modules
const { pool } = require("./dbConfig");
const { ifEmpty, emailValidation } = require("./inputValidation");

require('dotenv').config();

async function validateInput(username=null, email=null, password=null, password2=null) {
    errors = []
    if (!username) {
        errors.push("Please enter a username")
    } else if(!email) {
        errors.push("Please enter an email")
    } else if(!password) {
        errors.push("Please enter a password")
    } else if(!password2) {
        errors.push("Please confirm your password")
    }
    if(password.length < 8) {
        errors.push("Password must be at least 8 characters long")
    }
    if (password == username) {
        errors.push("Passwords can not match your username")
    }
    if (password == email) {
        errors.push("Passwords can not match your email")
    }
    if (password != password2) {
        errors.push("Passwords do not match")
    }
    if (!emailValidation(email)) {
        errors.push("Email is not valid")
    }
    if (ifEmpty(username)) {
        errors.push("Username is empty or only contains whitespaces")
    }
    if (ifEmpty(password)) {
        errors.push("Password is empty or only contains whitespaces")
    }
    if (ifEmpty(password2)) {
        errors.push("Confirm Password is empty or only contains whitespaces")
    }
    if (ifEmpty(email)) {
        errors.push("Email is empty or only contains whitespaces")
    }
    return errors
}
   
async function uniqueUsername(username) {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 ',[username])
        if(rows.length > 0) {
            return true
        } 
        return false
    
}

async function uniqueEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 ',[email]) 
        if(rows.length > 0) {
            return true
        } 
        return false
    
}

module.exports = {validateInput, uniqueUsername, uniqueEmail}