(function() {
	var app = require('express')(),
	    http = require('http').Server(app),
	    globals = require(__dirname + '/globals.js'),
	    io = require('socket.io')(http),
	    connections = [],
	    express = require("express"),
	    data = {},
	    noUsers = 0;

	app.use("/scripts", express.static(globals.paths['js']));
	app.use("/styles", express.static(globals.paths['styles']));
	app.use("/images", express.static(globals.paths['img']));

	io.on('connection', function(socket) {

		registerSocketEvent(socket, 'disconnect', function() {
			delete connections[socket.conn.id];
			io.emit('update', toObject(connections));
		});

		registerSocketEvent(socket, 'username', function(username) {

			if (!username) {
				username += "potato" + Math.floor(Math.random() * 1000) + 1;
			}

			if (checkForExistingUser(username)) {
				socket.emit('username', "has");
				return;
			} else {
				connections[socket.conn.id] = {
					"id" : socket.id,
					"username" : username
				};
				console.log("a trecut mai departe");
				socket.emit('username', username);
				io.emit('update', toObject(connections));
			}

		});

		registerSocketEvent(socket, 'chat message', function(sentData) {
			data = {
				message : sentData.message,
				me : connections[sentData.me]
			};
			
			socket.broadcast.emit('chat message', data);
											
		});
		
		registerSocketEvent(socket, 'private message', function(sentData) {
			data = {
				message : sentData.message,
				me : connections[sentData.me],
				to : sentData.to
			};
			console.log("on server private message was ",data, sentData);
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
			"root" : globals.paths.html
		});
	});

	http.listen(3000, function() {
		console.log('Server started on PORT :3000');
	});

})();
