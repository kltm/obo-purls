////
////
////

// Std utils.
var fs = require('fs');
var path = require('path');
var us = require('underscore');
var yaml = require('yamljs');

///
/// Helpers and aliases.
///

var each = us.each;

function ll(arg1){
    console.log('test-server [' + (new Date()).toJSON() + ']: ', arg1); 
}

function _die(message){
    console.error('TEST_SERVER [' + (new Date()).toJSON() + ']: ' + message);
    process.exit(-1);
}

// Return a list of all files in a given dir.
// TODO: Recursive?
function _all_files(dir){
    var ret = [];

    ret = fs.readdirSync(dir);

    return ret;
}

///
/// CLI handling, environment setup, and initialization of clients.
///

// CLI handling.
var argv = require('minimist')(process.argv.slice(2));
//console.dir(argv);

// What directory will we monitor/operate on.
var config_dir = argv['d'] || argv['directory'];
if( ! config_dir ){
    _die('Option (d|directory) is required.');

    // Make sure extant, etc.
    var dstats = fs.statSync(config_dir);
    if( ! dstats.isDirectory() ){
	_die('Option (d|directory) is not a directory: ' + config_dir);
    }
}else{
    ll('Will read configs in dir: ' + config_dir);
}

// What test port to listen on.
var port = argv['p'] || argv['port'];
if( ! port ){
    _die('Option (p|port) is required.');
}else{
    ll('Will listen on port: ' + port);
}

///
/// Startup.
///

// Start data read-in.
var keyed_configs = {};
var all_configs = _all_files(config_dir);
each(all_configs, function(config_fname){
    var fname = config_dir + '/' + config_fname;
    if( path.extname(fname) === '.yml' ){
	ll('Reading: ' + fname);
	var conf = yaml.load(config_dir + '/' + config_fname);
	var bname = path.basename(config_fname);
	var key = bname.substr(0, bname.length-4);
	var entries = conf['entries'] || [];
	keyed_configs[key] = entries;
	ll('KEY:' + key + ', ' + entries.length);
    }
});

// Initial server setup.	
var express = require('express');
var app = express();

// Homepage!
app.get('/', function (req, res) {
    res.send('Redirection made easy!');
});

// Default status.
var dstatus = 302;

// Start getting routes, cycle through each file's config...
each(keyed_configs, function(entries, key){

    // 
    each(entries, function(entry){

	// Role out the three types by detection.
	if( typeof(entry['exact']) !== 'undefined' ){ // exact

	    var exact = entry['exact'];
	    var replacement = entry['replacement'];
	    var exact_route = '/' + key  + exact;

	    ll('Create exact route: ' + exact_route);
	    app.get(exact_route, function (req, res) {
		res.statusCode = dstatus;
		res.setHeader('Content-Type', 'text/plain');
		//res.setHeader('Location', replacement);
		res.location(replacement);
		res.end('Redirecting to ' + replacement);
	    });

	}else if( typeof(entry['prefix']) !== 'undefined' ){

	    var prefix = entry['prefix'];
	    var prefix_route = '/' + key + prefix + '*';
	    var prefix_target = entry['replacement'];

	    ll('Create prefix route: ' + prefix_route);
	    app.get(prefix_route, function (req, res) {
		
		// Trim out req path and return.
		//var rpath = req.path;
		var got = req.params[0];
		var redirect_final = prefix_target + got;
		//ll('A: ' + got);
		//ll('B: ' + redirect_final);
		
		res.statusCode = dstatus;
		res.setHeader('Content-Type', 'text/plain');
		res.location(redirect_final);
		res.end('Redirecting to '  + redirect_final);
	    });

	}else if( typeof(entry['regex']) !== 'undefined' ){ // regexp

	    var regexp = entry['regex'];
	    var target = entry['replacement'];

	    // Try and tease out what the regexp means.	    
	    //var regexp_route = '/' + key + regexp;
	    var regexp_route = regexp;

	    ll('Create prefix route (from: "' + regexp + '"): ' + regexp_route);
	    app.get(regexp_route, function (req, res) {

		var rewrite = target;

		// Compile regexp for use (grab matches).
		var regexp = new RegExp(regexp_route);
		var rpath = req.path;
		var matches = regexp.exec(rpath);
		each(matches, function(match, index){
		    rewrite = rewrite.replace('$'+index, match);
		});
		ll("Regexp kick to: " + rewrite);
		//_die(matches.join(', '));

	    	res.statusCode = dstatus;
	    	res.setHeader('Content-Type', 'text/plain');
	    	res.setHeader('Location', rewrite);
	    	res.end('Redirecting to ' + rewrite);
	    });

	}
    });
});

// Spin up.
app.listen(port);
