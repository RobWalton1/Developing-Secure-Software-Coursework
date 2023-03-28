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
require('dotenv').config();

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

app.get('/home', tokenMiddleware, checkNotAuthenticated, (req, res) => {
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

//Adds posts to the table
app.post('/', (req, res) => {
    const title = req.body.title;
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
    let errors = [];

    //Validate that all inputs have had information passed to them
    if (!username) {
        errors.push({message: "Please enter a username"})
    } else if(!email) {
        errors.push({message: "Please enter an email"})
    } else if(!password) {
        errors.push({message: "Please enter a password"})
    } else if(!password2) {
        errors.push({message: "Please confirm your password"})
    }

    //Validate that the password matches the NIST standards
    if(password.length < 8) {
        errors.push({message: "Password must be at least 8 characters long"})
    }
    if (password == username) {
        errors.push({message: "Passwords can not match your username"})
    }
    if (password == email) {
        errors.push({message: "Passwords can not match your email"})
    }
    if (password != password2) {
        errors.push({message: "Passwords do not match"})
    }

    // Checks to see if password has passed validation
    if (errors.length > 0) {
        res.render("register", {errors})
    } else {
        // Generate the salt
        let salt = condiments.generateSalt(64)
        // Hash the password
        let hashedPassword = await bcrypt.hash(salt + password, 10)
        // Generate the secret for 2fa
        let userSecret = authenticator.generateSecret()
        pool.query('SELECT * FROM users WHERE username = $1 ',[username] ,(error, results) => {
            if (error) {
                throw error;
            } 
            if(results.rows.length > 0) {
                errors.push({message: "Username already registered"})
                res.render("register", {errors})
                
            } 
            pool.query('SELECT * FROM users WHERE email = $1 ',[email] ,(error, results) => {
                if (error) {
                    throw error;
                }
                if(results.rows.length > 0) {
                    errors.push({message: "Email already registered"})
                    res.render("register", {errors})
                    
                } 
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
            })
        });
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
    pool.query('SELECT email, secret FROM users WHERE username = $1 OR email = $2', [userLoginDetails, userLoginDetails], (error, result) => {
        if (error) {
            throw error;
        } 

        const user = result.rows[0];

        if (result.rows.length <= 0) {
            req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
            return res.redirect(returnUrl)
        }
    
        if (!authenticator.check(code, result.rows[0].secret)) {
            req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
            return res.redirect(returnUrl)
        }

          req.session.qr = null
          req.session.userLoginDetails = null
          isUserLoggedIn = true
          req.session.token = jwt.sign(user.email, process.env.TOKEN_SECRET)
    
          //redirect to "private" page
          return res.redirect('/home')
    });
}

async function authenticateLogin(userLoginDetails,password, code, req, res, returnUrl) {
    pool.query('SELECT email, password, salt, secret FROM users WHERE username = $1 OR email = $2', [userLoginDetails, userLoginDetails], (error, result) => {
        if (error) {
            throw error;
        } 

        if (result.rows.length <= 0) {
            req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
            return res.redirect(returnUrl)
        }
    
        const user = result.rows[0];
        const seasonedPassword = user.salt + password;
        bcrypt.compare(seasonedPassword, user.password, (error, isMatch) => {
            if (error) {
                throw error;
            } else if (!isMatch) {
                req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
                return res.redirect(returnUrl)
            } else {
                if (!authenticator.check(code, result.rows[0].secret)) {
                    req.flash('success_message', "The username, password and/or authentication code are incorrect. Please try again. ")
                    return res.redirect(returnUrl)
                }
    
                  req.session.qr = null
                  req.session.userLoginDetails = null
                  isUserLoggedIn = true
                  req.session.token = jwt.sign(user.email, process.env.TOKEN_SECRET)
            
                  //redirect to "private" page
                  return res.redirect('/home')
            }
        })
    });
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

