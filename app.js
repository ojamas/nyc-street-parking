// Retrieve API key and username from config.js
var cartoUser = config.CARTO_USER;
var mapzenKey = config.MAPZEN_KEY;



// ==================================== MAP VARIABLES ====================================


// Declare Mapzen API key
L.Mapzen.apiKey = mapzenKey;

// Adds map to page with integrated Leaflet API using Mapzen API for base map data
var map = L.Mapzen.map('map', {
	//scene: L.Mapzen.BasemapStyles.Refill,
	center: [40.741368, -73.989428],	// sets initial centerpoint of map
	zoom: 11.5,						// sets initial zoom (zoom buttons also included by default)
	zoomDelta: 3,
	maxZoom: 20,
	minZoom: 10.75,
	//maxBounds:
	zoomAnimationThreshold: 20 // How high should this be??
});


var boroTooltip = L.tooltip( {
		direction: top,
		sticky: true,
		className: 'boro-tooltip'		// CSS styling class
});

var nbhdTooltip = L.tooltip( {
		direction: top,
		sticky: true,
		className: 'nbhd-tooltip'		// CSS styling class
});

var signTooltip = L.tooltip( {
	sticky: true,
	className: 'sign-tooltip'
});

var streetTooltip = L.tooltip( {
	sticky: true,
	className: 'street-tooltip'
})





// Calls zoomLayerChange whenever the zoom level changes on the map
map.on('zoomend', function (e) {
	zoomLayerChange();
});



// Adds a scale to the map in the bottom left corner
L.control.scale().addTo(map);

// Adds search functionality from Mapzen with Leaflet in top left corner
// var geocoder = L.Mapzen.geocoder('mapzen-6fZzCy1', {
// 	params: {
// 		sources: 'osm',				// restricts search options to OpenStreetMaps (OSM)
// 		'boundary.country': 'USA'	// restricts search options to within USA
// 	}
// });
// geocoder.addTo(map);




// ==================================== GLOBAL VARIABLES ====================================


// Map layers
var boroLayer;
var nbhdLayer;
var mSignLayer;
var boroNbhdsLayer;
var streetLayer;

// feature group for neighborhoods
var nbhdFG = new L.featureGroup();

// feature group for boroughs
var boroFG = new L.featureGroup();

// Options for Leaflet circleMarker
var signMarkerOptions = {
	radius: 6,
	fillColor: "#36a03d",
	color: "#000",
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8
};


// SQL queries
var sqlBorough = "SELECT * FROM borough_boundaries";

var sqlNeighborhoods = "SELECT * FROM neighborhood_tabulation_areas";


// Endpoint for CARTO SQL API
var endpoint = "https://" + cartoUser + ".carto.com/api/v2/sql?format=GeoJSON&q=";

// Full urls to use in $.getJSON calls
var boroughURL = endpoint + sqlBorough;
var nbhdURL = endpoint + sqlNeighborhoods;


// stores selected borough for display of borough specific neighborhoods
var boroSelect = "";

// stores selected neighborhood for displaying signs
var nbhdSelect = "";



// object for neighborhood features
var nbhdArr = {};

// object for borough features
var boroArr = {};




// ==================================== CONTROL SETUP ====================================


// control to show sign description in top right of screen on hover
var info = L.control();

info.onAdd = function (map) {
	this._div = L.DomUtil.create('div', 'info');	// create a div with class "info"
	this.update();
	return this._div;
};

// function used to update control based on feature properties passed
info.update = function (props) {


	// not sure what props is exactly, but it appears to be a boolean?????
	if (props) {
		var formattedDesc = props.multi_sign_desc.split('*').join('<br />');
	}

	this._div.innerHTML = '<h4>Sign Description</h4>' + (props ? '<b>' + formattedDesc + '</b><br />' + props.sign_id : 'Hover over a sign');
};

// add control to map
info.addTo(map);




// ==================================== STYLE FUNCTIONS ====================================


// Functions to set default feature styles

function boroStyle(feature) {
	return {
		color: '#21892f',
		fillColor: '#21892f',
		weight: 2,
		fillOpacity: 0.5,
		opacity: 1
	};
}

function nbhdStyle(feature) {
	return {
		color: '#232fdb',
		fillColor: '#232fdb',
		weight: 2,
		fillOpacity: 0.5,
		opacity: 1
	};
}

function streetStyle(feature) {
	return {
		weight: 10,
		fillOpacity: 0.4,
		opacity: 0.4
	};
}

