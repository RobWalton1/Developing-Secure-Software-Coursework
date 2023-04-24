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
require('dotenv').config();

// Global varaible to keep track if a user is logged into the system
let isUserLoggedIn = false

//Local host port, Viewable on localhost:3000
const port = 3000;

//Setting view engine to ejs
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(flash());

//controls the session for the system
app.use(session({
    secret: process.env.TOKEN_SECRET,
    resave: false,
    saveUninitialized: false

}))

// Manages the token 
const tokenMiddleware = ejwt({
    secret: process.env.TOKEN_SECRET,
    algorithms: ['HS256'],
    getToken: (req) => {
      return req.session.token
    }
  })

//Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', checkAuthenticated, (req, res) => {
    res.render('register');
});

app.get('/register-2fa', (req, res) => {
    //Checks to see if a QR code has been generated before rendering this page
    if (!req.session.qr) {
      return res.redirect('/')
    }
    return res.render('register-2fa.ejs', { qr: req.session.qr })
  })

app.get('/login', checkAuthenticated,(req, res) => {
    res.render('login');
});

app.get('/home', checkNotAuthenticated, tokenMiddleware, (req, res) => {
    res.render('home');
});

app.get("/logout", tokenMiddleware ,(req, res) => {
    isUserLoggedIn = false
    req.flash('success_message', "You have logged out")
    req.session.destroy()
    res.redirect("/login")
})

app.get('/newPost', (req, res) => {
    res.render('newPost');
});

// Selects all from the table and provides the route to the homepage, Don't be thick like me and have two routes so the sql query doesn't work
app.get('/home', (req, res) => {
    pool.query('SELECT * FROM posts ORDER BY date DESC', (error, result) => {
      if (error) {
        throw error;
      } else {
        res.render('home', { posts: result.rows });
      }
    });
  });

const {body, validationResult } = require('express-validator');
app.post('/', [

    body('title')
        .notEmpty().withMessage('Title missing')
        .isLength({max: 50}).withMessage('Title must be 50 characters or less')
        .blacklist('<>').withMessage('Invalid character (<>)'),
    
    body('content')
        .notEmpty().withMessage('Content missing')
        .isLength({max: 250}).withMessage('Content must be 250 characters or less')
        .blacklist('<>').withMessage('Invalid character (<>)'),
], (req, res) => 
{
    const error = validationResult(req)
    if (!error.isEmpty())
    {
        //return res.status(400).json({error: error.array()});
        return res.render('error',{error: error.array()});
    }
    const title = req.body.title
    const content = req.body.content;
    
    pool.query('INSERT INTO posts (title, content) VALUES ($1, $2)', [title, content], (error, result) => {
        if (error) {
            throw error
        } else {
            res.redirect('/home');
        }
    });
});



app.post('/register', async (req, res) => {
    let {username, email, password, password2} = req.body;
    email = email.toLowerCase()

    //Validate that all inputs have had information passed to them and that the passsword matches NIST standarsd
    let errors = await accountAuth.validateInput(username, email, password, password2)

    // Checks to see if password has passed validation
    if (errors.length > 0) {
        res.render("register", errors)
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
            res.render("register", {errors})
        //Verify that no other user is currently using email
        } else if(await accountAuth.uniqueEmail(email)){
            errors.push("Email already registered")
            res.render("register", {errors})
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
                    req.session.qr = url
                    req.session.userLoginDetails = username

                    res.redirect('/register-2fa')
                    })
            } ) 
        }
    }
});


app.post('/register-2fa', (req, res) => {
    if (!req.session.userLoginDetails) {
      return res.redirect('/')
    }
  
    const userLoginDetails = req.session.userLoginDetails,
        userPassword = req.body.password,
        code = req.body.code
    return authenticateRegister(userLoginDetails, code, req, res, '/register-2fa')
  })

app.post('/login', (req, res) => {
    //verify login
    const userLoginDetails = req.body.username,
        userPassword = req.body.password,
        code = req.body.authenticationCode
    return authenticateLogin(userLoginDetails, userPassword, code, req, res, '/login')
  })

async function authenticateRegister(userLoginDetails, code, req, res, returnUrl) {
    const { rows } = await pool.query('SELECT email, secret FROM users WHERE username = $1 OR email = $2', [userLoginDetails, userLoginDetails])

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

async function authenticateLogin(userLoginDetails,password, code, req, res, returnUrl) {
    const { rows } = await pool.query('SELECT email, password, salt, secret FROM users WHERE username = $1 OR email = $2', [userLoginDetails, userLoginDetails])
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
    
            //redirect to "private" page
            return res.redirect('/home')
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

//Starts the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

