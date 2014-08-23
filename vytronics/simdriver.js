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
Simulation driver

    This is a built in driver. It is loaded automatically. Configuring a driver with id=sim will
    generate a project load error.

	Provides driver items that dynamically simulate values via a defined set of functions.
	Each item in the driver runs its own loop with a defined setInterval.
	        
    Each simulator function is instantiated by a tag when it links to driver id="sim". For example
    "driverinfo": {"id":"sim", "item":"randomInt:1000:0:0:1"}
    
    The format for a sim driver item is
    <function name>:<interval ms>:[... sim function specific params]
    
    Any additional parameters are ignored in initialization but are used to define unique items.
    This allows two tags to reference different simulator objects even though the functional configuration
    is identical. For example, if two different tags linked "driverinfo": {"id":"sim", "item":"randomInt:1000:0:0:1"}
    then they are both going to get the same exact series of values. However, if additional tokens are added
    then these become different series.
    
    The following will generate different random series:
    "driverinfo": {"id":"sim", "item":"randomInt:1000:0:0:1:MySeries1"}
    "driverinfo": {"id":"sim", "item":"randomInt:1000:0:0:1:MySeries2"}
    
    Functions include:
    increment
    randomInt
    randomDelta
    
    See code for the token parameters specific to each of these functions.
*/

var db = require("./db");
var vyutil = require('./vyutil');
var log = require('log4js').getLogger('simdriver');
log.setLevel(vyutil.getenv('VYTRONICS_SIMDRIVER_LOG_LEVEL', 'warn'));

log.debug("Loading simdriver.");

var events = require("events");

exports.version = "0.0.0.0";

//Global pre-defined simulator functions that can be subscribed to by clients.
var SIM_FUNCTIONS = {};

//Define SIM_FUNCTIONS
//	Each simulator object must define:
//		init - function(params) where params is an object passed in from project loader.
//              It is an array of tokens following <function name>:<interval ms>: if any.
//				Initializes the specific simulator object.
//				Calling signature simobj=init(params)
//		func - function(counter) { return something;}  where counter is the number of iterations since start
//				Calculates a new value for a sim object.
//				Calling signature func.call(thisvar, counter) where thisvar is the sim object.
//              Should return the same object reference if there is no change to prevent
//              emitting unecessary driveritem events.
//
//

//Increment integer - just increments current value
//
//  increment:<interval ms>:<init_val>:<delta>
//                          -------------------
//  
//
SIM_FUNCTIONS["increment"] = {
	init: //params=(
		function(params) {
			if( params.length < 2 ) return null;
			
			var value = parseInt(params[0],10); //initial value
			value = isNaN(value) ? 0 : value;
		
			var delta = parseInt(params[1],10); //amount to increment
			delta = isNaN(delta) ? 1 : delta;	

			return {value:value, delta:delta};   //The sim object
		},
	func:function(counter) {
        //counter not used        
		return this.value + this.delta;   //Will always be a new object
	}
};

//randomInt:<interval ms>:<init_val>:<min>:<max>
//	init - initial value
//	min - min value
//	max - max value
//
SIM_FUNCTIONS["randomInt"] = {
	init: //params=(
		function(params) {
		
			if( params.length < 3) return null;
		
			var value = parseInt(params[0],10);
			value = isNaN(value) ? 0 : value;

			var min = parseInt(params[1]);
			min = isNaN(min) ? 0 : min;				
			
			var max = parseInt(params[2]);
			max = isNaN(max) ? min+1 : max;
			if(max <= min) max = min+1;
			
			return {
				value:value,
				min:min,
				max:max
			};
		},
	func:function(counter) {
        //counter not used        
		var r = getRandomInt(this.min, this.max);		
		return r;
	}
};

//Random increment
//randomDelta:<interval ms>:<init_val>:<min>:<max>:<delta_range>
//	init - initial value
//	min - min value
//	max - max value
//	delta_range - Random deltas will range from -1*delta_range and delta_range
//	ID - optional ID if multiple unique instances are desired
//
SIM_FUNCTIONS["randomDelta"] = {
	init: //params=(
		function(params) {
		
			if(params.length<4) return null;

			var value = parseInt(params[0],10);
			value = isNaN(value) ? 0 : value;

			var min = parseInt(params[1]);
			min = isNaN(min) ? 0 : min;				
			
			var max = parseInt(params[2]);
			max = isNaN(max) ? min+1 : max;
			if(max <= min) max = min+1;

			var delta = parseInt(params[3]);
			delta = isNaN(delta) ? 1 : Math.abs(delta);
                        
			return {
				value:value,
				min:min,
				max:max,
				delta:delta
			};				
		},
	func:function(counter) {
        //counter not used
		var r = getRandomInt(-1*this.delta, this.delta);
        var newval = +this.value +r;
        if ( isNaN(newval) ) newval = 0;
		if ( (newval)  > this.max) newval=this.max;
		else if ( (newval) < this.min) newval=this.min;
              
		return newval;
	}
};


