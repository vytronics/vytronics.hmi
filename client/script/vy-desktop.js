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

//Dependencies that desktop html must source but maybe make all this injectable like
//how socket.io does it
// socket.io
// jquery

//Directives to jslint to suppress some warnings about stuff that is really ok.
/*global $,io,console,alert*/
/*jslint nomen: true, evil:true*/

var vy = (function () {
    
    'use strict';
    
    //The namespace for vytronics instrumentation
	var vyns = "http://www.vytronics.com/hmi";
    	
    $(document).ready( function() {
        
        //Init if jquery mobile is included
        if ( $.mobile ) {        
            //Needed for JQuery mobile popup
            //Disable popups from stacking navigation history and causing page refresh.
            $.mobile.popup.prototype.options.history = false;
        }
    });

    //The namespace for vytronics instrumentation
	vyns = "http://www.vytronics.com/hmi";
    	
	//Selects all iframes that are for HMI windows (are of vy-stage class)
	function select_HMI_stages() {
		return $('iframe.vy-stage');
	}
    
    //Iterates over each HMI iframe document element and call a function on it
	function foreach_HMI_document(callback) {
		try {
			select_HMI_stages().each(function () {
				//Pass in the contentDocument and the owning iframe to caller
				callback(this.contentDocument, this);
			});
		} catch (err) {
			console.log("Uncaught exception in HMI iframe callback:", err.message);
			console.log("callback:", callback);
			console.log(err.stack);
		}
	}
    
    
    //Function to evaluate code in the global context of an HMI iframe. Uses same concept as the
    //Jquery getScript method except injects in the iframe and into a container that is valid for
    //html or svg (i.e., svg has no <head> or <body>). Therefore, simply calling eval in all cases instead
    //of trying to inject a <script> element. Future will detect svg vs html file type and optimize more.
    //
    //TODO - Seems like reloading iframe src clears window vars which is what we want in order to avoid
    //memory leaks and namespace pollution. Verify this is part of the HTML spec!!!!!
    function evalClientScript(targetWindow, code) {
        console.log("evalClientScript called");
        if (code) {
            code = $.trim(code);
            try {
                
                targetWindow.eval(code);
            } catch (err) {
                console.log("Error injecting script into client:", err.message);
                console.log("Stack:" + err.stack);
                console.log("code:" + code);
            }
        }
    }
        
    //Load a script text and then eval in the global context of the HMI stage
    //All vars/functions created are available to scripts in the stage.
    //Called on initial load of the iframe source and also during instrumentation
    //when vy:loadscript directives are encountered. Doc may use vy:loadscript to
    //load external functions needed for display logic, script widgets, etc.
    //
    function injectScript(targetWindow, url) {
        
        console.log("injectClientScript url:" + url);
		
        //Get core HMI script text
        $.ajax({
            url: url,
            async: false,
            dataType: 'text', //Must use text type to prevent desktop window from evaluating the code
            success: function (code) {
                
                console.log("Loaded client core script code file.");
                //Inject script into iframe's document
                evalClientScript(targetWindow, code); 
            },
            error: function (jqXHR, textStatus, errorThrown) {
                //This is kind of fatal, probably a server or app config error. Nothing
                //will work after this.
                console.log('Error could not load core HMI scripts:' + errorThrown);
            }
        });
		
	}
	
    //Instrument a document. Searches for instrumentation directives and processes them.
	function instrumentDocument(stage) {
        
        var hmidoc = stage.contentDocument;
			                
        console.log("instrumentDocument", stage);
                
		//Select all nodes that have instrumentation directives
		//Kind of sucks that jquery does not support namespaces so gotta do this sortof brute
		//force for now unless someone has a better idea. Will break if someone uses a different
		//prefix for the vy xmlns.
		$(hmidoc).find("*").filter(function () { 
                //The "this" var will be a DOM element
            
                return $(this).attr('vy:instrument') || //SVG uses custom namespace
                    $(this).attr('data-vy-instrument'); //HTML uses data-xxxx attribute names
                
            }).each(function () {
                //TODO - add sanity check that attribute is really in namespace vyns.
                
                var instrumentStr="", elem = this;
            
                //First try svg custom attribute then html
                instrumentStr = $(this).attr('vy:instrument') || $(this).attr('data-vy-instrument');

                //console.log("instrumentDocument doc instrumentStr:" + instrumentStr);

                //Evaluate the instrumentation string in the global scope of hosting iframe
                //(NOTE: NOT in the global scope of the desktop window!!!)
                //The instrumentation should normally call functions to link tag changes to
                //functions that will modify its owning element and potentially the DOM but can
                //really be used to do anything.
                try {
                    //Note that the evaluated code will have available any scripts loaded by the stage
                    //but will not have direct access to the desktop globals.
                    //Any code evaluated by functions called within the instrumentation string, for
                    //example invoking vyhmi.linktag('tagid','elem.setAttribute("fill",tag.value==0?"red":"green"))
                    //will be evaluated in the stage's global scope
                    //
                    var func = new stage.contentWindow.Function(instrumentStr);
                    
                    func.call(this);
                    //TODO - might cause memory leaks if the call has asyn functions. Need to store the document's
                    //instrument functions and delete them when doc is unloaded?
                    
                } catch (err) {
                    console.log("Error instrumenting document:" + err.message);
                    console.log("Element:", this);
                    //console.log("code:" + instrumentStr);
                }
									
            }); //Can chain more finds here if new vy attrinutes are defined or maybe a way to
                //modify the find to a regex search for "vy:" then process specific directives in
                //the each function.
	}
    
	//What to do when desktop window is loaded.
	$(document).ready(function () {
		
		select_HMI_stages()
			//On load, parse for and process instrumentation directives
			//Will push tagsubs data onto the iframe document to configure tag subscription info
			.on("load", function () {
				console.log("+++++++++++++++++++++++stage loaded:", this);
                
                //Make a few functions always available in stage
                //TODO - need to do some thinking on how to best modularize script injection
                this.contentWindow['vy_desktop'] = {
                    injectScript: injectScript
                };

                
				//Inject some core HMI client scripts into the global scope of the stage such as
				//linktag etc. that are needed for instrumentation
                injectScript(this.contentWindow, "/socket.io/socket.io.js");
				injectScript(this.contentWindow, "/script/vy-client.js" );
                
                //Above ajax call is synchrous so this should work. Client scripts need to be loaded
                //before instrumenting.            
                instrumentDocument(this);

                
			})
    });
	

    /*================ STUFF FOR CONTROL POPUPS ======================================================
        Uses JQuery Mobile
    ==================================================================================================*/

    /*
    Instantiate a JQuery Mobile popup at runtime. Credits to John Chacko for the idea
    http://johnchacko.net/?p=44
    */
    function create_ctl_popup(elem, items) {

console.log('create_ctl_popup elem:', elem, ' items:', items);        
        
        function show_popup() {

            //Need to do anything?
            var popupafterclose = function () {};

            var menu;
            menu = $('<div class="ui-content messagePopup" data-role="popup" id="popupMenu" data-overlay-theme="a">').append(

                $('<a data-role="button" data-theme="g" data-icon="delete" data-iconpos="notext"' +
                    ' class="ui-btn-right closePopup">Close</a>'),

                $('<ul data-role="listview" data-inset="true" style="width:180px;" data-theme="a">').append(
                    (function (){
                        var choices = [];

                        Object.getOwnPropertyNames(items).forEach(function (item){

                            var choice = $('<li><a>' + item + '</a></li>');
                            choice.on('click', function (){
                                try {
                                    //Execute the function
                                    items[item]();
                                }
                                catch(err){
                                    console.log('Error in control function:' + err.message);
                                }
                                menu.popup('close');
                            });

                            choices.push(choice);

                        });
                        return choices;
                    })()
                )
            );

            $.mobile.activePage.append(menu).trigger("create");

            $.mobile.activePage.find(".closePopup").bind("tap", function (e) {
                $.mobile.activePage.find(".messagePopup").popup("close");
            });

            $.mobile.activePage.find(".messagePopup").popup().popup("open").bind({
                popupafterclose: function () {
                    $(this).unbind("popupafterclose").remove();
                    popupafterclose();
                }
            });
        }

        //Show it on click
        $(elem).on('click', function(){                
            show_popup();
        });
    }
            
	//Return public members
    return {
        create_ctl_popup: create_ctl_popup
    };
    
})();
