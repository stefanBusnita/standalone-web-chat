(function() {
	var app = require('express')(),
	    compression = require('compression'),
	    CryptoJS = require("crypto-js"),
	    http = require('http').Server(app),
	    globals = require(__dirname + '/globals.js'),
	    handlers = require(__dirname + '/route-handlers.js'),
	    io = require('socket.io')(http),
	    ss = require('socket.io-stream'),
	    connections = [],
	    rooms = {},
	    passwords = {},
	    express = require("express"),
	    data = {},
	    noUsers = 0,
	    mySuperNotSoSecretKey = 'B4c0/\/ with some secret key 123'+new Date().toString(), // USE DB IF THIS DOES NOT SUITE YOUR NEEDS :)
	    wrongPasswordMessage = "Wrong password ! Gotcha ! :)";

	app.use(compression({
		level : 1
	}));

	var path = require('path');
	var fs = require('fs');

	/**
	 * add all middleware without any path, therefore general
	 * add to our middleware stack all the static files we are going to use on the client side.
	 * add to middleware an error handler for routing
	 * -------------------------------------------------------------------------------------------
	 */
	app.use("/scripts", express.static(__dirname));
	app.use("/styles", express.static(__dirname + '/../css'));
	app.use("/node", express.static(__dirname + '/../../node_modules/flag-icon-css'));
	app.use("/images", express.static(__dirname + '/../img'));
	app.use("/static", express.static(__dirname + '/../sounds'));
	app.use(handlers.routeHandlers.routeErrorHandler);
	/**
	 * -------------------------------------------------------------------------------------------
	 */

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

		/**
		 * Join room event
		 * check if password is ok, and do corresponding actions for each case.
		 */
		registerSocketEvent(socket, 'join room', function(data) {

			if (rooms[data.name].private) {

				var bytes = CryptoJS.AES.decrypt(passwords[data.name].toString(), mySuperNotSoSecretKey),
				    plaintext = bytes.toString(CryptoJS.enc.Utf8);

				console.log(plaintext, data);
				
				if (String(plaintext) == new Buffer(data.password,'base64').toString('ascii')) {
					joinRoomCallback(data, socket);
					return;
				} else {
					console.log("wrong pass");
					data = {
						message : wrongPasswordMessage,
						roomName : data.name
					};

					io.to(connections[socket.conn.id].id).emit('wrong', data);
					return;
				}
			} else {
				joinRoomCallback(data, socket);
			}
		});
		
		/**
		 * Leaving a certain room
		 * Remove our user from the rooms buffer
		 */
		registerSocketEvent(socket, 'leave room', function(data) {
			socket.leave(data);
			for (var i = 0; i < rooms[data].users.length; i++) {
				if (rooms[data].users[i] == socket.conn.id) {
					rooms[data].users.splice(1, i);
					break;
				}
			}
			io.emit('update rooms', rooms);
			io.emit('update room users', data);
			//check if admin remove room from rooms list also
		});

		/**
		 * Create room event 
		 * save password for later check and update rooms list to all
		 * join room because you created it
		 */
		registerSocketEvent(socket, 'room created', function(data) {

			if (data.private) {
				var pass = new Buffer(data.password, 'base64').toString('ascii');
				var ciphertext = CryptoJS.AES.encrypt(pass, mySuperNotSoSecretKey);
				passwords[data.room] = ciphertext;
				delete data.password;
			}

			rooms[data.room] = data;
			socket.join(data.room);
			io.emit('update rooms', rooms);
		});
		
		/**
		 * Send room message to certain room
		 */
		registerSocketEvent(socket, 'room message', function(data) {

			io.to(data.roomName).emit('room message', data);
		});
		/**
		 * Disconnect event launched by any client leaving the application
		 * delete connection of that certain user
		 * update rooms user list, deleting the user that left from all the rooms
		 * launch update users, update rooms, update room users with new data
		 */
		registerSocketEvent(socket, 'disconnect', function() {
			var name;
			if (connections[socket.conn.id]) {
				name = connections[socket.conn.id].username;
			}
			delete connections[socket.conn.id];
			data = {
				updatedList : toObject(connections),
				disconnected : socket.conn.id
			};

			io.emit('update users', data);
			for (var k in rooms) {
				rooms[k].users = rooms[k].users.reduce(function(memo, user) {
					if (user != socket.conn.id) {
						memo.push(user);
					}
					return memo;
				}, []);

			};

			io.emit('update rooms', rooms);
			data = {
				disconnected : name
			};
			io.emit('update room users', data);
		});

		registerSocketEvent(socket, 'username', function(data) {

			if (!data.username) {
				data.username += "potato" + Math.floor(Math.random() * 1000) + 1;
			}

			if (Object.keys(rooms).length != 0) {
				io.emit('update rooms', rooms);
			}

			if (checkForExistingUser(data.username)) {
				data = {
					username : "",
					errorCode : globals.globalFlags.errors.USER_EXISTS
				};
				socket.emit('username', data);
				return;

			} else {
				connections[socket.conn.id] = {
					"id" : socket.id,
					"username" : data.username,
					"location" : data.location,
					"status" : globals.globalFlags.status.AVAILABLE
				};

				socket.emit('username', {
					username : data.username
				});

				data = {
					updatedList : toObject(connections),
					disconnected : socket.conn.id
				};

				io.emit('update users', data);
			}

		});
		/**
		 * 
		 */
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

	function joinRoomCallback(data, socket) {
		socket.join(data.name);
		rooms[data.name].users.push(socket.conn.id);
		io.emit('update rooms', rooms);
		io.emit('update room users', data.name);
	};

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

	app.get('/', handlers.routeHandlers.chatTemplateFile);	

	http.listen(3000, function() {
		console.log('Server started on PORT :3000');
	});

})();
