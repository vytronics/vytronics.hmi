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
Core HMI scripts to be injected into an HMI iframe document to be eval'd in their global scope and made available in
namespace vyhmi. These are injected AFTER the document is loaded and DOM is available.
*/

var vyhmi = (function (){
    
    console.log("vy-client injecting core scripts in document:",document);
    
    function create_tagsub(tagid, callback) {
        
        var hmi_id = document["__hmi_id"]; //Desktop will set this when document is parsed
        parent.vy.create_tagsub(hmi_id, tagid, callback);
    }
    
    function create_ctl_popup(elem,items) {
        parent.vy.create_ctl_popup(elem, items);   
    }
    
    
    
    //Link a tag change to an element in the DOM
    function linktag(elem, tagid, script) {
        
        var func;

        //console.log("vyhmi.linktag called elem:" + elem + " tagid:" + tagid + " script:" + script);
        
        //If script obj is a function then use it as is. Of course, the function must be of form
        // function(tag, elem){} or it will not do much :)
        if ( typeof(script) === 'function' ) {
            func = script;
        }
        //Otherwise - script is a string of code. Compile it to a function with the proper arguments.
        else {
        
            //Compile script as a function in the iframe global context.
            //TODO - would there be any cleanup when a new document is loaded? On load all of the previous
            //subscription will no longer be referenced so they should be candidate for next garbage collection?
            //The script text will have the tag object and elem available as well as
            //iframe global context.
            func = new Function("tag", "elem", script);
        }

        //Make it callable as a tag changed callback which will pass in only the tag object
        function caller(tag) {
            func(tag, elem);
        }
        
        create_tagsub(tagid, caller);
        
    }
    
    //Inject a script. This is an alternative to a <script> tag in the client's file. Some SVG editors may not like having
    //scripts in the document (i.e., svg-edit)
    function load_script (uri) {
        console.log("vyhmi.load_script " + uri);   
        parent.vy.injectScript(window, uri); //Inject into our own window. Remember, this is the client calling.
    }
    
    //Invoke a server app call that when completed invokes callback(result_data, err)
    function app_call(name, call_data, callback) {
        parent.vy.app_call( name, call_data, callback);
    }
    
    //Fit contents to the hosted iframe. Zoom to fit maintaining aspect. Should be put in
    //the SVG element of the page. Set background to optional pagecolor
    function scale_fit_svg(elem, pagecolor) {
        
        //Get extents of the contained contents
        var BB = elem.getBBox();                
        
        //TODO - do styles need to be cleared?
        //elem.remoteAttribute('style');
        
        //Remove any size attr
        elem.removeAttribute('width');
        elem.removeAttribute('height');
               
        //Scale and fit contents
        elem.setAttribute('viewBox', BB.x + ' ' + BB.y + ' ' + BB.width + ' ' + BB.height);
        elem.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        //Set optional background
        if (typeof pagecolor != undefined ) {
            elem.setAttribute('style', 'background-color:'+pagecolor);
        
        }
        else {
            console.log("info - vyhmi.scale_fit pagecolor not defined. Using existing background.");
        }
    }
    
    //Convinience function to an attribute to an array like object
    //Examples called within vy:instrument
    //
    //  //tag1.value=0 will index corresponding array values[0]
    //  vy.instrument="vyhmi.map_attr(this, 'tag1', 'fill', ['red', 'green']);"
    //
    //  //tag1.value='normal' will index a property in values['normal']
    //  vy.instrument="vyhmi.map_attr(this, 'tag1', 'fill', { alarm:'red', normal:'green']);"
    //
    function map_attr( elem, tagid, attr, values) {   
        linktag( elem, tagid, function(tag){elem.setAttribute(attr, values[tag.value])});
    }

    
    //See map_attr for value parameter usage
    //NOTE - used to be named poke_style
    function map_style( elem, tagid, stylename, values) {   
        linktag( elem, tagid, function(tag){elem.style[stylename] = values[tag.value];});
    }
         
    //Convinience function to rotate an element about its center based on tag value.
    //If func is provided it will be used to conver tag.value to degrees, otherwise
    //use raw value
    function rotate( elem, tagid, func) {
        
        var get_degrees; //function to convert tag.value to degrees

        if ( ! func ) {
            get_degrees = function(tag) {
                return tag.value;
            };
        }
        else if ( typeof(func) === 'function' ) {
            get_degrees = function(tag) {
                return func(tag.value);
            };
        }
        else {
         
            get_degrees = new Function('tag', func);
        }        
        var doRotate = function(tag) {            
            var bb = elem.getBBox();
            var cx = bb.x + bb.width/2;
            var cy = bb.y + bb.height/2;
            //TODO - what if already translated? Will this eff up?
            var xform = 'rotate(' + get_degrees(tag) + ' ' + cx + ' ' + cy + ')';
            //console.log('doRotate xform:' + xform);
            elem.setAttribute('transform',xform);
        }
        
        linktag(elem, tagid, doRotate);        
    }
    
    //Replaces an element with a widget. The element to replace is normally
    //a preview image that is a placeholder in the SVG designer for placement
    //and size. The config object is widget specific parameterizations. You
    //must consult the documentation for the widget. Typically, at minimum,
    //the config object would specify the tagid(s) to link to.
    //
    //The preview element is replaced with a nested SVG node. Therefore all
    //widget script drawing uses relative coordinates with URC = 0,0.
    //
    //
    //  elem:       element to replace
    //
    //  url:        url for widget script. Script will be wrapped
    //              in a scoping function and be executed in the client global scope.
    //
    //  config:     widget specific configuration object that will be passed to init
    //              function.
    //
    function load_widget(elem, url, config) {
        
        console.log('load_widget:' + url + ' config:',config);
        
        var BB = elem.getBBox();
        
        //Cheat, use hosting desktop's JQuery to sync load the script
        window.parent.$.ajax({
            url: url,
            async: false,
            dataType: 'text', //Must use text type to prevent desktop window from evaluating the code
            success: function (code) {
                                             
                try {
                    //Wrap script in a scoping function
                    var create_widget = new Function('config',code);

                    //Compile ok so replace preview element
                    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
                    svg.setAttribute('x', BB.x);
                    svg.setAttribute('y', BB.y);
                    svg.setAttribute('width', BB.width);
                    svg.setAttribute('height', BB.height);                    
                    svg.setAttribute('overflow','visible');
                    elem.parentNode.replaceChild(svg, elem);

                    //Create the widget. Thisvar is the svg container
                    create_widget.call(svg, config);                                
                } catch(err){
                    console.log('load_widget create error:' + err.message);
                }
                                
            },
            error: function (jqXHR, textStatus, errorThrown) {
                //This is kind of fatal, probably a server or app config error. Nothing
                //will work after this.
                console.log('load_widget could not load from url:' + errorThrown);
            }
        });                
    }
    
    return {
        linktag: linktag,
        create_tagsub: create_tagsub,
        load_script: load_script,
        load_widget: load_widget,
        app_call: app_call,
        scale_fit_svg: scale_fit_svg,
        map_attr: map_attr,
        map_style: map_style,
        poke_style: map_style, //To keep backwards capability
        rotate: rotate,
        create_ctl_popup: create_ctl_popup
    };
})();

