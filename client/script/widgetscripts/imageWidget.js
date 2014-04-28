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

/*
This widget will avoid hitting the server for a resource on each tag change.
For high performance applications it is possible that the subscribed tag
could be changing faster than the server can deliver the resource. Therefore
this widget will pend a change if change rate exceeds the specified threshold which
defaults to 1 per second. The pending change will be the most
recent tag value. Other intermediates are tossed away.

There could be better ways to do this but unfortunately IE11 does not reliably
fire loaded events for SVG image elements.

config object = {
    tagid:    tagid to link to. Values should map to images selection.
            
    images: array of images or object with properties that map to tag value.
    
    maxrate: maximum allowed update rate in milliseconds. Default=1000.
}

Example:
    config = {
        tagid:'myNonIntTag',
        images: { alarm:'/images/alarm.png', normal:'/images/no-alarm.png' },
        maxrate: 500
    }
    
    Or for integer tag using default maxrate
    
    config = {
        tagid:'myIntTag',
        images:['/images/alarm.png', '/images/no-alarm.png]
    }
*/

var container = this;

var tagid = config.tagid;

//NOTE - vyhmi client scripts pass in the svg container as the this var.
var container = this;

var src = undefined; //the source file that is currently loading/loaded.

var select; //image selector function - TODO allow selector function script string to be supplied
            //in place of images object. function(tag) { return some_url; }

var image; //The image that loads src's.

var timer = undefined; //ID of pending timer. When expired will check value of tag and load the
    //associated src

var last_update = 0;

if ( isNaN(config.maxrate) ){
    config.maxrate = 1000;
}

var width = container.getAttribute('width');
var height = container.getAttribute('height');

//Define function to load src url into image
var loadsrc = function (src) {
    var curr_src = image.getAttributeNS('http://www.w3.org/1999/xlink','href');
    if (src !== curr_src){
        image.setAttributeNS('http://www.w3.org/1999/xlink','href',src);
    }
    last_update = Date.now();
};

//Define function to call when tag changes
var ontagchanged = function (tag) {

    src = config.images[tag.value];

    var defertime = config.maxrate - (Date.now() - last_update);

    //If timer is running do nothing
    if(timer) {
        return;
    }
    //Else if too soon, defer to later
    else if (defertime > 0) {
        timer = setTimeout(function() {
            timer = undefined;
            loadsrc(src);
        }, defertime); 
    }
    //Otherwise do it
    else {
        loadsrc(src);
    }
};

//Create an image which will load our sources into
console.log('create image width:' + width + ' height:' + height);
image =  document.createElementNS("http://www.w3.org/2000/svg","image");
image.setAttribute("x",0);
image.setAttribute("y",0);
image.setAttribute("width",width);
image.setAttribute("height",height);
image.setAttribute('externalResourcesRequired','true'); //Need this in order for load event to work.
            //read about it here: http://www.w3.org/TR/SVG/struct.html#ExternalResourcesRequired
            //Does not work on IE though :(

vyhmi.create_tagsub(tagid, ontagchanged);

container.appendChild(image);
