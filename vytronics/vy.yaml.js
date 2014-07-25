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


/*JSlint allowed warning suppression*/
/*global console,require*/

/* =============================
This module extends js-yaml to add custom tags in the yaml vy namespace and then only exposes the methods needed for vytronics.hmi

================================*/

var fs = require('fs');

var vyutil = require('./vyutil');
var yaml = require('js-yaml');

//Allow a custom type to load/compile zero argument function bodies that just need to
//mess with the this var and optionally return a result
var objFunctionYamlType = new yaml.Type('tag:yaml.org,2002:vy/objfunc', {
    loadKind: 'scalar',
    loadResolver: function (state){
        state.result = new Function(state.result);

        if (typeof(state.result) == "function") {
            return true;
        }
            return false;
    },
    dumpPredicate: function (object){
        return '[object Function]' === Object.prototype.toString.call(object);
    },
    dumpRepresenter: function(object) { return object.toString(); }
});

//Allow a custom type to load/compile a zero parameter, single statement function
//in lambda style. Return statement is implicit.
//Example usage:
//  myfunc: !!vy/lambda this*2 + 3
//
//Would compile to:
//  myfunc: function() { return this*2 + 3; }
//
var lambdaFunctionYamlType = new yaml.Type('tag:yaml.org,2002:vy/lambda', {
    loadKind: 'scalar',
    loadResolver: function (state){      
        state.result = new Function( 'return ' + state.result + ';');
        if (typeof(state.result) == "function") {
            return true;
        }
        return false;
    },
    dumpPredicate: function (object){
        return '[object Function]' === Object.prototype.toString.call(object);
    },
    dumpRepresenter: function(object) { return object.toString(); }
});

//Allow a custom type to load an env variable with a supplied default if the env is not
//defined. Useful for setting test and development params that fallback to production values.
//Usage: !!vy/env <env var name>[:<optional fallback val]
//This way you do not need a development and production version of project.yml files.
//Example usage:
//  port_name: !!vy/env LCP_PORT_ENV:COM11,
//
var envFunctionYamlType = new yaml.Type('tag:yaml.org,2002:vy/env', {
    loadKind: 'scalar',
    loadResolver: function (state){
        var tokens = (state.result).split(':');
        var val = process.env[tokens[0]];
        
        //If env is not defined then try default fallback value
        if ( ! vyutil.isDefined(val) ) {                              
            //Allow ':' delimeter in default value string
            if (tokens.length) {
                val = tokens.slice(1).join(':');
            }
        }        
            
        state.result = val;
        return true;
    }
});


//Define the custom Vytronics "vy" yaml schema namespace
var VY_SCHEMA = yaml.Schema.create([ objFunctionYamlType, lambdaFunctionYamlType, envFunctionYamlType ]);

exports.load = function(full_filepath, callback) {
    fs.readFile(full_filepath, 'utf8', function (error, data) {
        var json = undefined;

        if (!error) {
            json = yaml.load(data, { schema: VY_SCHEMA });                    
        }                 
        callback(error, json);
    });
};
