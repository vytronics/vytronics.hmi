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
    
    //console.log('rpcdb invoke call_name:' + call_name + ' call_data:', call_data + ' func:', callinfo.call_function);

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

//Write a tag value to driver
//  call_data = { tagid, value }
//
var write_tag =  function( call_data ) {
    //console.log('write_tag called tagid:' + call_data.tagid + ' value: ',call_data.value);

    db.tagdb.write_tag(call_data.tagid, call_data.value);

    return true;
};
exports.calls.write_tag = {
    call_function: write_tag
};

//Ask driver to pulse a tag value
//  call_data = {
//      tagid:  //the tagid
//      value:  //value to write
//      duration:   //for this many milliseconds, then write prev value
//
exports.calls.pulse_tag = {
    call_function: function(call_data) {

        var tag = db.tagdb.getTag(call_data.tagid);
        var last_val = tag.value;
        
        write_tag(call_data);
        
        call_data.value = last_val;

        setTimeout(write_tag, call_data.duration, call_data);

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

//Load rpcdb from project.json section
//  This sets some global config and may point to
//  application specific rpc add-ons
//  'rpcdb' : {
//      default_permission = '*'
//
exports.load = function (json) {

    if ( undefined === json ) {
        return;
    }
    console.log("Loadings rpc calls.");
    
    //TODO
}

//TODO - methods to add/modify calls
