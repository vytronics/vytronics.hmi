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

var util = require("util");
var events = require("events");
var db = require("./db");

exports.version = '0.0.0';

var clients = [];
	
var createClient = function(project, socket) {

	socket.on('disconnect', function () {
		clients.forEach( function(client) {
			if(client.socket === socket) {
				//TODO - need to clean any client stuff up?
				console.log("client disconnected:" + client.guid);
				clients.splice(clients.indexOf(client), 1);
			}			
		});
    });	

	var client = new Client(socket,db.GUID(),project);
	clients.push(client);
};

var tagChanged = function(tagid, changes) {

	clients.forEach(function (client) {
		if(client.containsSubscription(tagid)) {
		   var data = {
				id: tagid,
				value: changes.value
					//TODO - custom message for each subscription based on
					//  fields wanted
				};
			//console.log("client.socket.emit tagChanged tagid:"+tagid+" data:"+data);
			client.socket.emit('tagChanged', tagid, data);
		}
    });
};

exports.createClient = createClient;
exports.tagChanged = tagChanged;

function Client(socket,guid,project) {
	//TODO - add username etc.
		
	this.guid = guid,
	this.socket = socket;
	this.subscriptions = [];
	
	console.log("client logged on. GUID:" + guid);
	
	var self = this;
	
	socket.on('app_call', function(funcName, call_data, callback) {
                
        var call_err = 0;
        var result = 0;
        try {
            //console.log('clientdb app_call func:' + funcName);
            result = db.rpcdb.invoke(funcName, call_data);
        } catch(err) {
            console.log('  err:' + err.message,err,err.stack);
            call_err = err.message;
        }
        if(!callback) return;
        //The args have to be JSON strigifyable. Not sure there is a
        //test for this so any issues will result in unexpected transmission
        //without any warning. User functions need have the precondition that
        //the only return strigifyable results
        callback(result, call_err); //can this have more than one param?
    });
	
    socket.on('subscribeTag', function(tagid, ackfunc) {
        
        console.log('clientdb.subscribeTag tagid:' + tagid);

		//TODO - refractor this to return an object { result:, err: } where
		//err is just a string instead of array?
		var result = self.subscribeTag(tagid);

        if(ackfunc) {
			ackfunc(result);
		}
    });

    socket.on('unsubscribeTag', function(tagid, guid, ackfunc) {

		//TODO - refractor this to return an object { result:, err: } where
		//err is just a string instead of array
		var result = self.unsubscribeTag(tagid, guid);
		
        if(ackfunc) {
			ackfunc(result);
		}
    });	
};

Client.prototype.subscribeTag = function(tagid) {
	
	//TODO - Allow non-existent tag to support tabular
	//data clients that update with dynamically added points?
	
	//TODO - register subscription so each client only get's their
	//requested change messages and return a unique ID
	var guid = db.GUID(); //create unique serial code so client can delete
		
	var tag = db.tagdb.getTag(tagid);

	//Subscribe and also immediately emit current data
	if(tag){
      var data = {
            id: tagid,
			guid: guid, //serial number for this subscription
            value: tag.value
                //TODO - custom message for each subscription based on
                //  fields wanted
            };
		this.subscriptions.push( {tagid:tagid, guid:guid} );
		
		//Send on very next tick to refresh client. If we send now it will be received
		//before client gets the acknowledge/guid
		var self = this;
		process.nextTick( function() {
			self.socket.emit('tagChanged', tagid, data);
		});
		return guid; //Ack the subscription.
	}
	else {
		console.log("client:" + this.guid +" subscribeTag tagid:"+tagid+" not found?");
	}
	
	//TODO - real return code. Return blank guid if any errors?
	return undefined;

};

Client.prototype.unsubscribeTag = function(tagid, guid) {		

	var self = this;
	//Remove client that has this socket
	
	var remove = [];
	var keep = [];
	
	self.subscriptions.forEach( function(sub) {
		if ( sub.guid === guid ) {
			remove.push(sub);
		}
		else {
			keep.push(sub);
		}
	}, self);
	
	self.subscriptions = keep;
	
	//TODO - real return code. Return blank guid if any errors
	
	//Ack the unsubscribe. TODO return undefined if any error?
	return guid;
};

Client.prototype.containsSubscription = function(tagid) {

	for(var i=0; i<this.subscriptions.length; i++){
		if(this.subscriptions[i].tagid==tagid) {
			return true;
		}
	}
	return false;
};


