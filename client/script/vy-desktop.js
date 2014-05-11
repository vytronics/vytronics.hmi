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

//Dependencies that client must source
// socket.io
// jquery

//Directives to jslint to suppress some warnings about stuff that is really ok.
/*global $,io,console,alert*/
/*jslint nomen: true, evil:true*/

var vy = (function () {
    
    'use strict';
    
    $(document).ready( function() {
        
        //Init if jquery mobile is included
        if ( $.mobile ) {        
            //Needed for JQuery mobile popup
            //Disable popups from stacking navigation history and causing page refresh.
            $.mobile.popup.prototype.options.history = false;
        }
    });

    var socket, vyns, hmiCount, tag_subs, socket_connect_listeners;
    
    hmiCount = 1; //Global counter used to create unique HMI iframe client IDs
    
    tag_subs = []; //Array of current active tag subscriptions
    
    socket_connect_listeners = []; //Array of HMTL clients that want socket connection events.
    //Each listener supplies a routine function(connected)
    
    //One socket per desktop
    socket = undefined;
    
    //The namespace for vytronics instrumentation
	vyns = "http://www.vytronics.com/hmi";
    
    //Unique client ID generator for this session so that each unique IDs can be assigned
    //to each document loaded in an HMI iframe
    function HMI_ID() {
        return hmiCount++;
    }
	
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
    
    //Create a tag subscription and register it.
    function create_tagsub(hmi_id, tagid, callback){
        var sub = {
            tagid: tagid,
            hmi_id: hmi_id,
            callback: callback,
            guid: undefined     //Will be set when subscribed
        };
        tag_subs.push(sub);
        subscribe(sub);
    }

    //Tell server we want to get "tag_changed" messages for this tag. Functions are stored during
    //instrumentation of hmi stages when they are loaded/instrumented. Desktop will look these up
    //on receipt of a tag_changed message. The sub object has the following properties
    //  id - tag id
    //  hmi_id - the id of the hmi stage doc it applies to
    //  callback - function to call when tag changes
    //  guid - server assigned global uid
    //
	function subscribe(sub) {
		console.log('subscribe hmi_id:' + sub.hmi_id + ' tagid:' + sub.tagid);
		//TODO - if server never responds then guid will also be undefined,
		//Unsubscribe methods should purge undefined guids also.
                     
        //Only do if connected. Don't worry, each time a connection is established the
        //desktop will resend all tag subscriptions.
        if(socket.socket.connected) {
            socket.emit("subscribeTag", sub.tagid, function (result) {
                if (!result) {
                    console.log("subscribe error. tagId:" + sub.tagid);
                    return;
                }
                //Store the subscription GUID handle returned from the server	
                sub.guid = result;
                console.log('subscribed to tag:', sub);
            });
        }
        else {
            console.log('info - subscribe called with server not connected. Subscription is deferred.');
        }
	}
    
	//Unlink callback and tell server to unsubscribe
	function unsubscribe(sub) {
		console.log('unsubscribe tagid:' + sub.tagid );
        
        //TODO - need to check for connected first?

        //This is where it is important to have a GUID for each subscription. If there is more than
        //one subscription for a given tag then having guid makes sure other subs are not effected should
        //the subsystem be changed to allow dynamic subscriptions within an actively loaded stage HMI.
        socket.emit("unsubscribe", sub.tagid, sub.guid, function (result) {
			if (!result) {
				console.log("unsubscribe error. tagId:" + sub.tagid);
				return;
			}
            
            //Remove and delete
            var i = tag_subs.indexOf(sub);
            if (-1 !== i) {
                tag_subs.splice(i,1);
            }
            //TODO - delete something to make sure can be garbage collected or is that not necessary?
            //Danger is leaving a referene to something in an iframe doc that was unloaded. Is splice of the
            //array good enough to release all references?
		});
	}    
    
    
    function unsubscribeStageDocTags(doc){
         var hmi_id = doc['__hmi_id'];
        tag_subs.forEach( function(sub){
            if (hmi_id===sub.hmi_id){
                unsubscribe(sub);
            }
        });
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
			        
        //Assign a unique HMI ID that is used to manage its subscriptions
        var hmi_id = 'hmi_' + HMI_ID();
        hmidoc["__hmi_id"] = hmi_id;
        
        console.log("instrumentDocument hmi document id:" + hmi_id);
        
		//Select all nodes that have instrumentation directives
		//Kind of sucks that jquery does not support namespaces so gotta do this sortof brute
		//force for now unless someone has a better idea. Will break if someone uses a different
		//prefix for the vy xmlns.
		$(hmidoc).find("*").filter(function () { 
                return $(this).attr('vy:instrument') || //SVG uses custom namespace
                    $(this).attr('data-vy-instrument'); //HTML uses data-xxxx attribute names
                
            }).each(function () {
                //TODO - add sanity check that attribute is really in namespace vyns.
                
                var instrumentStr="", elem = this;
            
                //First try svg custom attribute then html
                instrumentStr = $(this).attr('vy:instrument') || $(this).attr('data-vy-instrument');

                console.log("instrumentDocument doc instrumentStr:" + instrumentStr);

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
                    var func = new stage.contentWindow.Function(instrumentStr).call(this);
                    //TODO - might cause memory leaks if the call has asyn functions. Need to store the document's
                    //instrument functions and delete them when doc is unloaded?
                    
                } catch (err) {
                    console.log("Error instrumenting document:" + err.message);
                    console.log("Stage:", stage);
                    console.log("Element:", this);
                }
									
            }); //Can chain more finds here if new vy attrinutes are defined or maybe a way to
                //modify the find to a regex search for "vy:" then process specific directives in
                //the each function.
	}
    
    function getStageDocTags(hmi_id){
        var ret_subs = [];
        tag_subs.forEach(function (sub){
            if (sub.hmi_id===hmi_id){
                ret_subs.push(sub);
            }
        });
    }
    
    //TODO - dont think this will ever be needed?
    function subscribeAllTags(){        
        tag_subs.forEach( function(sub){
            subscribe(sub);
        });
    }
    
    //Let HTML listen to connection status
    //The callback is function(isConnected)
    function addConnectionListener (callback){
        if (socket_connect_listeners.indexOf(callback)){
            socket_connect_listeners.push(callback);
        }
    }
    function removeConnectionListener (callback){
        var idx = socket_connect_listeners.indexOf(callback);
        if (-1 !== idx){
            socket_connect_listeners.splice(idx,1);
        }
    }

		
	//What to do when desktop window is loaded.
	$(document).ready(function () {
		
		select_HMI_stages()
			//On load, parse for and process instrumentation directives
			//Will push tagsubs data onto the iframe document to configure tag subscription info
			.on("load", function () {
				console.log("+++++++++++++++++++++++stage loaded:", this);
                
                //Listen for unload event so we can unsubscribe tags
                var win = this.contentWindow;
                var doc = this.contentDocument;
                win.addEventListener('unload', function() {
                    console.log("---------------------stage unloaded----------------------");
                                unsubscribeStageDocTags(doc);
                });
				
				//Inject some core HMI client scripts into the global scope of the stage such as
				//linktag etc. that are needed for instrumentation
				injectScript(this.contentWindow, "/script/vy-client.js" );
                
                //Above ajax call is synchrous so this should work. Client scripts need to be loaded
                //before instrumenting.            
                instrumentDocument(this);

                
			});
            
	
        //========= Socket stuff                        
        socket = io.connect();
		socket.on("connect", function () {
			console.log("socket connected");
			//re-request all subscriptions
			subscribeAllTags();
            
            //Notify clients
            socket_connect_listeners.forEach(function(listener){
                try {
                    listener(true);
                } catch (err){
                    console.log('Exception in connection listener:' + err.message);
                }
            });
		});

        socket.on('disconnect', function () {
            //Notify clients
            socket_connect_listeners.forEach(function(listener){
                try {
                    listener(false);
                } catch (err){
                    console.log('Exception in connection listener:' + err.message);
                }
            });
        });

        socket.on('reconnect_failed', function () {
            //TODO - something nicer and maybe provide a reconnect button
            alert("Reconnection failed.");
        });
        //tagChanged message
        //Format {  id:tagid,
        //          changes: {
        //              field1:val,
        //              field2:val2 ...etc
        //      }
        //}
        socket.on('tagChanged', function (tagid, tag) {
			//console.log("tagChanged id:" + tagid + " tag{" + tag.id + "," + tag.value);
            
            tag_subs.forEach( function (sub){
                try {
                    if (sub.tagid === tagid) {
                        sub.callback(tag);
                    }
                } catch (err) {
                    console.log('exception in tagchanged callback tagid:' + tagid +
                                ' msg:' + err.message +
                                ' callback:', sub.callback);
                }
            });
		});        
    });
    
    //Execute a remote function call on the server and invoke callback(result_data, err) when complete
    function app_call(name, call_data, callback) {
        socket.emit("app_call", name, call_data, function(result_data, err) {
            console.log('app_call result:', result_data);
            if (callback) callback(result_data, err);
        });
    }
    

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
        addConnectionListener: addConnectionListener,
        removeConnectionListener: removeConnectionListener,
        HMI_ID: HMI_ID,
        injectScript: injectScript,  //Make this available in client
        create_tagsub: create_tagsub,
        app_call: app_call,
        create_ctl_popup: create_ctl_popup
    };
    
})();