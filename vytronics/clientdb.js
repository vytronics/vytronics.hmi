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

var util = require("util");
var vyutil = require('./vyutil');
var events = require("events");
var db = require("./db");
var log = require("log4js").getLogger('clientdb');
log.setLevel(vyutil.getenv('VYTRONICS_CLIENTDB_LOG_LEVEL', 'warn'));

exports.version = '0.0.0';

var clients = [];

//Listen for tag changes
db.tagdb.on('tagChanged', function(id, changes) {
    
    var data = {
        id: id,
        value: changes.value
            //TODO - custom message for each subscription based on
            //  fields wanted
        };
    
	clients.forEach(function (client) {
        //Socket connected clients do quick and dirty. They only need
        //single emit if any match
        if ( client.is_inprocess !== true ) {
            if(client.containsSubscription(id)) {
                //network clients never have callback, use null
                client.tagChangeCallback(null, id, data);
            }
        }
        else { //This is an in process client. Need to check every subscription
            //since each may have its own callback
            
            var matches = [];
            client.subscriptions.forEach( function (sub){                
                if (sub.regex) {
                    if (id.match(sub.regex)){
                        matches.push(sub);
                    }
                    else if (sub.tagid === id){
                        matches.push(sub);
                    }
                }
            });
            matches.forEach( function (match){
                client.tagChangeCallback(match.callback, match.regex.toString(), data);
            });
        }        
    });
});


var createClient = function(emitter) {
    
    
    var name;
    var is_inprocess = false;
    
    //If null or string emitter then this is an in process client. Create an emitter
    //for it
    if (!emitter) {
        name = db.GUID(); //Just give it a random name
    }
    if ( "string" === typeof(emitter) ){
        //TODO - dont allow identical names
        name = emitter;
        emitter = new events.EventEmitter();
        is_inprocess = true;
    }
    else {
        name = db.GUID();
    }
    
	emitter.on('disconnect', function () {
		clients.forEach( function(client) {
			if(client.emitter === emitter) {
				//TODO - need to clean any client stuff up?
				log.info("client disconnected:" + client.guid);
				clients.splice(clients.indexOf(client), 1);
			}			
		});
    });	

	var client = new Client(emitter,name, is_inprocess);
	clients.push(client);
        
    return client;
};

function Client(emitter,guid, is_inprocess) {
	//TODO - add username etc.
		
	this.guid = guid,
	this.emitter = emitter;
	this.subscriptions = [];
    this.is_inprocess = is_inprocess; //TODO - be able to detect by emitter type?
	
	log.info("client logged on. GUID:" + guid);
	
	var self = this;
	
	emitter.on('app_call', function(funcName, call_data, callback) {
                
        var call_err = 0;
        var result = 0;
        try {
            result = db.rpcdb.invoke(funcName, call_data);
        } catch(err) {
            log.error('app_call:' + err.message,err,err.stack);
            call_err = err.message;
        }
        if(!callback) return;
        //The args have to be JSON strigifyable. Not sure there is a
        //test for this so any issues will result in unexpected transmission
        //without any warning. User functions need have the precondition that
        //the only return strigifyable results
        callback(result, call_err); //can this have more than one param?
    });
	
    emitter.on('subscribeTag', function(tagid, ackfunc) {
        
        log.debug('clientdb.subscribeTag tagid:' + tagid);

		//TODO - refractor this to return an object { result:, err: } where
		//err is just a string instead of array?
		var result = self.subscribeTag(tagid);

        if(ackfunc) {
			ackfunc(result);
		}
    });

    emitter.on('unsubscribeTag', function(tagid, guid, ackfunc) {

		//TODO - refractor this to return an object { result:, err: } where
		//err is just a string instead of array
		var result = self.unsubscribeTag(tagid, guid);
		
        if(ackfunc) {
			ackfunc(result);
		}
    });	
};

//Subscribe to a tagid
//If callback is supplied then call it on each change. This would be for in-process clients
//Otherwise the changes will be emitted to network client
//
Client.prototype.subscribeTag = function(tagid, callback) {
		
	var guid = db.GUID(); //create unique serial code so client can delete
		
    var tag = db.tagdb.getTag(tagid);
    if (!tag) {
        log.warn("client:" + this.guid +" subscribeTag tagid:"+tagid+" no matches?");
        return undefined;
    }
    
    //Subscribe and also immediately emit current data
    //Send on very next tick to refresh client. If we send now it will be received
    //before client gets the acknowledge/guid
    var self = this;
    process.nextTick( function (){
      var data = {
            id: tag.id,
            guid: guid, //serial number for this subscription
            value: tag.value
                //TODO - custom message for each subscription based on
                //  fields wanted
            };   
        self.tagChangeCallback(callback, tag.id, data);
    });
    
    this.subscriptions.push( {tagid:tagid, guid:guid, callback: callback} );

    
	return guid; //Ack the subscription.
};

//Subscribe via regex match of tagid
//If callback is supplied then call it on each change. This would be for in-process clients
//Otherwise the changes will be emitted to network client
//
Client.prototype.subscribeTagRegex = function (tagid_regex, callback){
	var guid = db.GUID(); //create unique serial code so client can delete
    	
	var matches = db.tagdb.getTagsRegex(tagid_regex);
    
    if ( 0 === matches.length ) {
        log.warn("client:" + this.guid +" subscribeTagRegex tagid:"+tagid_regex.toString()+" no matches?");
        return undefined;
    }
    
    this.subscriptions.push( {tagid:tagid_regex.toString, guid:guid, regex: tagid_regex, callback: callback} );    
    
    //Subscribe and also immediately emit current data
    //Send on very next tick to refresh client. If we send now it will be received
    //before client gets the acknowledge/guid
    var self = this;
    var regex_str = tagid_regex.toString(); //use id of regex string
    
    process.nextTick( function (){
        matches.forEach( function(tag){
          var data = {
                id: tag.id,
                guid: guid, //serial number for this subscription
                value: tag.value
                    //TODO - custom message for each subscription based on
                    //  fields wanted
                };
            self.tagChangeCallback(callback, regex_str, data);
        });
    });
    
	return guid; //Ack the subscription.
};


Client.prototype.tagChangeCallback = function (callback, id, data){
    if (!callback){
        this.emitter.emit('tagChanged', id , data);
    }
    else {
        try {
            callback(id, data);
        }
        catch (err){
            log.error('client guid:' + this.guid + ' tagid:' + id + ' tagchange callback exception:' + err.message);
        }
    }
}

Client.prototype.unsubscribeTag = function(tagid, guid) {		

	var self = this;
	
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
        var sub = this.subscriptions[i];
        
        //If subscription is a regex then execute it, otherwise do straight compare
        var match = sub.regex? tagid.match(sub.regex): (sub.tagid === tagid);
        
		if (match) return true;
	}
    
	return false;
};

exports.createClient = createClient;

