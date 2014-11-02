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
Memory driver module

    This is a built in driver. It is loaded automatically. Configuring a driver with id=mem will
    generate a project load error.
    
    The mem driver is used to host in-memory tags. Any tag with undefined driverInfo will be
    added as an item. You could explicitly link a tag to memory by using driver id="mem"

*/


var events = require("events");
var db = require('./db');
var log = require('log4js').getLogger('memdriver');
var vyutil = require('./vyutil');
log.setLevel(vyutil.getenv('VYTRONICS_MEMDRIVER_LOG_LEVEL', 'warn'));


log.debug("Loading memdriver module.");

module.exports.version = "0.0.0.0";

var mem_items = {};

var emitter = new events.EventEmitter();

//memdriver is a singleton
var memdriver = {
    on: function (type, listener){ emitter.on(type, listener); },
    register: function(item) {
        //Need to do anything? items will be added when they have values written to them
        //Perhaps try to init to tag defaultValue
        var tag = db.tagdb.getTag(item);
        if (tag) {
            mem_items[item] = tag.value;
        }
        
    },
    start: function() {},           //Does nothing. Cannot start or stop sysdriver
    stop: function() {},            //Does nothing. Cannot start or stop sysdriver
    read_item: function(itemname) {     //Read current value. Used by driverdb on registration
        var memobj = mem_items[itemname];
        
        if (!memobj) return undefined;
        
        //Else - in case memobj becomes something more complex will need some processing here
        //but for now just return the object
        
        return memobj;
        
    },
    write_item: function (itemname, value){
        if (!itemname) return;
        
        mem_items[itemname] = value;
        
        //Quality is always good (=1)
        emitter.emit('itemvalue', itemname, value, 1);
        return true;
    }
};


//All drivers must export a create function that returns a conforming
//driver object
module.exports.create = function() {
    return memdriver;
};
