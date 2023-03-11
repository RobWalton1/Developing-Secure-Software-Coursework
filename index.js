//Required modules
const express = require('express');
const app = express();
const ejs = require('ejs');
const pg = require('pg');
const bodyParser = require('body-parser');

//Local host port, Viewable on localhost:3000
const port = 3000;

//Setting view engine to ejs
app.set('view engine', 'ejs');


//Creating connection to database, edit here if needed
const pool = new pg.Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'secureSoftware',
    password: 'password',
    port: 5432,
});

app.use(bodyParser.urlencoded({ extended: true }));

//Routes
app.get('/', (req, res) => {
    res.render('index');
});

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


//Starts the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});