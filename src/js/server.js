(function() {
	var app = require('express')(),
	    http = require('http').Server(app),
	    globals = require(__dirname + '/globals.js'),
	    io = require('socket.io')(http),
	    ss = require('socket.io-stream'),
	    connections = [],
	    express = require("express"),
	    data = {},
	    noUsers = 0;
	var path = require('path');
	var fs = require('fs');
	
	app.use("/scripts", express.static(__dirname));
	app.use("/styles", express.static(__dirname + '/../css'));
	app.use("/images", express.static(__dirname + '/../img'));
	app.use("/static", express.static(__dirname + '/../sounds'));

	io.on('connection', function(socket) {

		ss(socket).on('file', function(stream, data) {
			//var filename = path.basename(data.name);
			console.log(data.size);
			var size = 0;
						
			//stream.pipe(fs.createWriteStream(data));		
			/*
			ss(socket).emit('file', stream, {
							size : file.size
						});
						ss.createBlobReadStream(file).pipe(stream);			*/
			
		});

		

		registerSocketEvent(socket, 'disconnect', function() {
			delete connections[socket.conn.id];
			data = {
				updatedList : toObject(connections),
				disconnected : socket.conn.id
			};
			io.emit('update', data);
		});

		registerSocketEvent(socket, 'username', function(data) {
			
			if (!data.username) {
				data.username += "potato" + Math.floor(Math.random() * 1000) + 1;
			}

			if (checkForExistingUser(data.username)) {
				data = {
					username : "",
					errorCode : globalFlags.errors.USER_EXISTS
				};
				socket.emit('username', data);
				return;

			} else {
				connections[socket.conn.id] = {
					"id" : socket.id,
					"username" : data.username,
					"location" : data.location,
					"status" : 1//globalFlags.status.AVAILABLE
				};

				socket.emit('username', {
					username : data.username
				});

				data = {
					updatedList : toObject(connections),
					disconnected : socket.conn.id
				};

				io.emit('update', data);
			}

		});

		registerSocketEvent(socket, 'chat message', function(sentData) {
			data = {
				message : sentData.message,
				me : connections[sentData.me]
			};

			socket.broadcast.emit('chat message', data);

		});

		registerSocketEvent(socket, 'buzz', function(sentData) {			
			socket.broadcast.to(sentData.id).emit('buzz', sentData);
		});
		
		registerSocketEvent(socket, 'typing', function(sentData) {			
			socket.broadcast.to(sentData.to).emit('typing', sentData);
		});
		
		registerSocketEvent(socket, 'status change', function(sentData) {
			connections[sentData.me].status = sentData.status;
			io.emit('status change', sentData);
		});

		registerSocketEvent(socket, 'private message', function(sentData) {
			data = {
				message : sentData.message,
				me : connections[sentData.me],
				to : sentData.to
			};
			socket.broadcast.to(sentData.to.socketId).emit('private message', data);
		});

	});

	function registerSocketEvent(socket, type, fn) {

		try {
			if (!type) {
				throw {
					name : globals.errors.SYSTEM,
					message : "Type of event can't be empty.",
					toString : function() {
						return this.name + ": " + this.message;
					}
				};

			}
			if (!fn || typeof fn != 'function') {
				throw {
					name : globals.errors.SYSTEM,
					message : "Type of fn can't be undefined.'",
					toString : function() {
						return this.name + ": " + this.message;
					}
				};
			}
		} catch(e) {
			console.log(e.toString());
		} finally {

		}

		socket.on(type, fn);
	};

	function toObject(associativeArray) {
		var object = {},
		    counter = 0;

		for (key in associativeArray) {
			object[counter.toString() + 'client'] = associativeArray[key];
			counter++;
		};
		return object;
	};

	function checkForExistingUser(username) {

		for (var key in connections) {
			if (connections[key].username == username)
				return true;
		}
		return false;

	}


	app.get('/', function(req, res) {
		res.sendFile('template.html', {
			"root" : __dirname + '/../html'
		});
	});

	http.listen(3000, function() {
		console.log('Server started on PORT :3000');
	});

})();