function signStyle(feature) {
	return {
		// not sure if this will be used. Currently implementing signMarkerOptions
	};
}



// ==================================== SIGN FUNCTIONS ====================================


// pointToLayer function for placing circle markers on map
function plotMSigns(feature,latlng) {
	return L.circleMarker(latlng, signMarkerOptions);
}


// onEachFeature function for each sign
function onEachMSign(feature,layer) {

	// add tooltip to each sign marker
	layer.bindTooltip(signTooltip);

	layer.on({
		mouseover: highlightSign,
		mouseout: resetSignHighlight,
	});
}


// Determines events when feature is hovered over
function highlightSign(e) {
	var layer = e.target;

	// create formatted tooltip contents based off of combined sign descriptions
	var formattedTooltip = layer.feature.properties.multi_sign_desc.split('*').join('<br />');

	// set tooltip content to reflect sign descriptions
	layer.setTooltipContent(formattedTooltip);

	layer.setStyle({
		//radius: 10,		// for some reason, this isn't reset on mouseout
		weight: 3,
		color: '#000000',
		fillOpacity: 0.8,
		fillColor: '#af1d81'
	});

	// handling for other browsers??? included in online example
	// CHECK THIS
	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
		layer.bringToFront();
	}

	// call to control functions to show sign description in upper right corner
	info.update(layer.feature.properties);
}

// Removes styling/displays when feature is not hovered over
function resetSignHighlight(e) {
	mSignLayer.resetStyle(e.target);

	// pass nothing to info method
	info.update();
}



// ==================================== BORO FUNCTIONS ====================================


// onEachFeature function for each borough
function onEachBoro(feature,layer) {

	// constructs array (object?) with structure {boro_name: layer object}
	boroArr[feature.properties.boro_name] = layer;

	// add tooltip to layer 		NOTE: this has to be here rather than in highlightBoro
	layer.bindTooltip(boroTooltip);

	// add event listeners to layer
	layer.on({
		mouseover: highlightBoro,
		mouseout: resetBoroHighlight,
		click: zoomToBoro
	});
}

// Determines events when feature is hovered over
function highlightBoro(e) {
	
	var layer = e.target;

	// NOTE: this has to be here rather than in parent function (onEachBoro)
	layer.setTooltipContent(layer.feature.properties.boro_name);

	// set highlight style
	layer.setStyle({
		weight: 5,
		color: '#63497c',
		fillColor: '#63497c',
		fillOpacity: 0.7
	});

	// CHECK TO SEE IF THIS IS NECESSARY
	// handling for other browsers??? included in online example
	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
		layer.bringToFront();
	}
}

// ******************************** BUG HERE ***********************************
// *** After a boro is selected two times, the highlight will not reset until a
// *** subsequent mouse hover and mouseout. After the first occurrence, this will
// *** repeat upon each new boro selection.
// *****************************************************************************
// *** THOUGHTS: The boro layer added back in to a boro previously selected is
// *** not having the resetBoroHighlight function applied to it.
// *** REASONS: 1) resetBoroHighlight applies to boroLayer and not to boroFG
// *** 2) The resetStyle() method applies only to GeoJSON layers. Only boroLayer
// *** is a "properly created" GeoJSON layer in this context. Are the others also
// *** GeoJSON or not? If not, how is the highlight reset with a new hover & mousout?
// ******************************************************************************

// Removes styling/displays when feature is not hovered over
function resetBoroHighlight(e) {
	boroLayer.resetStyle(e.target);
	//console.log("boro style reset: " + e.target.feature.properties.boro_name)
	//boroLayer.setStyle(boroStyle);
}

function zoomToBoro(e) {

	var boroName = e.target.feature.properties.boro_name;
	var centerpoint;

	// handles resetting layers for unselected boro
	if (boroSelect != boroName) {
		// don't call functions before a boro has been selected
		if (boroSelect != "") {
			// hide neighborhoods from previously selected boro
			hideBoroNbhds(boroSelect);

			// show previously selected boro layer
			showBoroLayer(boroSelect);
		}
		
		// store newly selected boro
		boroSelect = boroName;
	}
	
	// CHECK TO SEE IF THIS IS NECESSARY
	// remove borough-specific layers upon new borough selection
	if (map.hasLayer(boroNbhdsLayer)) {
		map.removeLayer(boroNbhdsLayer);
	}

	// manual override for Queens centerpoint, otherwise use centerpoint of borough bounds
	// (because Queens is too large when including outer "neighborhoods" such as islands)
	if (boroName == "Queens") {
		centerpoint = L.latLng(40.719805, -73.823359);
	} else {
		centerpoint = e.target.getBounds().getCenter();
	}

	// Set map focused on borough with constant zoom level
	map.setView(centerpoint, 12.2);

	// remove specific borough layer when selected
	hideBoroLayer(boroName);

	// show neighborhoods only within selected borough
	showBoroNbhds(boroName);

}


