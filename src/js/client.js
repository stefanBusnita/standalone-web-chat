$(document).ready(function() {

	(function() {
		var socket = io(),
		    ss = require('socket.io-stream'),
		    data = {},
		    username,
		    connections = [],
		    rooms = {},
		    joinedRooms = {},
		    notifications = [],
		    notificationProperties = {
			timeout : 2000
		},
		    global = {
			windowTypes : {
				CHAT : 1,
				ROOM : 2
			}
		};

		var stream = ss.createStream();
		var filename = 'background.png';
		var fs = require('fs');
		var statuses = $("#chat-status>option").map(function() {
			var val = $(this).val().toString();
			return {
				text : $(this).text(),
				value : $(this).val()
			};
		});
		/*
		 ss(socket).emit('profile-image', stream, {
		 name : filename
		 });*/

		$('#file').change(function(e) {
			var file = e.target.files[0];
			var stream = ss.createStream();

			// upload a file to the server.
			ss(socket).emit('file', stream, {
				size : file.size
			});
			var blobStream = ss.createBlobReadStream(file);
			var size = 0;

			blobStream.on('data', function(chunk) {
				size += chunk.length;
				console.log(Math.floor(size / file.size * 100) + '%');
			});

			blobStream.pipe(stream);

		});

		ss(socket).on('file', function(data) {
			console.log(data);
			//downloadFileFromBlob([data], "gigi.jpg");
		});

		/*
		 var downloadFileFromBlob = ( function() {
		 var a = document.createElement("a");
		 document.body.appendChild(a);
		 a.style = "display: none";
		 return function(data, fileName) {
		 var blob = new Blob(data, {
		 type : "octet/stream"
		 }),
		 url = window.URL.createObjectURL(blob);
		 a.href = url;
		 a.download = fileName;
		 a.click();
		 window.URL.revokeObjectURL(url);
		 };
		 }());*/

		/*
		 //send data
		 ss(socket).on('file', function(stream) {
		 fs.createReadStream('/path/to/file').pipe(stream);
		 });

		 // receive data
		 ss(socket).emit('file', stream);
		 stream.pipe(fs.createWriteStream('file.txt'));

		 */

		$("#myModal").modal();
		$('.chatWindow').draggable({
			containment : 'parent',
			handle : ".lobby-header"
		});
		$('.chatWindow').resizable();

		$('#myModal').on('hidden.bs.modal', function() {
			checkNotificationPermission();
			$.get("http://ipinfo.io", doLocationCallback, "jsonp").fail(doLocationCallback);
		});

		$('#roomModal').on('hidden.bs.modal', function() {
			data = {
				room : $('#roomName').val(),
				password : $('#roomPassword').val()
			};

			socket.emit('room created', data);
			$('#roomName').val('');
			$('#roomPassword').val('');
			data.admin = true;
			joinedRooms[data.room] = data;
			//create chat room window
			//room created
			//update chat rooms list
		});

		function doLocationCallback(response) {
			data = {
				username : $('#username').val(),
				location : {
					city : response && response.city ? response.city : "",
					country : response && response.country ? response.country : ""
				}
			};
			socket.emit('username', data);
		}

		//remove notifications as the user requests.
		(function() {
			this.spawnNotification = function(theBody, theIcon, theTitle) {
				var options = {
					body : theBody,
					icon : theIcon
				};
				var notification = new Notification(theTitle, options);
				setTimeout(function() {
					notification.close();
				}, notificationProperties.timeout);
			};

			this.checkNotificationPermission = function() {
				if (!("Notification" in window)) {
					alert("This browser does not support desktop notification. Please use Mozilla or Chrome.");
					return;
				} else if (Notification.permission === "granted") {
					spawnNotification("Hey ! I'll tell you when there is some activity.", "", "Welcome to standalone web-chat");
				} else if (Notification.permission !== 'denied') {

					Notification.requestPermission(function(permission) {
						if (permission === "granted") {
							spawnNotification("Hey ! I'll tell you when there is some activity", "", "Welcome to standalone web-chat");
						}
					});
				}
			};
		})();

		var helperFunctions = {
			findLinks : function(text) {
				var regx = /(http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/;
				return text.replace(regx, function(capture) {
					return "<a href=" + capture + " target='_blank'> " + capture + "</a>";
				});
			},
			shakeAnimation : function(element) {
				element.addClass('shake');
				element.one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e) {
					element.removeClass('shake');
				});
			},
			updateScroll : function(connectionKeyOnClient) {

				var key = connectionKeyOnClient ? connectionKeyOnClient : "all";

				$('#messagesContainer-' + key).animate({
					scrollTop : $('#messagesContainer-' + key).prop("scrollHeight")
				}, 500);
			},
			makeNewPosition : function(offset) {
				var pageHeight = $(window).height() - offset,
				    pageWidth = $(window).width() - offset,
				    randomHeight = Math.floor(Math.random() * pageHeight),
				    randomWidth = Math.floor(Math.random() * pageWidth);
				return [randomHeight, randomWidth];
			},
			removeWindow : function(key, type) {

				if (type === global.windowTypes.CHAT) {
					if (connections[key]) {
						connections[key].opened = false;
					}
					removeEventListener(key.toString(), ["click", "keyup"]);

					$('#chatWindow-' + key.toString()).remove();
				} else if (type === global.windowTypes.ROOM) {

					if (rooms[key]) {
						rooms[key].opened = false;
					}
					//TODO remove event listeners also
					$('#roomWindow-' + key.toString()).remove();
				}

			},
			windowOnFocus : (function() {
				var event,
				    transpozitionMap = {
					hidden : "visibilitychange",
					mozHidden : "mozvisibilitychange",
					msHidden : "msvisibilitychange",
					webkitHidden : "webkitvisibilitychange"
				};

				for (var hiddenArgument in transpozitionMap) {
					if ( hiddenArgument in document) {
						event = transpozitionMap[hiddenArgument];
						break;
					}
				}

				if (!event) {
					//fallback for older browsers
				}
				return function(handler) {
					if (handler)
						addEventListener(document, event, handler);
					return !document[hiddenArgument];
				};
			})(),
			getStatusText : function(status) {
				for (var i = 0; i < statuses.length; i++) {
					if (statuses[i]["value"] == status) {
						return statuses[i].text;
						break;
					}
				}
			},
			updateStatusIcon : function(key, status) {
				if (status == 1) {// TODO CREATE TRANSPOZITIONS FOR THESE STATUS-ACTIONS
					$('#' + key.toString()).removeClass('busy');
					$('#' + key.toString()).removeClass('away');
				} else if (status == 2 || status == 3) {
					$('#' + key.toString()).removeClass('away');
					$('#' + key.toString()).addClass('busy');
				} else {
					$('#' + key.toString()).removeClass('busy');
					$('#' + key.toString()).addClass('away');
				}
				$('#' + key.toString()).removeClass('user');
				$('#' + key.toString()).addClass('user');
			}
		};

		var timeoutCheck;

		this.openSettings = function() {
			//open modal with settings, and show notification settings and other things.
			//maybe create cookie to remember settings and load settings first thing when on page.
		};

		this.addRoom = function() {
			$("#roomModal").modal();
			//open modal with room creation
			//maybe add password ??
		};

		this.joinRoom = function(id) {
			var roomId = id.split("-")[1];
			if (!joinedRooms[roomId]) {
				joinedRooms[roomId] = rooms[roomId];
				//TODO emit join event on room, after this one open a window
			} else {
				if (rooms[roomId].opened) {
					helperFunctions.shakeAnimation($("#roomWindow-" + roomId));
					$("#roomWrittenText-" + roomId).focus();
				} else {
					createNewChatWindow(roomId, rooms, global.windowTypes.ROOM);
					addEventListener('#roomWrittenText-' + roomId, 'keyup', keyUpHandlerRooms);
				}
			}
		};

		this.leaveRoom = function(id) {
			var roomId = id.split("-")[1];
			delete joinedRooms[roomId];
			//if admin reset list for all by deleting from rooms.
			//if not just leave room thu event in server, then update my joined rooms list
		};

		this.sendRoomData = function(id) {
			var roomId = id.split("-")[1];
			console.log(roomId);
			data = {
				me : socket.id,
				roomName : roomId,
				message : "Hi to the room"
			};
			socket.emit('room message', data);
		};

		this.doTypingMessage = function(id) {

			var socketId;

			for (var key in connections) {
				if (key === id.split("-")[1]) {
					socketId = connections[key].id;
					break;
				}
			}

			data = {
				me : socket.id,
				to : socketId,
				message : username + " is typing..."
			};

			socket.emit('typing', data);
		};

		socket.on('room message', function(data) {
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			if (!rooms[data.roomName].opened || rooms[data.roomName].opened == false) {
				createNewChatWindow(data.roomName, rooms, global.windowTypes.ROOM);
				addEventListener('#roomWrittenText-' + data.roomName, 'keyup', keyUpHandlerRooms);
			}

			el = $('#roomWrittenText-' + data.roomName);

			$('#messages-' + data.roomName).append($('<li>').html(connections[connectionKeyOnClient].username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));

			if (!el.is(":focus")) {
				helperFunctions.shakeAnimation($('#roomWindow-' + data.roomName));
			}

			helperFunctions.updateScroll(data.roomName);

			//check if room is opened
			//if not open it
			//if it is opened,just post the message in there

			console.log("message for room " + data.roomName + " :" + data.message + " from " + connections[connectionKeyOnClient].username);
		});

		socket.on('typing', function(data) {

			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			if (!$("#typing-" + connectionKeyOnClient).length && connections[connectionKeyOnClient].opened == true) {
				$('#messages-' + connectionKeyOnClient).append($('<li>').attr({
					"id" : "typing-" + connectionKeyOnClient
				}).html(data.message));
				helperFunctions.updateScroll(connectionKeyOnClient);
			}

			clearTimeout(timeoutCheck);

			timeoutCheck = setTimeout(function() {
				$("#typing-" + connectionKeyOnClient).remove();
			}, 5000);
		});

		function createNewChatWindow(key, connection, type) {

			console.log(connection, key);

			if (type === global.windowTypes.CHAT) {
				connections[key].opened = true;
				var classType = "chatWindow",
				    classString = "chat",
				    writtenText = "writtenText",
				    pageHeaderText = connection.username;
			} else {
				connection[key].opened = true;
				var classType = "roomWindow",
				    classString = "room",
				    writtenText = "roomWrittenText",
				    pageHeaderText = "Room " + connection[key].room;
			}

			var pos = helperFunctions.makeNewPosition(150),
			    chatWindow = $("<div class=" + classType + ">").css({
				top : pos[0],
				left : pos[1]
			}).attr("id", classType + "-" + key.toString()),
			    closeButton = $("<input class='btn-danger btn chat-window-close'  type = 'button' value='X'/>").attr({
				'id' : 'close-' + key.toString(),
				'onclick' : "removeChatWindow(this.id," + type + ")"
			});
			pageHeader = $("<div class='pageHeader' id='main-lobby-header'>").text(pageHeaderText),
			optionsContainer = $("<div class='chat-options-container'></div>"),
			buzzButton = $("<button class='btn btn-default chat-buzz'><span class='glyphicon glyphicon-bell'></span></button>").attr({
				'id' : 'buzz-' + key.toString(),
				'onclick' : "buzz(this.id)"
			}),
			messagesContainer = $("<div class='messagesContainer'>").attr('id', "messagesContainer-" + key.toString()),
			list = $("<ul class='messages'>").attr('id', "messages-" + key.toString() + ""),
			form = $("<form class='form-inline " + classString + "-form' id='formTst' action='' onsubmit='return false;'>"),
			sendButton = $("<input class='sendButton btn-success btn' type = 'button'   value='Send'>").attr({
				'id' : key.toString(),
				'onclick' : type === global.windowTypes.CHAT ? "sendData('writtenText-'+this.id)" : "sendRoomData('roomWrittenText-'+this.id)"
			}),
			textToSend = $("<input  class='form-control " + classString + "-form-text' placeholder='Write your message here...'  autocomplete='off' >").attr('id', writtenText + "-" + key.toString());

			messagesContainer.append(list);
			form.append(sendButton, textToSend);
			pageHeader.append(closeButton);

			if (type === global.windowTypes.CHAT) {
				optionsContainer.append(buzzButton);
			}

			chatWindow.append(pageHeader, messagesContainer, optionsContainer, form);

			$(document.body).append(chatWindow);

			$('.' + classType).draggable({
				containment : 'parent',
				handle : ".lobby-header"
			});

			addEventListener('#' + classType + "-" + key.toString(), 'click', function(event) {

				var maxZIndex = 0,
				    zIndex = $('#' + classType + "-" + key.toString()).css("z-index");

				max = Math.max(maxZIndex, zIndex);

				$('#' + classType + "-" + key.toString()).css("z-index", max + 1);

				$("." + classType + ":not(#" + classType + "-" + key.toString() + ")").css("z-index", max - 1);

			});
		};

		this.removeChatWindow = function(id, type) {

			helperFunctions.removeWindow(id.split("-")[1], type === global.windowTypes.CHAT ? global.windowTypes.CHAT : global.windowTypes.ROOM);
		};

		this.buzz = function(id) {

			var connectionKeyOnClient = id.split("-")[1];
			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};

			$('#messages-' + connectionKeyOnClient).append($('<li>').html("You buzzed ! (" + (new Date()).toLocaleTimeString() + ")"));

			socket.emit('buzz', data);
		};

		this.sendData = function(id) {

			var elementId = "#" + id.toString(),
			    connectionKeyOnClient = elementId.split("-")[1];

			data = {
				message : $(elementId).val(),
				me : socket.id,
				to : {
					socketId : connections[connectionKeyOnClient] ? connections[connectionKeyOnClient].id : "",
					key : connectionKeyOnClient
				}
			};

			var clonedTyping = $("#typing-" + connectionKeyOnClient).clone();

			if ( typeof data.message != undefined && data.message != null && data.message != "") {

				$("#typing-" + connectionKeyOnClient).remove();

				$('#messages-' + connectionKeyOnClient).append($('<li>').html(username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks($(elementId).val())));

				if (clonedTyping) {
					$('#messages-' + connectionKeyOnClient).append(clonedTyping);
				}

				if (connectionKeyOnClient === "all") {
					socket.emit('chat message', data);
				} else {
					socket.emit('private message', data);
				}

				$(elementId).val('');
				helperFunctions.updateScroll(connectionKeyOnClient);

			} else {

				$("#typing-" + connectionKeyOnClient).remove();

				$('#messages-' + connectionKeyOnClient).append($('<li>').text("You can't send an empty message."));

				if (clonedTyping) {
					$('#messages-' + connectionKeyOnClient).append(clonedTyping);
				}

				helperFunctions.updateScroll(connectionKeyOnClient);

			}

		};

		socket.on('chat message', function(data) {

			if (!helperFunctions.windowOnFocus()) {
				spawnNotification(data.me.username + ": " + helperFunctions.findLinks(data.message), "", "Main lobby");
			}

			$('#messages-all').append($('<li>').html(data.me.username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));
			helperFunctions.updateScroll();
		});

		socket.on('buzz', function(data) {

			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			if (!connections[connectionKeyOnClient].opened || connections[connectionKeyOnClient].opened == false) {
				createNewChatWindow(connectionKeyOnClient, connections[connectionKeyOnClient], global.windowTypes.CHAT);

				addEventListener('#writtenText-' + connectionKeyOnClient, 'keyup', keyUpHandler);

			}

			el = $('#writtenText-' + connectionKeyOnClient);

			$('#messages-' + connectionKeyOnClient).append($('<li>').html("Buzzzzzzz ring ding ! (" + (new Date()).toLocaleTimeString() + ")"));

			if (!el.is(":focus")) {
				helperFunctions.shakeAnimation($('#chatWindow-' + connectionKeyOnClient));
			}

			helperFunctions.updateScroll(connectionKeyOnClient);

			// maybe do a funny func move

			var audio = new Audio('static/doorbell.wav');
			audio.play();
		});

		socket.on('private message', function(data) {
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == data.me.id) {
					connectionKeyOnClient = key;
					break;
				}
			}

			$("#typing-" + connectionKeyOnClient).remove();

			if (!connections[connectionKeyOnClient].opened || connections[connectionKeyOnClient].opened == false) {
				createNewChatWindow(connectionKeyOnClient, connections[connectionKeyOnClient], global.windowTypes.CHAT);

				addEventListener('#writtenText-' + connectionKeyOnClient, 'keyup', keyUpHandler);

			}

			el = $('#writtenText-' + connectionKeyOnClient);

			$('#messages-' + connectionKeyOnClient).append($('<li>').html(data.me.username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));

			if (!el.is(":focus")) {
				helperFunctions.shakeAnimation($('#chatWindow-' + connectionKeyOnClient));
			}

			helperFunctions.updateScroll(connectionKeyOnClient);
		});

		function statusChangeHandler(event) {
			data = {
				me : socket.id,
				status : $(this).val()
			};
			socket.emit('status change', data);
		};

		socket.on("status change", function(data) {

			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connections[key].status = data.status;
					helperFunctions.updateStatusIcon(key, data.status);
					$('#' + "status-" + key.toString()).text(helperFunctions.getStatusText(data.status));
					break;
				}
			}
		});

		socket.on('username', function(data) {

			if (data.errorCode === 1) {// add from global
				alert("username already chosen");
				$("#myModal").modal();
				return;
			}

			username = data.username;
			$("option[value='1']").attr('selected', 'selected');
			addEventListener('#chat-status', 'change', statusChangeHandler);
		});

		var buttonsTimeout = {};

		socket.on('update rooms', function(data) {

			rooms = data;
			var roomType;
			$('#rooms').empty();

			for (var key in rooms) {

				roomType = rooms[key].private ? "private" : "public";

				var li = $('<li>').addClass("room").attr('id', key.toString()).html(rooms[key].room);

				$('#rooms').append(li);

				$("#" + key.toString()).addClass(roomType);

				//add event listeners

				addEventListener('#' + key.toString(), 'click', function(event) {

					clearTimeout(buttonsTimeout[event.target.id]);
					delete buttonsTimeout[event.target.id];
					//add the two buttons for JOIN OR LEAVE.
					//if joined on click open window + make the 2 buttons visible.

					var join = $("<input class='btn-success btn room-button'  type = 'button' value='Join'/>").attr({
						"id" : 'join-' + event.target.id,
						"onclick" : "joinRoom(this.id)"
					}),
					    leave = $("<input class='btn-warning btn room-button'  type = 'button' value='Leave'/>").attr({
						"id" : 'leave-' + event.target.id,
						"onclick" : "leaveRoom(this.id)"
					});

					//joinedRooms[event.target.id] = true;
					//TODO remove just for testing

					console.log(event.target.id, " in room ", joinedRooms[event.target.id]);
					if (joinedRooms[event.target.id]) {

						$("#leave-" + event.target.id).length > 0 ? "" : leave.appendTo($("#" + event.target.id)).animate({
    opacity:  '0.4'  // for instance
}, 2000);

					} else {

						$("#leave-" + event.target.id).length > 0 && $("#join-" + event.target.id).length > 0 ? "" : $("#" + event.target.id).append(join, leave);

					}

					buttonsTimeout[event.target.id] = setTimeout(function() {
						$("#leave-" + event.target.id).remove();
						$("#join-" + event.target.id).remove();
					}, 3000);

					event.stopPropagation();
				}, false);

				addEventListener('#' + key.toString(), 'dblclick', function(event) {

					if (joinedRooms[event.target.id]) {

						!rooms[(event.target.id).toString()].opened ? createNewChatWindow(event.target.id, rooms, global.windowTypes.ROOM) : (function() {
							var element = $("#roomWrittenText-" + (event.target.id).toString());
							helperFunctions.shakeAnimation(element);
							element.focus();

						})();
						addEventListener('#roomWrittenText-' + event.target.id, 'keyup', keyUpHandlerRooms);

					} else {
						$("#" + event.target.id).click();
					}

					event.stopPropagation();
				}, false);

			}

		});

		socket.on('update users', function(data) {

			var connectionKeyOnClient;
			for (var key in connections) {//change to helper function
				if (connections[key].id == "/#" + data.disconnected && connections[key].opened == true) {
					connectionKeyOnClient = key;
					break;
				}
			}

			if (connectionKeyOnClient) {
				$('#messages-' + connectionKeyOnClient).append($('<li>').html("User disconnected from chat."));
				$('#writtenText-' + connectionKeyOnClient).attr({
					"disabled" : true
				});
				if (!helperFunctions.windowOnFocus()) {
					spawnNotification(connections[key].username + " disconnected", "", "User disconnected");
				}
			}

			$('#users').empty();
			connections = data.updatedList;
			var size = 0,
			    client;

			for (var key in data.updatedList) {
				size++;
				client = data.updatedList[key.toString()];

				var li = $('<li>').addClass('user').attr('id', key.toString()).html(client.username + " " + client.location.city),
				    flag = $('<span>').addClass('country-flag flag-icon flag-icon-' + (client.location.country).toLowerCase()),
				    status = $('<span>').attr({
					"id" : "status-" + key.toString()
				}).append(" " + helperFunctions.getStatusText(client.status));

				if (client.location.country) {
					li.append(flag);
				}
				li.append(status);

				$('#users').append(li);

				helperFunctions.updateStatusIcon(key, client.status);

				if (client.id != '/#' + socket.id) {

					addEventListener('#' + key.toString(), 'click', function(event) {
						!connections[(event.target.id).toString()].opened ? createNewChatWindow(event.target.id, connections[(event.target.id).toString()], global.windowTypes.CHAT) : (function() {
							var element = $("#writtenText-" + (event.target.id).toString());
							helperFunctions.shakeAnimation(element);
							element.focus();
						})();

						addEventListener('#writtenText-' + event.target.id, 'keyup', keyUpHandler);

						event.stopPropagation();
					}, false);

				}
			}
			$('#chat-users-no').text(size);
		});

	})();

	(function() {
		var handlers = [];
		this.addEventListener = function(element, type, fn) {
			$(element).on(type, fn);
			handlers[element] = new Array(5);
			handlers[element][type] = fn;
		};

		this.removeEventListener = function(element, type) {
			//TODO check here if ok ! ! !
			for (var i = 0; i < type.length; i++) {
				if (handlers[element]) {
					$(element).off(type[i], handlers[element][type]);
					delete handlers[element][type];
				}
			}
		};
	})();

	addEventListener('#writtenText-all', 'keyup', keyUpHandler);

	function keyUpHandler(event) {
		var keycode = (event.keyCode ? event.keyCode : event.which);
		if (keycode == '13') {
			sendData(event.target.id);
		} else {
			doTypingMessage(event.target.id);
		}
		event.preventDefault();
		event.stopPropagation();
		return false;
	}

	function keyUpHandlerRooms(event) {//just for testing purposes
		var keycode = (event.keyCode ? event.keyCode : event.which);
		if (keycode == '13') {
			sendRoomData(event.target.id);
		} else {

		}
		event.preventDefault();
		event.stopPropagation();
		return false;
	}

});
