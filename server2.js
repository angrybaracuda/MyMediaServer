// server.js

// BASE SETUP
// ==============================================

var express = require('express');
var app = express();
var session = require('express-session');
app.use(session({ secret: 'admin1234' }));
var port = process.env.PORT || 8080;
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var zlib = require('zlib');
var cors = require('cors');
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";
var ssn;
app.use(cors())
// ROUTES
// ==============================================
var x;
app.use('/videos', express.static(path.join(__dirname, 'videos')))

// sample route with a route the way we're used to seeing it
app.get('/stream/:streamKey/:videoId/:segmentFile', function (req, res) {

    ssn = req.session;
    var videoId = req.param("videoId");
    var segmentFile = req.param("segmentFile");
    var streamKey = req.param("streamKey");

    console.log("Video ID: %s SegmentFile: %s streamKey: %s", videoId, segmentFile, streamKey);
    var filename = "./videos/" + videoId + "/" + segmentFile;
    var requestingIp = req.ip.substring(7, req.ip.length);
    console.log("requesting from " + requestingIp);
    if (streamKey.trim() != "" && ssn.authorization != "allow") {
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db("myvod");
            dbo.collection("session_records").findOne({ 'streamkey': streamKey + "" }, function (err, result) {
                if (err) { console.log(err); }

                if (result) {
                    console.log("found key: " + result.streamkey + " and host: " + result.host + " indb");
                    if (streamKey.trim() === result.streamkey && requestingIp === result.host) {
                        console.log("Access granted");
                        x = "allow";
                       // req.session.put('authorization', 'allow');
                        console.log("auth: " + req.authorization);
                    }
                    else {
                        console.log("Uauthorised access");
                        return;
                    }
                } else {
                    console.log("not in db");
                    //ssn.authorizationCount = ssn.authorizationCount + 1;
                    return;
                }

                db.close();
            });
        });

    }
    console.log("auth: " + ssn.authorization);
    console.log(filename);
    fs.exists(filename, function (exists) {
        if (!exists) {
            console.log('file not found: ' + filename);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.write('file not found: %s\n', filename);
            res.end();
        } else {
           // console.log(req.session.get('authorization'));
            console.log('sending file: ' + filename);
            switch (path.extname(filename)) {
                case '.m3u8':
                    fs.readFile(filename, function (err, contents) {
                        if (err) {
                            //    res.writeHead(500);
                            res.end();
                        } else if (contents) {
                            res.status(200);
                            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                            // res.writeHead(200);
                            var ae = req.headers['accept-encoding'];
                            if (ae && ae.match(/\bgzip\b/)) {
                                zlib.gzip(contents, function (err, zip) {
                                    if (err) throw err;
                                    res.status(200);
                                    res.setHeader('content-encoding', 'gzip');
                                    res.end(zip);
                                });
                            } else {
                                res.end(contents, 'utf-8');
                            }
                        } else {
                            console.log('emptly playlist');
                            res.writeHead(500);
                            res.end();
                        }
                    });
                    break;
                case '.ts':
                    res.writeHead(200, {
                        'Content-Type':
                            'video/MP2T'
                    });
                    var stream = fs.createReadStream(filename,
                        { bufferSize: 64 * 1024 });
                    stream.pipe(res);
                    break;
                default:
                    console.log('unknown file type: ' +
                        path.extname(uri));
                    res.writeHead(500);
                    res.end();
            }
        }
    });
});

// we'll create our routes here

// START THE SERVER
// ==============================================

app.listen(port);
console.log('Magic happens on port ' + port);