// ==================================== NBHD FUNCTIONS ====================================


// onEachFeature function for each neighborhood
function onEachNbhd(feature,layer) {

	// array to group neighborhood features with ntaname key value
	// array with non-numeric indices works as an object, bracket notation allows for dynamically assigning property name
	nbhdArr[feature.properties.ntaname] = layer;


	// add tooltip to layer 		NOTE: this has to be here rather than in highlightBoro
	layer.bindTooltip(nbhdTooltip);

	// add event listeners to layer
	layer.on({
		mouseover: highlightNbhd,
		mouseout: resetNbhdHighlight,
		click: zoomToNbhd
	});
}

// Determines events when feature is hovered over
function highlightNbhd(e) {
	var layer = e.target;

	// NOTE: this has to be here rather than in parent function onEachBoro
	layer.setTooltipContent(layer.feature.properties.ntaname);

	layer.setStyle({
		weight: 5,
		color: '#e6f939',
		fillColor: '#e6f939',
		opacity: 0.5,
		fillOpacity: 0.5
	});

	// CHECK TO SEE IF THIS IS NECESSARY
	// handling for other browsers??? included in online example
	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
		layer.bringToFront();
	}
}


// ******************************* BUG HERE ****************************************
// *** Same bug as in resetBoroHighlight
// *********************************************************************************

// Removes styling/displays when feature is not hovered over
function resetNbhdHighlight(e) {
	nbhdLayer.resetStyle(e.target);
}

// focus on neighborhood when clicked
function zoomToNbhd(e) {

	var nbhdName = e.target.feature.properties.ntaname;


	// handles resetting layers for unselected neighborhood
	if (nbhdSelect != nbhdName) {
		// don't call functions before a nbhd has been selected
		if (nbhdSelect != "") {
			// show previously selected boro layer
			showNbhdLayer(nbhdSelect);
		}
		
		// store newly selected neighborhood
		nbhdSelect = nbhdName;
	}

	//var layer = e.target;
	map.fitBounds(e.target.getBounds());

	// remove specific neighborhood layer when selected
	hideNbhdLayer(nbhdSelect);

	// show streets based off neighborhood selected
	// previous streetLayer is removed within showStreets()
	showStreets(nbhdName);
}


// ==================================== STREET FUNCTIONS ====================================


function onEachStreet(feature,layer) {

	// add tooltip to layer
	layer.bindTooltip(streetTooltip);

	// add event listeners to layer
	layer.on({
		mouseover: highlightStreet,
		mouseout: resetStreetHighlight,
		click: zoomToStreet
	});
}


// Determines events when feature is hovered over
function highlightStreet(e) {
	var layer = e.target;

	// NOTE: this has to be here rather than in parent function onEachBoro
	layer.setTooltipContent(layer.feature.properties.full_stree);

	layer.setStyle({
		weight: 20,
		//color: '#e6f939',
		//fillColor: '#e6f939',
		// opacity: 0.5,
		// fillOpacity: 0.5
	});

	// handling for other browsers??? included in online example
	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
		layer.bringToFront();
	}
}


// Removes styling/displays when feature is not hovered over
function resetStreetHighlight(e) {
	streetLayer.resetStyle(e.target);
}

// focus on street when clicked
function zoomToStreet(e) {
	map.fitBounds(e.target.getBounds());

	showSigns();
}



// ==================================== MAP FUNCTIONS ====================================


