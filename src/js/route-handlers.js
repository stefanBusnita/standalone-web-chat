/**
 *Handlers just for routing 
 * Sending the html file back to the client with the chat template
 * In the unfortunate case that something bad happens along the way, just blame the Daleks 
 */

var routeHandlers = {}; 

routeHandlers.chatTemplateFile = function(req, res) {

	res.sendFile('template.html', {
		"root" : __dirname + '/../html'
	});

};

routeHandlers.chatTemplateFileForUsername = function(req, res) {

	console.log(req.params);
	
	res.sendFile('template.html', {
			"root" : __dirname + '/../html',
			headers : {
				username : req.params.username
			}
		});
};

routeHandlers.routeErrorHandler = function(err, req, res, next) {
	res.status(500);
	res.json({
		error : "Something went terribly wrong ! Daleks might be behind this mischief !",
		msg : err.code + " " + err.status
	});
}; 

exports.routeHandlers = routeHandlers;