//Driver must export a create routine that constructs from a config object.
//config = {
//	interval: number - Optional loop interval in milliseconds. Default = 1000.
//}
//
exports.create = function() {
    return new SimDriver();
}

function SimDriver() {
	
	this.simulators = {};
	
	this.emitter = new events.EventEmitter();

	return this;
}

//Driver is an emitter than must define on method
SimDriver.prototype.on = function (type, listener){
    this.emitter.on(type, listener);
}
    
    

//Driver must define a read_item method that provides the current value
SimDriver.prototype.read_item = function (item){
    var obj = this.simulators[item];
    if (!obj) return undefined;
    
    return obj.value;
    
}

//Driver object must define a register function to instantiate a registration to a specific
//item.
//	item - "functionName:param1:param2:etc."
SimDriver.prototype.register = function(item) {
	var tokens = item.split(":");
	var funcName = tokens[0];
    
    var interval = parseInt(tokens[1],10);
    if ( (!interval) || isNaN(interval) || (interval<=0)) {
        log.error('simdriver.register interval [' + tokens[1] +
                    '] must be a positive non-zero integer:' + item);
        return;
    }
    
    //Anything left are sim function specific params
	var params = tokens.slice(2);
	
	//Is this a valid simulator function?
	var builder = SIM_FUNCTIONS[funcName];
	if( ! builder ) {
		log.error("simdriver Invalid function name:"+funcName);
		return;
	}
	
	var simulator = builder.init(params);
        
	if ( simulator ) {
        simulator.item = item; //just for debug
		simulator.func = builder.func;
        simulator.interval = interval;
		this.simulators[item] = simulator;
	}
};

//Helper function to set a value and emit 'itemvalue' if it is a new object value
SimDriver.prototype.set_value = function(simObj, value) {

    var oldval = simObj.value;
    
    if ( value !== oldval) {
        simObj.value = value;
        this.emitter.emit("itemvalue", simObj.item, simObj.value);				
    }
}    


//Driver object must define a start method to be called by the driver database.
SimDriver.prototype.start = function() {
    
    var self = this;
    
	log.debug("simdriver started.");
    
    Object.getOwnPropertyNames(this.simulators).forEach(function(prop) {
        //ForEach function passed the SimDriver object as this var
        var simObj = this.simulators[prop];
        var counter=1;
                
        simObj.timer = setInterval( function() {            
            try {
                var newval = simObj.func.call(simObj,counter++); //Call, passing in self as this var
                self.set_value(simObj, newval);
                
            } catch(err){
                //These can only be program errors and should let program crash. Catching for
                //now during development and early releases.
                log.fatal('simdriver function exception item:' + simObj.item + ' err:' + err.message, err.stack);
                process.exit(1);
            }
        }, simObj.interval);
        
        //Tell Nodejs to not let keep the program running if there are no other uref'd
        //timers in the event loop.
        simObj.timer.unref();
    }, this);
};

//Driver object must define a stop method to be called by the driver database.
SimDriver.prototype.stop = function() {
	log.debug("simdriver stopped.");	    

    Object.getOwnPropertyNames(this.simulators).forEach(function(prop) {
        //ForEach function passed the SimDriver object as this var
        var simObj = this.simulators[prop];
        clearInterval(simObj.timer);
        simObj.timer = undefined;
    }, this);
};

                                   
//Driver must define a write_item method to be call by driver database
//to ask driver to write a value to an item. Read only drivers can
//throw an error or do nothing. RW drivers can throw errors or be silent for bad calls.
SimDriver.prototype.write_item = function (item, value) {

    //Silent error
    var simObj = this.simulators[item];
    if( !simObj  ) return false;
    
    this.set_value(simObj, value);
    
    return true;
    
};

//TODO - unregister

//Private utility function
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
