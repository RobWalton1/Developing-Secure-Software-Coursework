//Required modules
const express = require('express');
const app = express();
const { pool } = require("./dbConfig");
const ejs = require('ejs');
const pg = require('pg');
const bodyParser = require('body-parser');
const bcrypt = require("bcrypt");
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');

//Setting up stirage of a users login details
const initializePassport = require("./passportConfig")
initializePassport(passport)

//Local host port, Viewable on localhost:3000
const port = 3000;

//Setting view engine to ejs
app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({ extended: false }));

//secret needs to be updated for security purposes or rebuild not using this library
//controlls the session for the system
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false

}))

app.use(passport.initialize())
app.use(passport.session())

app.use(flash());

//Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', checkAuthenticated, (req, res) => {
    res.render('register');
});

app.get('/login', checkAuthenticated,(req, res) => {
    res.render('login');
});

app.get('/home', checkNotAuthenticated, (req, res) => {
    res.render('home');
});

app.get("/logout", (req, res) => {
    req.logOut(function(err) {
        if (err) {
            return next(err);
        } else {
            req.flash('success_message', "You have logged out")
            res.redirect("/login")
        }
    });

})

app.get('/newPost', (req, res) => {
    res.render('newPost');
});

// Selects all from the table and provides the route to the homepage, Don't be thick like me and have two routes so the sql query doesn't work
app.get('/home', (req, res) => {
    pool.query('SELECT * FROM posts ORDER BY date DESC', (error, result) => {
      if (error) {
        console.log(error);
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
            console.log(error);
        } else {
            res.redirect('/home');
        }
    });
});

app.post('/register', async (req, res) => {
    let {username, email, password, password2} = req.body;

    console.log(
        username,
        email,
        password,
        password2
    )
    let errors = [];

    //Password validation
    if (!username) {
        errors.push({message: "Please enter a username"})
    } else if(!email) {
        errors.push({message: "Please enter an email"})
    } else if(!password) {
        errors.push({message: "Please enter a password"})
    } else if(!password2) {
        errors.push({message: "Please confirm your password"})
    }
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
        let hashedPassword = await bcrypt.hash(password, 10)
        pool.query('SELECT * FROM users WHERE username = $1 ',[username] ,(error, results) => {
            if (error) {
                console.log(error);
            } else {
                if(results.rows.length > 0) {
                    errors.push({message: "Username already registered"})
                    res.render("register", {errors})
                    
                } else {
                    pool.query('SELECT * FROM users WHERE email = $1 ',[email] ,(error, results) => {
                        if (error) {
                            console.log(error);
                        } else {
                            if(results.rows.length > 0) {
                                errors.push({message: "Email already registered"})
                                res.render("register", {errors})
                                
                            } else {
                                pool.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, password",
                                [username, email, hashedPassword], (error, results) => {
                                    if (error) {
                                        throw error
                                    } else {
                                        console.log(results.rows)
                                        req.flash('success_message', "You are now registered. Please login")
                                        res.redirect('/login')
                                    }
                                } )
                            }
                        }
                    })
                }
            }
        });
    }
});

app.post("/login", passport.authenticate('local', {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: true
}))

//If user trys to access a page that requires to not be logged in, then they will be redirected to the homepage
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/home')
    } else {
        next();
    }
}

//If user trys to access a page that requires login then they will be redirected to login
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect("/login")
    }
}

//Starts the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

