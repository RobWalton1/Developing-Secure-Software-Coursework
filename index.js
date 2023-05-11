//Required modules
const express = require('express');
const app = express();
const { pool } = require("./dbConfig");
const bodyParser = require('body-parser');
const bcrypt = require("bcrypt");
const session = require('express-session');
const jwt = require('jsonwebtoken');
const { expressjwt: ejwt } = require("express-jwt");
const flash = require('express-flash');
const condiments = require("./condiments")
const { authenticator } = require('otplib')
const QRCode = require('qrcode');
const accountAuth = require('./accountAuthentication')
const crypto = require('crypto');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const clickJacking = require('./clickJacking');
const inputValidation = require('./inputValidation');
require('dotenv').config();

// Global varaible to keep track if a user is logged into the system
let isUserLoggedIn = false

//Local host port, Viewable on localhost:3000
const port = 3000;
const csrfProtection = csrf();

//Setting view engine to ejs
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(clickJacking);

//Prevents multiple types of clickjacking attacks
app.use(function(req, res, next) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});


//Generates secure session ID
function secureSessionId() {
    return crypto.randomBytes(64).toString('hex');
  }

//controls the session for the system, Session hijacking prevention methods are used.
app.use(session({
    secret: process.env.TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    genid: secureSessionId, // Uses the secure session ID function to generate a session ID
    rolling: true, //Regenerates the session ID on every request
    cookie: {
        secure: false, //Uses only secure cookies, KEEP SET TO FALSE WHEN RUNNING LOCALLY BUT SET TO TRUE WHEN RUNNING OVER HTTPS
        httpOnly: true, //Prevents client side JS from reading the cookie
        maxAge: 600000 // Limits the session lifetime to 10 minutes
      }
    }))

// Manages the token 
const tokenMiddleware = ejwt({
    secret: process.env.TOKEN_SECRET,
    algorithms: ['HS256'],
    getToken: (req) => {
      return req.session.token
    }
  })

//csrf
app.use(csrfProtection);

//Routes
app.get('/', (req, res) => {
    res.render('index', {
        csrfToken: req.csrfToken()
    });
    
});

app.get('/register', checkAuthenticated, (req, res) => {
    res.render('register', {csrfToken: req.csrfToken()});
});

app.get('/results', (req, res) => {
    res.render('results');
});

app.get('/register-2fa', (req, res) => {
    //Checks to see if a QR code has been generated before rendering this page
    console.log("Checking for qr code")
    if (!req.session.qr) {
        console.log("Redirected to home")
      return res.redirect('/')
      //console.log("No qr code found")
    }
    return res.render('register-2fa.ejs', { qr: req.session.qr, csrfToken: req.csrfToken()})
  })

app.get('/login', checkAuthenticated,(req, res) => {
    res.render('login', {csrfToken: req.csrfToken()});
});


app.get("/logout", tokenMiddleware ,(req, res) => {
    isUserLoggedIn = false
    req.flash('success_message', "You have logged out")
    req.session.destroy()
    res.redirect("/login")
})

app.get('/newPost', (req, res) => {
    res.render('newPost', {csrfToken: req.csrfToken()});
});

var globalPostID;
app.get('/editPost/:id' , csrfProtection, async (req, res) => {
    const postID = req.params.id;
    try {
        const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postID]);
        if (post.rows.length > 0) {
            const uploadedPost = post.rows[0];
            if (uploadedPost.user_id != req.session.user_id) {
                console.log("Hacking detected, user tried to edit a post that doesn't exist or not their post")
                res.redirect('/logout')
            }
            res.render('editPost', { uploadedPost: uploadedPost , csrfToken: req.csrfToken()});
            globalPostID = postID;
        }
        else {
            console.log("Hacking detected, user tried to edit a post that doesn't exist or not their post")
            res.redirect('/logout')
        }
    }
    catch (error) {
        console.log(error);
    }
});



