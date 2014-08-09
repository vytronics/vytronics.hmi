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
var path = require("path");
var events = require("events");
var db = require("./db");
var sysdriver = require("./sysdriver");

exports.version = '0.0.0';

//List of loaded drivers
var drivers = {};

//Emits drivervalue events
var emitter = new events.EventEmitter();
	
//Load drivers from json file
exports.load = function (json) {
    
    var builtin = [
        {id:'sys', info:{uri:'./sysdriver'}},
        {id:'sim', info:{uri:'./simdriver'}}
    ];

    //Instantiate built in drivers
    builtin.forEach( function(drv) {        
        drivers[drv.id] = new Driver(drv.id, drv.info);
    });

    
    db.log.debug("Loadings drivers.");
    
 	for( var drvid in json ) {
		if( json.hasOwnProperty(drvid ) ) {
            
            //Do not let someone assign builtin driver id's or uris
            var reserved = false;
            builtin.forEach( function(drv) {
                if ( drv.info.uri === json[drvid].uri ) {
                    db.log.error("driverdb.load error:" + drv.info.uri + " is loaded by default. Not loading driver:" + drvid, json[drvid]);
                    reserved=true;
                }              
                if ( drv.id === drvid ) {
                    db.log.error("driverdb.load error:" + drvid + " is a reserved driver id. Not loading driver:" + drvid,json[drvid]);
                    reserved=true;
                }
            });
            
            if (reserved) continue;
            
            //TODO workaround - node require search path may not find drivers. It may try
            //and look relative to the install of the vytronics.hmi module but they are
            //really in the application package.json. So, for non built in
            //drivers look for and expect these in the exe's node_module folder
            json[drvid].uri = path.resolve(process.cwd(),'node_modules',json[drvid].uri);
            
            db.log.debug("Resolving custom driver to path " + json[drvid].uri);
            
			drivers[drvid] = new Driver(drvid,json[drvid]);
		}
	}
    
    //Now create driver sysObjects. TODO -maybe gotta rework the whole SysObject and sysdriver thing
    //Awkward coupling
    Object.getOwnPropertyNames(drivers).forEach( function(drv_id){
        drivers[drv_id].started = sysdriver.create_sysObject('driver.' + drv_id + '.started', false);

    });
};

//Link a driver item to a tag
exports.subscribe = function(tagid, driverInfo) {

	if ( !driverInfo.id) {
		db.log.error("driverdb driver missing id property:", driverInfo);
		return;
	}
	
	var driverid = driverInfo.id;

	if( ! drivers.hasOwnProperty(driverid) ) {
		db.log.error("DriverDB no such driver ID:" + driverid);
		return;
	}
	
	var driver = drivers[driverid];
	
	//Link to driver data (i.e., register the item). The item string is driver specific.
	//The DriverDB does not really care what is inside. The driver will emit data each
	//time value associated with the item changes.
	var item=driverInfo.item;
	driver.driverObj.register(item);
	
	//Remember the linkage
	var itemsubs = driver.items[item];
	if(!itemsubs) driver.items[item]=[];
	
	driver.items[item].push(tagid);
    
    //Read current value of item on nextTick so subscriber gets current value initiazed
    //TODO - perhaps expose a Driver object for driver developers that has a register item method that
    //schedules emit itemvalue on nextTick and then calls custom drivers register method?
    process.nextTick( function() {
        var value = driver.driverObj.read_item(item);
        driver.procItemValues(item,value);
    });
};

//Get list of loaded drivers as an array of driver id's.
exports.getDrivers = function() {
	var ids = [];
	for( var id in drivers ) {
		if ( drivers.hasOwnProperty(id) ) {
			ids.push(id);
		}
	}
	return ids;
};

//Get list of loaded drivers as an array of driver info
exports.getDriversInfo = function() {
	var info = [];
	for( var id in drivers ) {
		if ( drivers.hasOwnProperty(id) ) {
			info.push({id:id, uri:drivers[id].uri});
		}
	}
	return info;
};

//Start each driver.
exports.start = function(id) {
    
    if (!id) {
        exports.getDrivers().forEach( function(id) {
            db.log.debug("Starting driver:" + id);
            drivers[id].driverObj.start();
            drivers[id].started.set_value(true);           
        });
    }
    else { //Start the specified driver
        var driver = drivers[id];
        var started = driver.started.get_value();
        if( driver && (!started) ){            
            driver.driverObj.start();
            driver.started.set_value(true); 
        }
    }
    return true; //todo error codes
};

exports.stop = function(id) {
    if (!id){
        Object.getOwnPropertyNames(drivers).forEach( function(id) {
            db.log.debug("Stopping driver:" + id);
            drivers[id].driverObj.stop();
            drivers[id].started.set_value(false); 
        });	
    }
    else{ //Start the specified driver
        var driver = drivers[id];
        if( driver && (driver.started.get_value()) ){
            driver.driverObj.stop();
            driver.started.set_value(false); 
        }
    }
    return true; //todo error codes
};

exports.emitter = emitter; //driverdb event emitter. TODO - why does exports.on = emitter.on not work?

exports.write_item = function(driverinfo, value) {

    var driver = drivers[driverinfo.id];
    
    return driver.driverObj.write_item(driverinfo.item, value);    
};

//Create a driver from config info in json file
function Driver(id,info) {
    db.log.debug('Creating driver id:'+id + ' info:',info);
    //To capture this var in closures
	var self = this;
		
	this.id = id;
	
	//Items and the tags that have subscribed to them for this driver. Each member is
	//an object with the name of an item and a list of tags that have subscribed to it.
    //This allows the driverdb to attach a list of tags to an emitted "drivervalue" message.
    //That is, if an "itemvalue" is received from a driver, a corresponding "drivervalue" message
    //will be emitted  with the list of tags linked to the item.
	this.items = {};
	//Example:
	//items = {
	//	"item.1": [tag1, tag2...],
	//	"item.another": [tagA],
	//	...
	//}
		
	//uri is required.
	var uri = info.uri;
	if ( undefined === uri ) {
		throw new Error("Driver missing 'uri' property.");
	}
    this.uri = uri;
	
    //Driver module loading.
    //TODO - What kind of sanitizing is needed? Maybe none since even when hosted
    //a project will execute in its own virtual machine. Shame on the designer
    //for loading an inappropriate module.
	//Let node use the standard module search hierarchy. Note that for developing a
    //driver set NODE_PATH env var to include the dev directory
    

    //A driver module must supply a create method that returns a driver object
    //with the following properties and methods
    //TODO - document the required interface here
    //  
    //
	this.driverObj = require(uri).create(info.config);
    
    //Driver objects will emit "itemvalue" messages
	this.driverObj.on("itemvalue", function(item, value) {
		self.procItemValues(item,value);
	});
}

//Callback function for "itemvalue" messages emitted by a driver object.
//Send drivervalue event for the tag or tags that link to this driver item
Driver.prototype.procItemValues = function(item,value) {
	var tags = this.items[item];
	if(!tags) {
		db.log.warn("Driver id:" + this.id + " .Received item change for invalid item:" + item);
		return;
	}
	
	//Tell project that a list of tags have a new value. In most cases there is just one tag
	//but could be more if there are multiple tags that subscribe to the same driver and item (rare)
    //Item is only included for dev/debug and may be removed in future version.
	emitter.emit("drivervalue", this.id, tags, value, item);
}
