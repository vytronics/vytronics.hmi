/*
Copyright 2014 Vytroncs.com and Charles Weissman

This file is part of "Vytroncs HMI, the 100% Free, Open-Source SCADA/HMI Initiative"
herein referred to as "Vytronics HMI".

Vytronics HMI is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Vytronics HMI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Vytronics HMI.  If not, see <http://www.gnu.org/licenses/>.
*/


/*JSlint allowed warning suppression*/
/*global console,require*/

var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var express = require('express');

var vyutil = require('./vyutil');
var project = require('./project');
var db = require('./db');


var log = require('log4js').getLogger('server');

var self = this;

var datadir;

//Default logging level is set to WARN or let it be changed by
//env var VYTRONICS_LOG_LEVEL at startup or by modifying the log config file at runtime
var log_level = vyutil.getenv('VYTRONICS_SERVER_LOG_LEVEL', 'warn');
log.setLevel(log_level);

//Start the server
var old_start = function() {
    log.info("Vytronics server.js started with node versions",process.versions );

    //Get project directory from env or default
    var projectdir = vyutil.getenv('VYTRONICS_PROJDIR');
    if (!projectdir) {
        projectdir = path.resolve(process.cwd(), './project');
    }
    log.info('VYTRONICS_PROJDIR set to:' + projectdir);

    //Resolve the project path relative to process directory
    projectdir = path.resolve(__dirname, projectdir);

    //
    // Creates a new instance of an http server with the following options:
    //  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
    //
    var router = express();
    var server = http.createServer(router);

    //IO between server and clients
    var io = socketio.listen(server);

    //Listen for client connections and create clients
    io.on('connection', function (socket) {

        //Note that there is no real utility in logging the client IP address. There
        //Is no method to reliabily get it especially considering NAT and also that
        //any hosted node.js server will be double proxying. Putting this note here
        //so that nobody questions why it is not taken seriously, just FYI'd

        var addr = socket.handshake.address;
        addr = addr? addr : {};

        //Always send this to the console
        console.log("Connection opened url:"+socket.handshake.url +
            " address:" + addr.address + ":" + addr.port);
        
        log.info("Connection opened url:"+socket.handshake.url +
            " address:" + addr.address + ":" + addr.port);

        //Note that query params can be extracted from
        //socket.handshake.query.myParam if needed for the application

        //Create a new client
        db.clientdb.createClient(socket);
    });

    project.load(projectdir, function(err) {
    
        if (err){
            log.error('error loading project.yml - ' + err);
        }
        else {
    
            //Webserver. Root of the scripts that get included in project specific HTML
            router.use(express.static(path.resolve(__dirname,'../','client')));

            //This is the actual client application directory and takes 2nd precedence.
            router.use(express.static(path.resolve(projectdir,'hmi'),
                                      //Override default index.html if project.yml defines server.home_page
                                      {'index': db.serverdb.home_page || 'index.html'}
                                     ));

            server.listen(db.serverdb.listen_port, db.serverdb.listen_ip, function(){                
              var addr = server.address();
              log.info("HMI server listening at", addr.address + ":" + addr.port);
            });
        }
    });
};

var old_stop = function (){
    log.warn('stop - TODO not implemented yet.');
};

//Create an in-process client
var createAppClient = function (){
   return db.clientdb.createClient('my app');
};


//################## New modular framework stuff

function Server (){
    
}

Server.prototype.start = function (){
};




module.exports = {
    start: old_start,
    stop: old_stop,
    createAppClient : createAppClient,
    db: db,
    
    //Above is legacy until framework version is more stable and then
    //will get deprecated warnings
    
    //Below is for the new framework approach that makes this more modular
    //separating http/socket.io and yaml loader stuff
    
    Server: function (config){
        
        var server = new Server();
        
        return {
            start: server.start()
            //stop: server.stop();
        };
    }
};



