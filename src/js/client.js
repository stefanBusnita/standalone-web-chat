$(document).ready(function() {

	(function() {
		var socket = io(),
		//ss = require('socket.io-stream'),
		    data = {},
		    username,
		    connections = [],
		    notifications = [],
		    notificationProperties = {
			timeout : 2000
		};

		$("#myModal").modal();
		$('.chatWindow').draggable({
			containment : 'parent',
			handle : ".lobby-header"
		});
		$('.chatWindow').resizable();

		$('#myModal').on('hidden.bs.modal', function() {
			checkNotificationPermission();
			socket.emit('username', $('#username').val());
		});

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
			updateScroll : function() {
				$('.messagesContainer').animate({
					scrollTop : $('.messagesContainer').prop("scrollHeight")
				}, 500);
			},
			makeNewPosition : function(offset) {
				var pageHeight = $(window).height() - offset,
				    pageWidth = $(window).width() - offset,
				    randomHeight = Math.floor(Math.random() * pageHeight),
				    randomWidth = Math.floor(Math.random() * pageWidth);
				return [randomHeight, randomWidth];
			},
			removeWindow : function(key) {

				if (connections[key]) {
					connections[key].opened = false;
				}
				removeEventListener(key.toString(), ["click", "keyup"]);

				$('#chatWindow-' + key.toString()).remove();
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
			})()
		};

		var typing = false;

		this.doTypingMessage = function(id) {

			var socketId,
			    timeout;
			for (var key in connections) {
				console.log(key, id);
				if (key === id.split("-")[1]) {
					socketId = connections[key].id;
					break;
				}
			}

			data = {
				me : socket.id,
				to : socketId,
				message : username + " is typeing..."
			};

			console.log(data);
			/*
			 socket.emit('typeing', data);	*/

		};

		function createNewChatWindow(key, connection) {

			connections[key].opened = true;

			var pos = helperFunctions.makeNewPosition(150),
			    chatWindow = $("<div class='chatWindow'>").css({
				top : pos[0],
				left : pos[1]
			}).attr("id", "chatWindow-" + key.toString()),
			    closeButton = $("<input class='btn-danger btn chat-window-close'  type = 'button' value='X'/>").attr({
				'id' : 'close-' + key.toString(),
				'onclick' : "removeChatWindow(this.id)"
			});
			pageHeader = $("<div class='pageHeader' id='main-lobby-header'>").text(connection.username),
			optionsContainer = $("<div class='chat-options-container'></div>"),
			buzzButton = $("<button class='btn btn-default chat-buzz'><span class='glyphicon glyphicon-bell'></span></button>").attr({
				'id' : 'buzz-' + key.toString(),
				'onclick' : "buzz(this.id)"
			}),
			messagesContainer = $("<div class='messagesContainer'>"),
			list = $("<ul class='messages'>").attr('id', "messages-" + key.toString() + ""),
			form = $("<form class='form-inline chat-form' id='formTst' action='' onsubmit='return false;'>"),
			sendButton = $("<input class='sendButton btn-success btn' type = 'button'   value='Send'>").attr({
				'id' : key.toString(),
				'onclick' : "sendData('writtenText-'+this.id)"
			}),
			textToSend = $("<input  class='form-control chat-form-text' placeholder='Write your message here...'  autocomplete='off' >").attr('id', "writtenText-" + key.toString());

			messagesContainer.append(list);
			form.append(sendButton, textToSend);
			pageHeader.append(closeButton);
			optionsContainer.append(buzzButton);
			chatWindow.append(pageHeader, messagesContainer, optionsContainer, form);

			$(document.body).append(chatWindow);

			$('.chatWindow').draggable({
				containment : 'parent',
				handle : ".lobby-header"
			});

			addEventListener('#chatWindow-' + key.toString(), 'click', function(event) {

				var maxZIndex = 0;
				var zIndex = $('#chatWindow-' + key.toString()).css("z-index");

				max = Math.max(maxZIndex, zIndex);

				$('#chatWindow-' + key.toString()).css("z-index", max + 1);

				$(".chatWindow:not(" + '#chatWindow-' + key.toString() + ")").css("z-index", max - 1);
				;

			});
		};

		this.removeChatWindow = function(id) {
			helperFunctions.removeWindow(id.split("-")[1]);
		};

		this.buzz = function(id) {

			var connectionKeyOnClient = id.split("-")[1];
			console.log(connectionKeyOnClient,id);
			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};
			//append to my interface the fact that he was buzzed
			socket.emit('buzz', data);
		};

		this.sendData = function(id) {

			var elementId = "#" + id.toString(),
			    connectionKeyOnClient = elementId.split("-")[1];

			//console.log(elementId, $(elementId).val(), connectionKeyOnClient, connections[connectionKeyOnClient] ? connections[connectionKeyOnClient].id : "");
			data = {
				message : $(elementId).val(),
				me : socket.id,
				to : {
					socketId : connections[connectionKeyOnClient] ? connections[connectionKeyOnClient].id : "",
					key : connectionKeyOnClient
				}
			};

			if ( typeof data.message != undefined && data.message != null && data.message != "") {

				$('#messages-' + connectionKeyOnClient).append($('<li>').html(username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks($(elementId).val())));

				if (connectionKeyOnClient === "all") {
					socket.emit('chat message', data);
				} else {
					socket.emit('private message', data);
				}

				$(elementId).val('');
				helperFunctions.updateScroll();

			} else {
				$('#messages-' + connectionKeyOnClient).append($('<li>').text("You can't send an empty message."));
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

			/*
			var connectionKeyOnClient;
						for (var key in connections) {
							if (connections[key].id == data.me) {
								connectionKeyOnClient = key;
								break;
							}
						}*/
			
			// append to interface, check if it is open ( if not open it )   CHECK PRIVATE MESSAGE IMPL, maybe do a funny func move
			
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

			//consider on click add 1 to z-index ( or more ), this way it can always be on top ( desktop like )

			if (!connections[connectionKeyOnClient].opened || connections[connectionKeyOnClient].opened == false) {
				createNewChatWindow(connectionKeyOnClient, connections[connectionKeyOnClient]);

				addEventListener('#writtenText-' + connectionKeyOnClient, 'keyup', keyUpHandler);

			}

			el = $('#chatWindow-' + connectionKeyOnClient);

			$('#messages-' + connectionKeyOnClient).append($('<li>').html(data.me.username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));

			if (!el.is(":focus")) {
				helperFunctions.shakeAnimation(el);
			}

			helperFunctions.updateScroll();
		});

		socket.on('username', function(data) {

			if (data.errorCode === 1) {// add from global
				alert("username already chosen");
				$("#myModal").modal();
				return;
			}

			username = data.username;
		});

		socket.on('update', function(data) {

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
			for (var key in data.updatedList) {
				$('#users').append($('<li>').addClass('user').attr('id', key.toString()).text(data.updatedList[key.toString()].username));

				addEventListener('#' + key.toString(), 'click', function(event) {

					!connections[(event.target.id).toString()].opened ? createNewChatWindow(event.target.id, connections[(event.target.id).toString()]) : (function() {
						var element = $("#writtenText-" + (event.target.id).toString());
						helperFunctions.shakeAnimation(element);
						element.focus();
					})();

					addEventListener('#writtenText-' + event.target.id, 'keyup', keyUpHandler);

					event.stopPropagation();
				});
			}
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

});
