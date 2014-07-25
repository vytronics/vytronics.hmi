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

/*
Vytronics.hmi utility methods
*/

//Return true is an object is defined
module.exports.isDefined = function (obj){
    return typeof obj != 'undefined';
};


//Function for getting env vars that might be indirect delimited by
//unix style ${...} notation. For example an env like:
//  I_have${some_env}/embedded/in/me
//Can have multiple embedded env that will get resolved but not recursively.
module.exports.getenv = function (envstr, default_val) {
    var env = process.env[envstr] || default_val;
    if (typeof env != 'undefined') {
        
        var regex = /\$\{.+?\}/g;
        var regexClean = /[{,},$]/g;

        env = env.replace(regex, function(p) {
            //remove $,{,}
            p=p.replace(regexClean,'');
            return process.env[p];
            });
    }
    return env;
};