// Displays different layers based on zoom level
function zoomLayerChange() {

	var currentZoom = map.getZoom();

	console.log("zoom = " + currentZoom);
	//console.log("bounds = " + map.getBounds());
	//console.log("center = " + map.getCenter());


	if (currentZoom < 14.5) {
		if (map.hasLayer(mSignLayer)) {
			map.removeLayer(mSignLayer);
		}
		if(map.hasLayer(streetLayer)){
			map.removeLayer(streetLayer);
		}
	}

	// if (currentZoom > 16) {
	// 	if (map.hasLayer(boroLayer)) {
	// 		map.removeLayer(boroLayer);
	// 	}
	// 	if(map.hasLayer(nbhdLayer)){
	// 		map.removeLayer(nbhdLayer);
	// 	}
	// }
	// if (currentZoom < 16 && currentZoom >= 12.5) {
	// 	if (map.hasLayer(mSignLayer)) {
	// 		map.removeLayer(mSignLayer);
	// 	}
	// 	if(map.hasLayer(streetLayer)){
	// 		map.removeLayer(streetLayer);
	// 	}
	// 	if (map.hasLayer(boroLayer)) {
	// 		map.removeLayer(boroLayer);
	// 	}
	// 	nbhdFG.addLayer(nbhdLayer);
	// }
	// if (currentZoom < 12.5) {
	// 	if(map.hasLayer(nbhdLayer)){
	// 		map.removeLayer(nbhdLayer);
	// 	}
	// 	if(map.hasLayer(streetLayer)){
	// 		map.removeLayer(streetLayer);
	// 	}

	// 	boroFG.addLayer(boroLayer);
	// }
}


// ==================================== LAYER FUNCTIONS ====================================



// places neighborhood layer on map
function showNbhdLayer(nbhd) {
	nbhdFG.addLayer(nbhdArr[nbhd]);
}

// removes neighborhood layer from map
function hideNbhdLayer(nbhd) {
	nbhdFG.removeLayer(nbhdArr[nbhd]);
}


// places borough layer on map
function showBoroLayer(boro) {
	console.log("showBoroLayer boro: " + boro);
	boroFG.addLayer(boroArr[boro]);
}

// removes borough layer from map
function hideBoroLayer(boro) {
	console.log("hideBoroLayer boro: " + boro);
	boroFG.removeLayer(boroArr[boro]);
}


// shows neighborhoods by borough
function showBoroNbhds(boro) {
	// loop through collection of neighborhoods
	for (nbhd in nbhdArr) {
		// show neighborhood if its boro matches boro selected
		if (nbhdArr[nbhd].feature.properties.boro_name === boro) {
			showNbhdLayer(nbhd);
		}
	}
}

// hides neighborhoods by borough
function hideBoroNbhds(boro) {

	//console.log("hideBoroNbhds, boro: " + boro);

	// loop through collection of neighborhoods
	for (nbhd in nbhdArr) {
		// hide neighborhood if its boro matches boro selected
		if (nbhdArr[nbhd].feature.properties.boro_name === boro) {
			hideNbhdLayer(nbhd);
		}
	}
}




// ==================================== SIGN LAYER ====================================


// Creates signs per SQL query to CARTO tables API
function showSigns(){


	// WARNING: uses global nbhdSelect. Not sure if this is a good idea or not.
	var signsSQL = "SELECT * FROM nyc_signs WHERE ST_Within(nyc_signs.the_geom,(select the_geom from neighborhood_tabulation_areas where ntaname='" + nbhdSelect + "'))";

	mSignsURL = endpoint + signsSQL;



	// Remove any pre-existing layer
	if(map.hasLayer(mSignLayer)){
		map.removeLayer(mSignLayer);
	};

	// jQuery function to retrieve data from CARTO DB
	$.getJSON(mSignsURL, function(data) {
		mSignLayer = L.geoJSON(data, {
			pointToLayer: plotMSigns,	// function to place circle markers for sign on map
			onEachFeature: onEachMSign	// function to show sign information/interactivity
		}).addTo(map);
	})
	// Alert when getJSON succeeds
	.done(function() {
		console.log("sign $geoJSON succeeded");
		// alert( "$.getJSON succeeded");
	})
	// Alert when getJSON fails
	.fail(function() {
		alert( "sign $.getJSON failed");
	});
};


// ==================================== NBHD LAYER ====================================


// Creates neighborhood boundaries layer
function showNeighborhoods(){

	// if (map.hasLayer(neighborhoodLayer)) {
	// 	map.removeLayer(neighborhoodLayer);
	// };

	// jQuery function to retrieve data from CARTO DB
	$.getJSON(nbhdURL, function(data) {
		//console.log(data);
		nbhdLayer = L.geoJSON(data, {
			style: nbhdStyle,
			onEachFeature: onEachNbhd	// function to add neighborhood interactivity
		}); //.addTo(map);
	})
	// Alert when getJSON succeeds
	.done(function() {
		console.log("neighborhood $geoJSON succeeded");
		
		// add featureGroup to map, features are added later
		nbhdFG.addTo(map);

	})
	// Alert when getJSON fails
	.fail(function() {
		alert( "nbhd $.getJSON failed");
	});
}


