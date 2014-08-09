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

/*
Application global variables

Let's face it. This application naturally has several global singleton vars. This module exposes them
globally to other modules to avoid having awkward linkages passed around.

*/

module.exports.version = "0.0.0";

module.exports.clientdb = null;	//Database of connected HMI or other socket clients.

module.exports.tagdb = null		//Database of loaded tags.

module.exports.driverdb = null;	//Database of loaded drivers.

module.exports.rpcdb= null;	//Database of defined remote procedure calls that clients can invoke

module.exports.serverdb = null; //Server config and runtime vars

module.exports.projectdir = null;	//Path to project files

//Global util functions- TODO create a util vyuti module?

//Util to generate globally unique IDs
module.exports.GUID = function() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
		function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
};	

//For global logging infrastructure.
module.exports.log = require('log4js').getLogger();