// Selects all from the table and provides the route to the homepage, Don't be thick like me and have two routes so the sql query doesn't work
app.get('/home', checkNotAuthenticated, tokenMiddleware, (req, res) => {
    console.log(req.session); // log the session object to check the user ID key
    pool.query('SELECT * FROM posts ORDER BY date DESC', (error, result) => {
      if (error) {
        throw error;
      } else {
        res.render('home', { posts: result.rows, usersSessionID: req.session.user_id, csrfToken: req.csrfToken() });
      }
    });
  });

  //simple input sanitization function that removes html tags. add to all user input fields. using a library such as sanitizer-html would probably be better.
  function inputSanitizer(input)
  {
    const sanitized = input.replace(/<[^>]*>?/gm, '');
    return sanitized;
  }

  
  app.get("/", async (req, res) => {
    let results = {}
    results.rows = []
    try {
        const id = req.query.id;

        results = await pool.query(`select * from users where id = $1`, [id])
    }
    catch (e) {
        console.log("Error")
    }
    finally {
        res.setHeader("content-type", "application/json")
        res.send(JSON.stringify(results.rows))
    }
  })

//Adds posts to the table
app.post('/', (req, res) => {
    const title = inputSanitizer(req.body.title);
    const content = inputSanitizer(req.body.content);
    const user_id = inputSanitizer(req.session.user_id); 
    pool.query('INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3)', [title, content, user_id], (error, result) => {
        if (error) {
            throw error
        } else {
            res.redirect('/home');
        }
    });   
});

//Edits posts in the table
app.post('/updatePost', csrfProtection, (req, res) => {
    const title = inputSanitizer(req.body.title);
    const content = inputSanitizer(req.body.content);
    const user_id = req.session.user_id;
    const post_id = globalPostID;
    //SQL statement that modifys the post with the matching ID
    //Make sure user id = post user id first, log out if not
    pool.query('UPDATE posts SET title = $1, content = $2 WHERE id = $3 AND user_id = $4', [title, content, post_id, user_id], (error, result) => {
            if (error) {
                throw error
            } else {
                res.redirect('/home');
                console.log("Post updated")
            }
        });
    });

//Searches for posts by name
app.post('/search', (req, res) => {
    const search = inputSanitizer(req.body.search);
    pool.query('SELECT * from posts WHERE title = $1', [search], (error, result) => {
        if (error) {
            throw error
        } else {
            res.render('results', { posts: result.rows, usersSessionID: req.session.user_id ,csrfToken: req.csrfToken()});
        }
    });
});

//Deletes posts from the table
app.post('/deletePost' , csrfProtection, (req, res) => {
    const post_id = inputSanitizer(req.body.post_id);
    pool.query("DELETE FROM posts WHERE id = $1", [post_id], (error, result) => {
        if (error) {
            throw error
        } else {
            res.redirect('/home');
        }
    });
});



app.post('/register', csrfProtection, async (req, res) => {
    let {username, email, password, password2} = req.body;
    email = inputSanitizer(email.toLowerCase())

    //Validate that all inputs have had information passed to them and that the password matches NIST standarsd
    let errors = await accountAuth.validateInput(username, email, password, password2)

    // Checks to see if password has passed validation
    if (errors.length > 0) {
        res.render("register",{errors, csrfToken: req.csrfToken()})
    } else {
        // Generate the salt
        let salt = condiments.generateSalt(64)
        // Hash the password
        let hashedPassword = await bcrypt.hash(salt + password, 10)
        // Generate the secret for 2fa
        let userSecret = authenticator.generateSecret()
        
        //Verify that no other user is currently using that username
        if(await accountAuth.uniqueUsername(username)) {
            errors.push("Username already registered")
            res.render("register", {errors, csrfToken: req.csrfToken()})
        //Verify that no other user is currently using email
        } else if(await accountAuth.uniqueEmail(email)){
            errors.push("Email already registered")
            res.render("register", {errors, csrfToken: req.csrfToken()})
        } else {
            pool.query("INSERT INTO users (username, email, password, salt, secret) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [username, email, hashedPassword, salt, userSecret], (error, results) => {
                if (error) {
                    throw error
                } 
                //Generate a QR code and store this in session
                QRCode.toDataURL(authenticator.keyuri(email, 'DSS Blog', userSecret), (err, url) => {
                    if (err) {
                        throw err
                    }
                    console.log("Made it this far")
                    req.session.qr = url
                    req.session.userLoginDetails = username

                    res.redirect('/register-2fa')
                    })
            } ) 
        }
    }
});

