/*
Copyright 2014 Charles Weissman

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

//serverdb.js - Server config and runtime info

var db = require('./db');

module.exports.version = '0.0.0';

module.exports.listen_ip = undefined;
module.exports.listen_port = undefined;

//Load server config
module.exports.load = function (json) {
    
	if ( undefined === json ) {
		return;
	}
    
    //Get network config. Order of precedence is:
    //  project.yaml file
    //  Vytronics environment vars
    //  Cloud9 hosted env vars
    //  defaults
    //
    module.exports.listen_port = json.listen_port || process.env.PORT || 8000;
    module.exports.listen_ip = json.listen_ip || process.env.IP || "127.0.0.1";
    db.log.info('server will attempt to listen on ' + module.exports.listen_ip + ':' + module.exports.listen_port);
    
    //Optional home page overriding index.html
    module.exports.home_page = json.home_page;
    
};


