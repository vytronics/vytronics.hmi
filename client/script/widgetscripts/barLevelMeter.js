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


//SVG container is passed in to the script as the this var
var container = this;

//var digits = null; //digits text element
var numbars = 15;
var meteroffColor = "#333333";
var meteronColor = "#00FF00";
var meterwarnColor = "#FFFF00";
var meteralarmColor = "#FF0000";
var bars = [];
var minval = 0;
var maxval = 100;
var warnlevel = 45;
var alarmlevel = 70;
var fontFamily = "sans-serif";

    //TODO - automatically downsize font if container will overflow?
var fontSize = "14"; //NOTE: font size may cause the widget to overflow the container

//TODO - define tiers and color zones

function init(config) {
    
    var tagid = config.tagid;
    
	console.log("barLevelMeter init.");
	var width = container.getAttribute("width");
	var height = container.getAttribute("height");
	//var x = container.getAttribute("x");
	//var y = container.getAttribute("y");
	var padding = 2;
	
	//Let user config some of these vars
	if( (typeof config.numbars != 'undefined') && (!isNaN(config.numbars)) && ( config.numbars >= 3) ) {
		numbars = config.numbars;
	}
	if( config.minval && (! isNaN(config.minval)) &&
		config.maxval && (! isNaN(config.maxval)) &&
		(config.maxval > config.minval) ) {
		minval = config.minval;
		maxval = config.maxval;
	}
	
	if ( config.meteronColor ) meteronColor = config.meteronColor;
	if ( config.meteroffColor) meteroffColor = config.meteroffColor;

	if(config.fontFamily) fontFamily=config.fontFamily;
	if(config.fontSize) fontSize = config.fontSize;
	
	//Draw widget background. TODO - allow background color in config.
	var bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
	bg.setAttribute("x",0);
	bg.setAttribute("y",0);
	bg.setAttribute("width", width);
	bg.setAttribute("height",height);
	bg.setAttribute("fill","gray");
	container.appendChild(bg);
	
	//Create the text and render so you can get dimensions. Then place it.
	digits = document.createElementNS("http://www.w3.org/2000/svg","text");
	digits.textContent = "000.0";
	digits.setAttribute("style", "font-family: "+fontFamily+";font-size:"+fontSize+
		";fill:" + meteronColor + ";font-weight:bold");
	digits.setAttribute("text-anchor","middle");
	digits.setAttribute("x", width/2.0);
	digits.setAttribute("y", 0);
	container.appendChild(digits);	
	var digitsBB = digits.getBBox();
	
	//Background for text, few pixels border all around
	//Place centered at bottom
    //TODO - need to do more to attempt to keep digits within the container boundary.
	var digitsBg = document.createElementNS("http://www.w3.org/2000/svg","rect");
	digitsBg.setAttribute("fill", "black");
	var digitsBgW=digitsBB.width + 2*padding;
	var digitsBgH=digitsBB.height + 2*padding;
	digitsBg.setAttribute("width", digitsBgW);
	digitsBg.setAttribute("height", digitsBgH);
	var digitsBgX = (width/2.0) - (digitsBgW/2.0);
	var digitsBgY = height-digitsBgH;
	digitsBg.setAttribute("x", digitsBgX );
	digitsBg.setAttribute("y",digitsBgY);
	container.appendChild(digitsBg);
 
	//Relocate the digits centered at the bottom inside the background
	digits.setAttribute("y", digitsBgY + (digitsBgH/2.0) + (digitsBB.height/2.0) );
	
	//Remove text, add background and then re-add text so it is at the top
	container.removeChild(digits);
	container.appendChild(digits);
	
	
	//Draw the meters LEDs background gray
	var metergap =4; //px
	var meterH = (height - digitsBgH - numbars*metergap) / numbars;
	bars = [];
	for(var i=0; i<numbars; i++) {
		var bar = document.createElementNS("http://www.w3.org/2000/svg","rect");
		bar.setAttribute("width", digitsBgW);
		bar.setAttribute("height", meterH);
		bar.setAttribute("x", digitsBgX);
		bar.setAttribute("y", digitsBgY - i*(meterH+metergap));
		bar.setAttribute("fill", "#333333");
		bars[i] = bar;
		container.appendChild(bar);
	}
    
    vyhmi.create_tagsub(tagid, ontagchanged);
}

//Called when tag changes value
function ontagchanged(tag) {
    	
	digits.textContent = tag.value;
	
	var level = (Math.abs(tag.value-minval))/(maxval - minval);
	var numlit = level*numbars;
	var warn = Math.ceil((Math.abs(warnlevel-minval))/(maxval - minval) * numbars);
	var alarm = Math.ceil((Math.abs(alarmlevel-minval))/(maxval - minval) * numbars);
	
	//TODO - color variable darkness on one above is there is a remainder
	
	//console.log("level:" + level + " warn:" + warn + " alarm:" + alarm);

		//Fill the meter bars
	for(var i=0; i<numbars; i++) {
		var color = meteroffColor;
		if(i<=numlit) {
			if( i >= alarm) color = meteralarmColor;
			else if ( i >= warn) color=meterwarnColor;
			else color = meteronColor;
		}
		
		bars[i].setAttribute("fill", color);		
	}
	if(numlit>=alarm) digits.style.fill = meteralarmColor;
	else if(numlit>=warn) digits.style.fill = meterwarnColor;
	else digits.style.fill = meteronColor;
    
};

//Draw the widget
init(config);
