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
System driver module

    This is a built in driver. It is loaded automatically. Configuring a driver with id=sys will
    generate a project load error.
    
    The sys driver exposes system information for admin guis and applications.

*/


var events = require("events");
var db = require('./db');

db.log.debug("Loading sysdriver module.");

exports.version = "0.0.0.0";

var sys_items = {};

//sysdriver is a singleton
var sysdriver = {
    emitter: new events.EventEmitter(),
    register: function(item) {
        //Don't think need to do anything. SysObj ctor already adds to sys_items obj.
    },
    start: function() {},           //Does nothing. Cannot start or stop sysdriver
    stop: function() {},            //Does nothing. Cannot start or stop sysdriver
    read_item: function(item) {     //Read current value. Used by driverdb on registration
        var sysobj = sys_items[item];
        
        if (!sysobj) return undefined;
        
        return sysobj.get_value();
        
    },
    write_item: function (item, value){
        //TODO - some items should be writeable?
    },
    
};


//All drivers must export a create function that returns a conforming
//driver object
exports.create = function() {
    return sysdriver;
};

//Method to enable the core app to create SysObject's
exports.create_sysObject = function(name, defaultValue) {
    
    var sysobj = new SysObject(name, defaultValue);
            
    return sysobj;
};


/*
SysObject class - system objects can be created by the core software to expose system information
to the tags database. A system object becomes a built-in tag that can be linked to graphics and calculations

    name -  System object name. Will be exposed as tag with id=sys.<name>. It is up to the core system developer to
            ensure that there are no collisions. That should be easy by using naming convention
                    module.varname
                    
When a SysObject is created there will be an associated tag created as part of the post load processing.                    
                    
*/
function SysObject (name, defaultValue){ //TODO - encapsulate and protect better
    this.tagid = 'sys.' + name;
    this.value = defaultValue;
    
    //Add it to sys_items. TODO more validation checking for dup ids?
    sys_items[this.tagid] = this;
    
    //Create a system tag that uses tagid also as item name
    var driver_info = {id:'sys', item:this.tagid};
    db.tagdb.create_tag(this.tagid, driver_info);
    
    //Register it with the tag
    //TODO - should tagdb do this?
    db.driverdb.subscribe(this.tagid, driver_info);

}

SysObject.prototype.set_value = function (newval){
    this.value = newval;
    
    sysdriver.emitter.emit("itemvalue", this.tagid, this.value);				
    
};

SysObject.prototype.get_value = function (){
    return this.value;
};


