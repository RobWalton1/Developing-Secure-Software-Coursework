//Required modules
const express = require('express');
const app = express();
const ejs = require('ejs');

//Local host port, Viewable on localhost:3000
const port = 3000;

//Setting view engine to ejs
app.set('view engine', 'ejs');


//Will set up db connection here soon


//Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/home', (req, res) => {
    res.render('home');
});


//Starts the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});