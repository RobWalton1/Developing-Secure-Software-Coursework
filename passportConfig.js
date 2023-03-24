const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const { authenticate } = require("passport");


function initalize (passport) {
    const authenticateUser = (username, password, done) => {
        pool.query(
            'SELECT * FROM users WHERE username = $1', [username], (error, results) => {
                if (error) {
                    throw error;
                } else {
                    console.log(results.rows)
                    if (results.rows.length > 0) {
                        const user = results.rows[0];

                        bcrypt.compare(password, user.password, (error, isMatch) => {
                            if (error) {
                                throw error;
                            } else if (isMatch) {
                                return done(null, user)
                                //Password does not match the stored password for this username
                            } else {
                                return done(null, false, {message: "Username and/or Password do not match"})
                            }
                        })
                    } else {
                        //This username doers not exisit in our database
                        return done(null, false, {message: "Username and/or Password do not match"})
                    }
                }
            }
        )
    }
    passport.use(
        new LocalStrategy({
            usernameField: "username",
            passwordField: "password"
        },
        authenticateUser)
    );

    passport.serializeUser((user, done) => done(null, user.id));

    passport.deserializeUser((id, done) => {
        pool.query(
            "SELECT * FROM users WHERE id = $1", [id], (error, results) => {
                if (error) {
                    throw error
                } else {
                    return done(null, results.rows[0])
                }
            }
        )
    })
}

module.exports = initalize