// ==================================== BORO LAYER ====================================


// Creates borough boundaries layer
function showBoroughs(){

	// if (map.hasLayer(boroLayer)) {
	// 	map.removeLayer(boroLayer);
	// };

	// jQuery function to retrieve data from CARTO DB
	$.getJSON(boroughURL, function(data) {
		boroLayer = L.geoJSON(data, {
			style: boroStyle,			// function to set default styling
			onEachFeature: onEachBoro	// function to show borough interactivity
		});
		//.addTo(map);
	})
	// Alert when getJSON succeeds
	.done(function() {
		console.log("borough $geoJSON succeeded");
		
		// add boror Feature Group to map, boros can be added/removed dynamically
		boroFG.addTo(map);

		// add boroLayer as top/initial layer
		//boroFG.addLayer(boroLayer);

		// add each boro from boroArr
		for (boro in boroArr) {
			boroFG.addLayer(boroArr[boro]);
		}

	})
	// Alert when getJSON fails
	.fail(function() {
		alert(" boro $.getJSON failed");
	});

}


// ==================================== STREET LAYER ====================================


// Creates street layer
function showStreets(nbhd){

	var streetsSQL;

	streetsSQL = "SELECT * FROM centerline WHERE ST_Within(centerline.the_geom, (SELECT the_geom FROM neighborhood_tabulation_areas WHERE ntaname='" + nbhd + "'))";

	// get current map bounds
	//var bounds = map.getBounds();

	// create rectangle polygon type from map bounds
	//var polygon = L.rectangle(bounds);

	//var boundsGeoJSON = JSON.stringify(polygon.toGeoJSON().geometry);

	//console.log(JSON.stringify(polygon.toGeoJSON().geometry));

	//var queryGeom = "[[" + bounds.getWest() + ", " + bounds.getNorth() + "], [" + bounds.getEast() + ", " + bounds.getNorth() + "], [" + bounds.getEast() + "," + bounds.getSouth() + "], [" + bounds.getWest() + ", " + bounds.getSouth() + "]]";

	//var queryGeomReverse = "[[" + bounds.getNorth() + ", " + bounds.getWest() + "], [" + bounds.getNorth() + ", " + bounds.getEast() + "], [" + bounds.getSouth() + "," + bounds.getEast() + "], [" + bounds.getSouth() + ", " + bounds.getWest() + "]]";

	//console.log(queryGeom);
	//console.log(queryGeomReverse);
	//console.log("polygon = " + polygon.getLatLngs().toString()); //geometry.coordinates.toBBoxString());

	// use rectangle polygon to query streets
	//streetURL = endpoint + "SELECT * FROM centerline WHERE ST_Within(centerline.the_geom," + queryGeomReverse + "::geometry)";

	//streetURL = endpoint + "SELECT * FROM centerline WHERE ST_Within(centerline.the_geom, ST_GeomFromGeoJSON(" + boundsGeoJSON + "))";


	streetURL = endpoint + streetsSQL;


	// Remove streetsLayer from previously selected neighborhood
	if (map.hasLayer(streetLayer)) {
		map.removeLayer(streetLayer);
	};

	// jQuery function to retrieve data from CARTO DB
	$.getJSON(streetURL, function(data) {
		streetLayer = L.geoJSON(data, {
			style: streetStyle,			// function to set default styling
			onEachFeature: onEachStreet	// function to show borough interactivity
		})
		.addTo(map);
	})
	// Alert when getJSON succeeds
	.done(function() {
		console.log("street $geoJSON succeeded");
	})
	// Alert when getJSON fails
	.fail(function() {
		alert("street $.getJSON failed");
	});
}

// ==================================== INITIALIZATION FUNCTIONS ====================================


// Creates initial layers
function drawMap(){
	console.log("initial zoom = " + map.getZoom());
	
	showBoroughs();
	showNeighborhoods();
	//showSigns();
}


// jQuery function that checks if entire DOM has loaded before proceding
// $( document ).ready(function() {
// 	console.log("document ready!");
// 	drawMap();
// });

// This method is apprently better than (document).ready()
$(window).on('load', function() {
	console.log("window loaded!");
	drawMap();
});