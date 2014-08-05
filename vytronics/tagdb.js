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

//This module implements the Tags database singleton
//
//Events emitted
//==============================
//tagdb.tagChanged(id, changeData) - Emitted everytime a tag changes.
//Note that when a client subscribes to a tag change the server will (if the
//client desires) refresh with the current tag data. This event is only for
//actual changes.
//
//  id = ID of the tag that changed
//  data = Change data object containing one property (key) for each data
//  that has changed. For example if only the value has changed:
//      { value: <new value }
//  If the value and another app defined field such as"stateText" has changed:
//      { value: <new value>, stateText:<some text> }
//

var util = require("util");
var events = require("events");
var db = require("./db");

exports.version = '0.0.0';
		
//TagDB can emit events
var emitter = new events.EventEmitter();

var globals = {};

var tags = {};

//Load tags from json file
var load = function (json) {
	if ( undefined === json ) {
		return;
	}
		
	for( var tagid in json ) { 
		if( json.hasOwnProperty(tagid ) ) {
            
            //sys.* is reserved
            if (/^sys\..*/.exec(tagid)){
                db.log.error('tagdb load sys.* is a reserved tag id pattern.');
                continue;
            }
            
			tags[tagid] = new Tag(tagid,json[tagid]);
		}
	}
};

//TODO - exposed this for sysdriver to create system tags
//Need more work to make it general and ensure other useages
//properly link up to drivers and get post load processing
//Also need to do more validation such as duplicate tags etc.
exports.create_tag = function(tagid, config) {
    var tag = new Tag(tagid, config);
    tags[tagid] = tag;
}

var start = function() {
	//Kick off any periodic calculations
	//TODO - how about a stop function
			
	getTags().forEach( function(tagid) {
		var tag = getTag(tagid);
	
		if (tag.calc) { //If this tag is a periodic calc
			if(tag.calc.intervalID) { //If already has an active timer
				clearInterval(tag.calc.intervalID);
			}
			setInterval( function() {
				try {
					var val = tag.calc.func.call(tag);
					tag.setValue(val);
				}
				catch(err){
					//TODO - log this
					db.log.error("Tag:"+tag.id+" calcVal error:" + err.message, err.stack);
				}
			}, tag.calc.interval);
		}
	});
};

var getTags = function() {
	var tagIds = [];
	for( var tid in tags ) {
		if ( tags.hasOwnProperty(tid) ) {
			tagIds.push(tid);
		}
	}
	return tagIds;
};

var getTag = function(tagid) {
	return tags[tagid];
};

exports.load = load;
exports.start = start;
exports.emitter = emitter;
exports.getTags = getTags;
exports.getTag = getTag;

//Ask driver to write a value to this tagid
//
exports.write_tag = function (tagid, value) {
    
    //TODO - for this and for pulse need to use a convert_from method
    //If no user defined convert_from then simply returns value.
    
    var tag = getTag(tagid);
    
    if ( ! tag.driverinfo ) {   //This is an in memory tag
        tag.setValue(value);
    }
    else {
        db.driverdb.write_item(tag.driverinfo, value);
    }
    return true;
}

	
////////////////Private Tag class. Nobody should be constructing outside this module	
//Construct a Tag object from json
//Subscribe to driver IO and kick off any periodic calc loops
function Tag(tagid, json) {
	
	this.id = tagid;
	this.value = json.defaultValue;
	this.driverinfo = json.driverinfo;
	
	//Set up any periodic calcs
	if( json.calcVal !== undefined ) {
		
        this.calc ={ interval:json.calcVal.interval, //TODO - test isNaN
                    func:json.calcVal.func
                };
		
	}    
}

//Set the tag value and send notifications
Tag.prototype.setValue = function(value) {

	if(this.value===value) return;

	this.value = value;
	
	//TODO - Need to save a copy of the tag data
	//and call state calcs then send differences here
	//Always send id
	var data = { id: this.id, value: this.value };
	
	//TODO - awkward? Better coupling/decoupling needed?
	//Emitter is the tagdb emitter.
	emitter.emit("tagChanged", this.id, data);
}

