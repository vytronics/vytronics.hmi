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

//rpcdb.js - Module to implement a database of functions that can be called by remote
//  clients and their permission/authorization
//

var db = require('./db');


exports.version = '0.0.0';

//Default client role for rpc call. This is the permissions used when a call does
//not explicilty define a permissions field.
exports.default_permissons = ['/*/'];     //Allow any role

//Database of callable procedures
exports.calls = {};

//Method to invoke a call
exports.invoke = function(call_name, call_data) {
    var result = {};
     
    //Is call defined?
    var callinfo = exports.calls[call_name];
    
    db.log.debug('rpcdb invoke call_name:' + call_name + ' call_data:', call_data);

    //Does call exist and is it a function?        
    if( callinfo && (typeof(callinfo.call_function) === 'function')) {
        //Do it
        return callinfo.call_function(call_data);                
    }
    else {
        throw new Error('rpc invoke ' + call_name + ' is not a function.');
    }     
}

//Add the core calls =====================================================================
//



//Write a tag value to driver
//  call_data = { tagid, value }
//
//This is typically called from the client gui to request that the
//value for a tag be written to the driver. The value is in engineering
//units (or discrete states) for the tag and will need to be converted
//to telemetry value.
//
//
var write_tag_request =  function( call_data ) {
    db.tagdb.write_tag_request(call_data.tagid, call_data.value);

    //TODO - return value errors
    return true;
};
exports.calls.write_tag_request = {
    call_function: write_tag_request
};

//Ask driver to pulse a tag value
//  call_data = {
//      tagid:  //the tagid
//      value:  //value to write
//      duration:   //for this many milliseconds, then write prev value
//
exports.calls.pulse_tag_request = {
    call_function: function(call_data) {

        var tag = db.tagdb.getTag(call_data.tagid);
        
        var call_info = {
            tagid: call_data.tagid,
            value: call_data.values[0]
        };
        
        write_tag_request(call_info);

        //Future - allow call_data.values to have more than 2 elements. In that case pulse through each
        //value at duration interval
        call_info.value = call_data.values[1];
        setTimeout(write_tag_request, call_data.duration, call_info);

        return true;
    }
};

//Query for tag data
exports.calls.query_tags = {
    call_function: function(call_data) {
        
        //TODO add regex filters, property filters, and prototype object in call_data
        //specifying which properties to return. For now just dump tag id stuff

        var tags = db.tagdb.getTags();

        return tags;
    }
};

//Query for driver data
exports.calls.query_driver_info = {
    call_function: function(call_data) {
        return db.driverdb.getDriversInfo();
    }
};

//Query a tags valid value info
exports.calls.query_tag_value_info = {
    call_function: function(call_data) {
        var tag = db.tagdb.getTag(call_data.id);
        if (!tag) {
            return null;
        }
        
        return tag.get_value_info();
    }
};


exports.calls.start_driver = {
    call_function: function(call_data) {
        return db.driverdb.start(call_data);
    }    
}

exports.calls.stop_driver = {
    call_function: function(call_data) {
        return db.driverdb.stop(call_data);
    }    
}
