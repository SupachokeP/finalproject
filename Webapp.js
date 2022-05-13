const express = require('express');
const app = express();
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cv = require('opencv4nodejs');
const path = require('path');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const fs = require('fs');
const { throws } = require('assert');
const { NULL } = require('mysql/lib/protocol/constants/types');
const FPS = 30;
const wCap = new cv.VideoCapture(0);
wCap.set(cv.CAP_PROP_FRAME_WIDTH, 640);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 480);
app.use('/audio', express.static(__dirname + '/audio'));

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'patient'
});

connection.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});



app.get('/', function(req, res) {
    var time = new Date();
    var morntime = new Date(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate(), 8, 0, 0);
    var lanuchtime = new Date(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate(), 12, 0, 0);
    var eventime = new Date(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate(), 18, 0, 0);
    var sleeptime = new Date(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate(), 20, 0, 0);
    connection.query('SELECT * FROM patient', (err, result) => {
        res.render('monitor', {
            posts: result,
        });
    })
});

app.get('/stream', function(req, res) {
    const file = __dirname + '/audio/alarm.mp3';
    const stat = fs.statSync(file);
    const total = stat.size;
    if (req.headers.range) {

    }
    fs.exists(file, (exists) => {
        if (exists) {
            const range = req.headers.range;
            const parts = range.replace(/bytes=/, '').split('-');
            const partialStart = parts[0];
            const partialEnd = parts[1];

            const start = parseInt(partialStart, 10);
            const end = partialEnd ? parseInt(partialEnd, 10) : total - 1;
            const chunksize = (end - start) + 1;
            const rstream = fs.createReadStream(file, { start: start, end: end });

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg'
            });
            rstream.pipe(res);

        } else {
            res.send('Error - 404');
            res.end();
            // res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'audio/mpeg' });
            // fs.createReadStream(path).pipe(res);
        }
    });
});

app.get('/download', function(req, res) {
    const file = __dirname + '/audio/alarm.mp3';
    res.download(file);
});

app.get('/show', function(req, res) {
    connection.query('SELECT * FROM patient  ORDER BY patient_room ASC', (err, result) => {
        res.render('show', {
            posts: result,
        });
    })
});
// LEFT JOIN medtime ON patient.patient_id = med.patient_id
app.get('/add', function(req, res) {
    res.render('add');
});

app.post('/addpatient', function(req, res) {
    const patient_sym = req.body.patient_sym;
    const patient_tel = req.body.patient_tel;
    const patient_name = req.body.patient_name;
    const patient_age = req.body.patient_age;
    const patient_gender = req.body.patient_gender;
    const patient_room = req.body.patient_room;


    const post = {
        patient_id: 'NULL',
        patient_name: patient_name,
        patient_gender: patient_gender,
        patient_age: patient_age,
        patient_sym: patient_sym,
        patient_tel: patient_tel,
        patient_room: patient_room

    }
    connection.query('INSERT INTO patient SET ?', post, (err) => {
        console.log('Data Inserted');
        return res.redirect('/show');
    });
});

app.get('/show/:id', function(req, res) {

    const roomID = req.params.id;

    connection.query('SELECT * FROM patient WHERE patient_room=?', [roomID], (err, results) => {
        if (results) {
            res.render('show', {
                posts: results,
                id: roomID
            });
        }
    });
});

app.get('/edit/:id', function(req, res) {

    const edit_postID = req.params.id;

    connection.query('SELECT * FROM patient WHERE patient_id=?', [edit_postID], (err, results) => {
        if (results) {
            res.render('edit', {
                post: results[0]
            });

        }
    });
});

app.post('/edit/:id', function(req, res) {
    const update_patient_sym = req.body.patient_sym;
    const update_patient_tel = req.body.patient_tel;
    const update_patient_name = req.body.patient_name;
    const update_patient_age = req.body.patient_age;
    const update_patient_gender = req.body.patient_gender;
    const update_patient_room = req.body.patient_room;
    const userId = req.params.id;
    connection.query('UPDATE `patient` SET patient_name =?,patient_age = ?, patient_gender = ?,patient_sym =?,patient_tel = ?,patient_room = ? WHERE patient_id = ?', [update_patient_name, update_patient_gender, update_patient_age, update_patient_sym, update_patient_tel, update_patient_room, userId], (err, results) => {
        if (results.changedRows === 1) {
            console.log('Post Updated');
        }
        return res.redirect('/show');
    });
});

app.get('/delete/:id', function(req, res) {
    connection.query('DELETE FROM `patient` WHERE patient_id = ?', [req.params.id], (err, results) => {
        return res.redirect('/show');
    });
});

app.get('/login', function(req, res) {
    res.render('login');
});

app.post('/verify', function(req, res) {
    const user = req.body.n_user;
    const pass = req.body.n_pass;
    // console.log(user, pass);
    connection.query('SELECT * FROM `nurse` WHERE n_user = ? and n_pass= ?', [user, pass], (err, results) => {
        // console.log(results.n_id);
        if (err) {
            throw err;
        } else if (results.length > 0) {
            return res.redirect('/');
        } else {
            return res.redirect('/login');
        }
    });
});

app.get('/time', function(req, res) {
    res.render('testtime');

});



setInterval(() => {
    const frame = wCap.read();
    const image = cv.imencode('.jpg', frame).toString('base64');
    io.emit('image', image);
    io.emit('datetime', { datetime: new Date().getTime() });
}, 1000 / FPS)



server.listen(3000);