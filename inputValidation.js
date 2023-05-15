//Required modules
const { pool } = require("./dbConfig");
require('dotenv').config();

//Regex function for testing that the input has only numbers
function numbersOnly(input) {
    var numbers = /^[0-9]+$/;

    return numbers.test(input);
}

//Regex function for testing that the input isn't empty or contains whitespace characters
function ifEmpty(input) {
    var empty = /^\s*$/

    return empty.test(input);

}

//Regex function for testing if the entered email is correct
function emailValidation(input) {
    var email = /\S+@\S+\.\S+/;

    return email.test(input);
}

function commonSqlPhrases(input) {
    const orInjection = /(\s*OR\s*\d+\s*=\s*\d+)/i;

    const sqlPhrases = [
        "SELECT", "UPDATE", "DELETE", "INSERT", "DROP", "UNION", "AND", "WHERE",
        "JOIN", "FROM", "EXEC", "DECLARE", "ALTER", "CREATE", "HAVING",
        "INTO", "LIKE", "TABLE", "VALUES", "EXECUTE", "FETCH",
        "MERGE", "DECLARE", "--", ";", "'", "(' OR 1=1)", 
      ];
    
      const sqlArray = new RegExp(sqlPhrases.concat(orInjection).join("|"), "i");
      return !sqlArray.test(input);
   
}

module.exports = {numbersOnly, ifEmpty, emailValidation, commonSqlPhrases}