app.post('/register-2fa', csrfProtection, (req, res) => {
    if (!req.session.userLoginDetails) {
      return res.redirect('/')
    }
    const userLoginDetails = req.session.userLoginDetails,
        userPassword = req.body.password,
        code = req.body.code
    return authenticateRegister(userLoginDetails, code, req, res, '/register-2fa')
  })

  app.post('/login', csrfProtection, (req, res) => {

    const userLoginDetails = inputSanitizer(req.body.username);
    const userPassword = inputSanitizer(req.body.password);
    const code = inputSanitizer(req.body.authenticationCode);

    if (!inputValidation.commonSqlPhrases(userLoginDetails)) {
        return res.status(400).json({err:"SQL Injection Detected in USERNAME"})
    } else if (!inputValidation.commonSqlPhrases(userPassword)) {
        return res.status(400).json({err:"SQL Injection Detected in PASSWORD"})
    } else if (!inputValidation.commonSqlPhrases(code)) {
        return res.status(400).json({err:"SQL Injection Detected in CODE"})
    } else if (!inputValidation.numbersOnly(code)) {
        return res.status(400).json({err:"Non-Numeric Characters in CODE"})
    } else {
        console.log("Success!")
    }
    authenticateLogin(userLoginDetails, userPassword, code, req, res, '/login', () => {
        pool.query("SELECT id FROM users WHERE username = $1", [userLoginDetails], (error, results) => {
            if (error) {
                throw error;
            } else {
                //Code modified to allow for the user id to be stored in the session
                const userID = results.rows[0].id;
                req.session.user_id = userID;
                res.redirect('/home');
            }
        });
    });
});

async function authenticateRegister(userLoginDetails, code, req, res, returnUrl) {
    const { rows } = await pool.query('SELECT email, secret FROM users WHERE username = $1', [userLoginDetails])

    if (rows.length <= 0) {
        req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
        return res.redirect(returnUrl)
    }

    if (!authenticator.check(code, rows[0].secret)) {
        req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
        return res.redirect(returnUrl)
    }

    req.session.qr = null
    req.session.userLoginDetails = null
    isUserLoggedIn = true
    req.session.token = jwt.sign(rows[0].email, process.env.TOKEN_SECRET)

    //redirect to "private" page

    return res.redirect('/home')
    
}

async function authenticateLogin(userLoginDetails,password, code, req, res, returnUrl, callback = () => {}) {
    const { rows } = await pool.query('SELECT email, password, salt, secret FROM users WHERE username = $1', [ userLoginDetails])
    //Creating a delay between 100ms and 1500ms for account enumeration prevention
    var delay = Math.floor(Math.random() * 100) + 1400;
    await new Promise(resolve => setTimeout(resolve, delay));
    if (rows.length <= 0) {
        req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
        return res.redirect(returnUrl)
    }
    const seasonedPassword = rows[0].salt + password;
    bcrypt.compare(seasonedPassword, rows[0].password, (error, isMatch) => {
        if (error) {
            throw error;
        } else if (!isMatch) {
            req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
            return res.redirect(returnUrl)
        } else {
            if (!authenticator.check(code, rows[0].secret)) {
                req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
                return res.redirect(returnUrl)
            }
            req.session.qr = null
            req.session.userLoginDetails = null
            isUserLoggedIn = true
            req.session.token = jwt.sign(rows[0].email, process.env.TOKEN_SECRET)
            //Changed from redirect to callback to allow for user ID to be stored in session
            callback()
        }
    })
}

//If user trys to access a page that requires to not be logged in, then they will be redirected to the homepage
function checkAuthenticated(req, res, next) {
    //check if a user has been authenticated - new variable for session?
    if (isUserLoggedIn) {
        return res.redirect('/home')
    } else {
        next();
    }
}

//If user trys to access a page that requires login then they will be redirected to login
function checkNotAuthenticated(req, res, next) {
    if (isUserLoggedIn) {
        return next();
    } else {
        res.redirect("/login")
    }
}
module.exports = inputSanitizer;


//Krystians functions//////////////////////////////////////////////////////////////////////////
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
function emailValidation(email) {
    var re = /\S+@\S+\.\S+/;

    return re.test(email);
}


//Krystians functions//////////////////////////////////////////////////////////////////////////



//Starts the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});