$(document).ready(function() {

	//Workaround on finding the headers on a loaded page in the js of that page
	var req = new XMLHttpRequest();
	req.open('GET', document.location, false);
	req.send(null);
	var headers = req.getAllResponseHeaders().toLowerCase();
	// end workaround

	//TODO
	/**
	 * Create DB connection data in separate JS ( different DBS maybe, start with postres)
	 * Create coonection props file and export
	 * Config part for project, dev vs production, load config and other stuff, use browserify
	 */

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

	/**
	 * Create cookies ( set name-value pair, and days untill expiration)
	 * Read cookies (go thru all cookies and, elim all white space, check if name is equal to search and return substring)
	 * Delete cookies ( find same cookie by name and set expiration date to -1)
	 */
	(function() {//maybe move to another script

		this.createCookie = function(name, value, days) {
			if (days) {
				var date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				var expires = "; expires=" + date.toGMTString();
			} else {
				var expires = "";
			}
			var nameValuePair = name + "=" + value,
			    path = "/",
			    pathPrefix = "; path=" + path;

			document.cookie = nameValuePair + expires + pathPrefix;
		};

		this.readCookie = function(name) {
			var searchedCookie = name + "=",
			    cookies = document.cookie.split(';'),
			    cookie;
			for (var i = 0; i < cookies.length; i++) {
				cookie = cookies[i];
				while (cookie.charAt(0) == ' ')
				cookie = cookie.substring(1, cookie.length);
				if (cookie.indexOf(searchedCookie) == 0)
					return cookie.substring(searchedCookie.length, cookie.length);
			}
			return null;
		};

		this.eraseCookie = function(name) {
			if (getCookie(name)) {// if it exists
				createCookie(name, "", -1);
			}
		};

		function getCookie(name) {
			var regexp = new RegExp("(?:^" + name + "|;\s*" + name + ")=(.*?)(?:;|$)", "g");
			var result = regexp.exec(document.cookie);
			return (result === null) ? null : result[1];
		}

	})();

	(function() {

		/**
		 * ---------------------------------------------------------------------------------------------------------------------------------
		 * Initialization for app variables and more
		 */
		var socket = io(),
		    data = {},
		    username,
		    connections = [],
		    rooms = {},
		    joinedRooms = {},
		    notifications = [],
		    notificationProperties = {
		},
		    global = {
			windowTypes : {
				CHAT : 1,
				ROOM : 2
			}
		},
		    fs = require('fs'),
		    statuses = $("#chat-status>option").map(function() {
			var val = $(this).val().toString();
			return {
				text : $(this).text(),
				value : $(this).val()
			};
		}),
		    webrtc = new SimpleWebRTC({
			localVideoEl : 'localVideo',
			remoteVideosEl : '',
			autoRequestMedia : true
		}),
		    currentVideoContainer = '#chatWindow-';

		function loadSettings() {
			notificationProperties = JSON.parse(readCookie("chat-options"));
			notificationProperties == null ? notificationProperties = {
				timeout : 2, //default timeout
				room : true,
				private : true,
				lobby : true,
				buzz : true
			} : "";
		};

		loadSettings();

		/**
		 * ---------------------------------------------------------------------------------------------------------------------------------
		 * End init
		 */

		$("#myModal").modal();
		$('.chatWindow').draggable({
			containment : 'parent',
			handle : ".lobby-header"
		});
		//$('.chatWindow').resizable({ alsoResize: '#messagesContainer-all,.chat-form' });

		/**
		 * Closing username modal
		 * Check notification permission and get user location
		 */
		$('#myModal').on('hidden.bs.modal', function() {
			checkNotificationPermission();
			$.get("http://ipinfo.io", doLocationCallback, "jsonp").fail(doLocationCallback);
		});

		/**
		 * Room creation modal
		 * On close trigger event for room creation
		 */
		this.closeRoomModal = function() {

			if ($('#roomName').val()) {
				var users = [];
				users.push(socket.id);
				data = {
					room : $('#roomName').val(),
					password : new Buffer($('#roomPassword').val()).toString('base64'),
					private : $('#roomPassword').val() ? true : false,
					users : users
				};

				if (rooms[$('#roomName').val()]) {
					alert("Room name already taken");
					return;
				}

				socket.emit('room created', data);
				$('#roomName').val('');
				$('#roomPassword').val('');
				data.admin = true;
				joinedRooms[data.room] = data;
				$('#roomModal').modal('toggle');
			} else {
				$('#roomName-container').addClass('has-error');
			}

		};

		$('#roomModal').on('hidden.bs.modal', function() {
			$('#roomName-container').removeClass('has-error');
			$('#roomName').val('');
			$('#roomPassword').val('');
		});

		/**
		 * Used for user location on callback after we know the city, country ( maybe more ) from the request ip
		 */
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
		/**
		 * Used for desktop notifications
		 * Check if notification permission is activated
		 * Spawn a notification showing that notifications are enabled in the application
		 * Alert user if the browser does not support desktop notifications
		 */
		(function() {

			var enableButton = $("<button type='button' class='btn btn-success' onclick='checkNotificationPermission()'>Enable</button>").attr({
				'id' : 'notification-enable'
			});

			this.spawnNotification = function(theBody, theIcon, theTitle) {
				var options = {
					body : theBody,
					icon : theIcon
				};
				var notification = new Notification(theTitle, options);
				setTimeout(function() {
					notification.close();
				}, notificationProperties.timeout * 1000);
			};

			this.checkNotificationPermission = function() {
				$('#notification-status').html("<b>Disabled</b>");
				$('#notification-status').append(enableButton);

				if (!("Notification" in window)) {
					alert("This browser does not support desktop notification. Please use Mozilla or Chrome.");
					$('#notification-status').html("<b>Disabled.Please use Mozilla or Chrome.</b>");
					return;
				} else if (Notification.permission === "granted") {
					$('#notification-status').html("<b>Active</b>");
					$('#notification-enable').remove();
					spawnNotification("Hey ! I'll tell you when there is some activity.", "", "Welcome to standalone web-chat");
				} else if (Notification.permission !== 'denied') {

					Notification.requestPermission(function(permission) {
						if (permission === "granted") {
							spawnNotification("Hey ! I'll tell you when there is some activity", "", "Welcome to standalone web-chat");
							$('#notification-status').html("<b>Active</b>");
							$('#notification-enable').remove();
						}
					});
				}

			};
		})();

		/**
		 * Different helper functions used in the app
		 */
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

					if ($('#chatWindow-' + key.toString() + " .videoContainer").length) {
						webrtc.leaveRoom();
					};

					$('#chatWindow-' + key.toString()).remove();
					currentVideoContainer = '#chatWindow-';

					helperFunctions.addCallButtonForOpenedWindows();

				} else if (type === global.windowTypes.ROOM) {

					if (rooms[key]) {
						rooms[key].opened = false;
					}
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
			},
			hideButtons : function(roomId) {
				clearTimeout(buttonsTimeout[roomId]);
				$("#leave-" + roomId).remove();
				$("#join-" + roomId).remove();
			},
			updateRoomUsersList : function(room) {
				if ( typeof room != 'object') {//update for one room only

					if (rooms[room]) {
						var roomUsersList = $('#users-' + room);
						roomUsersList.empty();

						for (var i = 0; i < rooms[room].users.length; i++) {

							for (var k in connections) {
								if (connections[k].id == '/#' + rooms[room].users[i]) {
									var li = $("<li id='roomUser" + room + "-" + connections[k].username + "'>").html(connections[k].username);
									break;
								}
							}
							roomUsersList.append(li);
						}

					}
				} else {
					for (var k in joinedRooms) {

						if (rooms[joinedRooms[k].room].users.length == 0) {
							console.log("no more users in the room, we can close the room");
							//send disable event for input text area
						}

						if (rooms[joinedRooms[k].room].opened) {

							var roomUsersList = $('#users-' + joinedRooms[k].room);

							$('#messages-' + joinedRooms[k].room).append((new Date()).toLocaleTimeString() + " User " + room.disconnected + " left the chat room :(");

							$('#users-' + joinedRooms[k].room).empty();
							for (var j = 0; j < joinedRooms[k].users.length; j++) {
								for (var l in connections) {
									if (connections[l].id == '/#' + joinedRooms[k].users[j]) {
										var li = $("<li>").html(connections[l].username);
										roomUsersList.append(li);
									}
								}
							}

						}

					}

				}
			},
			checkVideoAndAudioPermission : function(successCallback, errorCallback) {
				webrtc.startLocalVideo();
				navigator.getUserMedia({
					video : true,
					audio : true
				}, errorCallback);
			},
			addCallButtonForOpenedWindows : function() {
				for (var clientKey in connections) {
					if (connections[clientKey].opened) {
						var options = $('#chat-options-' + clientKey.toString());
						if (!$('#video-' + clientKey.toString()).length) {
							var callButton = $("<button class='btn btn-default chat-window-option-button'><span class='glyphicon glyphicon-facetime-video'></span></button>").attr({
								'id' : 'video-' + clientKey,
								'onclick' : "callPerson(this.id)"
							});
							options.append(callButton);
						}

					}
				}
			},
			removeCallButtonForOpenedWindow : function(key) {// all except this one
				for (var clientKey in connections) {
					if (clientKey !== key && connections[clientKey].opened) {
						$('#video-' + clientKey).remove();
					}
				}
			},
			openWindowForInfoIfClosed : function(connectionKeyOnClient) {
				if (!connections[connectionKeyOnClient].opened || connections[connectionKeyOnClient].opened == false) {
					createNewChatWindow(connectionKeyOnClient, connections[connectionKeyOnClient], global.windowTypes.CHAT);

					addEventListener('#writtenText-' + connectionKeyOnClient, 'keyup', keyUpHandler);

				}

				el = $('#writtenText-' + connectionKeyOnClient);

				if (!el.is(":focus")) {
					helperFunctions.shakeAnimation($('#chatWindow-' + connectionKeyOnClient));
				}
			}
		};
		/**
		 * Used for mute/unmute events, getting previously set color for a button
		 */
		jQuery.fn.getParentBackgroundColor = function() {
			return $(this).parent().css('background-color');
		};

		var timeoutCheck = {},
		    roomTimeoutCheck = {};

		/**
		 * open settings modal and add to interface currently selected options
		 */
		this.openSettings = function() {
			$('#modalSettings').modal();
			if (notificationProperties) {
				$('#notification-option-time').val(notificationProperties.timeout);
				$('#notification-option-rooms').prop('checked', notificationProperties.room);
				$('#notification-option-private').prop('checked', notificationProperties.private);
				$('#notification-option-lobby').prop('checked', notificationProperties.lobby);
				$('#notification-option-buzz').prop('checked', notificationProperties.buzz);
			}
		};

		/**
		 * save settings on modal close
		 * create a cookie with a few properties
		 */
		this.saveSettings = function() {
			notificationProperties = {
				timeout : $('#notification-option-time').val(),
				room : $('#notification-option-rooms').prop('checked'),
				private : $('#notification-option-private').prop('checked'),
				lobby : $('#notification-option-lobby').prop('checked'),
				buzz : $('#notification-option-buzz').prop('checked')
			};
			createCookie("chat-options", JSON.stringify(notificationProperties), 7);
			loadSettings();
			$('#notification-option-time').val(null);
			$('#notification-option-rooms').prop('checked', false);
			$('#notification-option-private').prop('checked', false);
			$('#notification-option-lobby').prop('checked', false);
			$('#notification-option-buzz').prop('checked', false);
			$('#modalSettings').modal('toggle');
		};

		/**
		 * Trigger room creation modal
		 */
		this.addRoom = function() {
			$("#roomModal").modal();
		};

		/**
		 * Trigger for joining a room event
		 * If the room is already opened just animate the window
		 * Check for password and prompt for pass
		 * Add event listeners if needed
		 */
		this.joinRoom = function(id) {
			var roomId = id.split("-")[1];
			helperFunctions.hideButtons(roomId);
			console.log(!joinedRooms[roomId], joinedRooms[roomId]);
			if (!joinedRooms[roomId]) {

				joinedRooms[roomId] = rooms[roomId];

				if (rooms[roomId].private) {

					$("#passModal").modal();
					$('#password').data("roomName", roomId);
					return;
				} else {
					data = {
						name : roomId
					};
					socket.emit('join room', data);
				}

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

		this.closePasswordModal = function() {

			if ($('#password').val()) {
				data = {
					name : $('#password').data("roomName"),
					password : new Buffer($('#password').val()).toString('base64')
				};
				socket.emit('join room', data);
				$('#password').val('');
				$('#passModal').modal('toggle');
				$('#password').removeData();
			} else {
				$('#password-container').addClass('has-error');
			}
		};

		$('#passModal').on('hidden.bs.modal', function() {
			$('#password-container').removeClass('has-error');
			$('#password').val('');
			$('#password').removeData();
		});

		$(".glyphicon-eye-open").mousedown(function() {
			$("#password").attr('type', 'text');
			$("#roomPassword").attr('type', 'text');
		}).mouseup(function() {
			$("#password").attr('type', 'password');
			$("#roomPassword").attr('type', 'password');
		}).mouseout(function() {
			$("#password").attr('type', 'password');
			$("#roomPassword").attr('type', 'password');
		});

		/**
		 * Trigger for leave room event
		 */
		this.leaveRoom = function(id) {
			console.log(id)
			var roomId = id.split("-")[1];
			helperFunctions.hideButtons(roomId);
			delete joinedRooms[roomId];
			socket.emit('leave room', roomId);
			removeChatWindow(id, global.windowTypes.ROOM);
			//if admin reset list for all by deleting from rooms.
			//if not just leave room thu event in server, then update my joined rooms list
		};

		/**
		 * Trigger for room message event
		 */
		this.sendRoomData = function(id) {
			var roomId = id.split("-")[1];
			data = {
				me : socket.id,
				roomName : roomId,
				message : $("#" + id).val()
			};
			//for me just append maybe ??
			socket.emit('room message', data);
			$("#" + id).val('');
		};

		/**
		 * Triggered on typing
		 * Used to trigger event to the other user
		 */
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

		/**
		 * Emit event for typing message in room
		 */
		this.doTypingMessageRooms = function(id) {
			data = {
				roomName : id.split('-')[1]
			};
			socket.emit('typingRoom', data);
		};

		socket.on('wrong', function(data) {
			delete joinedRooms[data.roomName];
			alert(data.message);
		});

		socket.on('call', function(data) {
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);

			//maybe say that the user is trying to call, you should call this user back after ending current call
			//and maybe just hit return after posting the message
			if ($('.videoContainer').length || $('.calling-item').length || $('.answear-reject').length) {
				$('#messages-' + connectionKeyOnClient).append($("<li>").html("Hi ! wanna talk ? (" + (new Date()).toLocaleTimeString() + ") <b>" + connections[connectionKeyOnClient].username + " is trying to call you. If you want to answear, please end current call or stop/reject other calls already in progress.</b>"));
				//launch event and say that user in currentyl busy in another call
				data = {
					id : connections[connectionKeyOnClient].id,
					me : socket.id
				};
				socket.emit('userInAnotherCall', data);
				return;
			}

			if (!$("#answear-reject-" + connectionKeyOnClient).length) {
				$('#messages-' + connectionKeyOnClient).append($("<li class='answear-reject' id='answear-reject-" + connectionKeyOnClient + "'>").html("Hi ! wanna talk ? (" + (new Date()).toLocaleTimeString() + ")" + "<button class='btn btn-success' onclick='acceptCall(this.id)' id='answear-" + connectionKeyOnClient + "'>Answear</button>" + "<button class='btn btn-danger' onclick='rejectCall(this.id)' id='reject-" + connectionKeyOnClient + "'>Reject</button>"));
			} else {
				//this guy is really insisting on calling you
			}

			helperFunctions.removeCallButtonForOpenedWindow(connectionKeyOnClient);
			helperFunctions.updateScroll(connectionKeyOnClient);
		});

		/**
		 * User is currently in another call
		 * Print message ( open window if it was closed in the meantime )
		 */
		socket.on('userInAnotherCall', function(data) {
			//remove calling-keyonclient and print message accordingly
			currentVideoContainer = '#chatWindow-';
			console.log("on user in another call ", currentVideoContainer);
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}
			if ($("#calling-" + connectionKeyOnClient).length) {
				$("#calling-" + connectionKeyOnClient).remove();
				$('#messages-' + connectionKeyOnClient).append($("<li>").html("(" + (new Date()).toLocaleTimeString() + ") <b>" + connections[connectionKeyOnClient].username + " is currently engaged in another call. The user was notified of your intention to chat.</b>"));
			} else {
				helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);
				$('#messages-' + connectionKeyOnClient).append($("<li>").html("(" + (new Date()).toLocaleTimeString() + ") <b>" + connections[connectionKeyOnClient].username + " is currently engaged in another call. The user was notified of your intention to chat.</b>"));
			}
			helperFunctions.addCallButtonForOpenedWindows();
			helperFunctions.updateScroll(connectionKeyOnClient);
		});

		/**
		 * On video added event
		 * Append video container to corresponding window
		 * Listen for iceConnectionStateChange and inform peer on connection status
		 */
		webrtc.on('videoAdded', function(video, peer) {
			var remotes;
			remotes = $(currentVideoContainer);
			console.log("on video added ", currentVideoContainer);
			if (remotes) {
				var container = $('<div>').addClass('videoContainer').attr({
					'id' : 'container-' + webrtc.getDomId(peer)
				});
				container.append(video);

				video.oncontextmenu = function() {
					return false;
				};

				remotes.append(container);

				if (peer && peer.pc) {
					peer.pc.on('iceConnectionStateChange', function(event) {
						var keyOnClient = currentVideoContainer.split('-')[1];
						switch (peer.pc.iceConnectionState) {
						case 'checking':
							$('#messages-' + keyOnClient).append($('<li>').html("Connecting to peer..."));
							break;
						case 'connected':
						case 'completed':
							$('#messages-' + keyOnClient).append($('<li>').html("Connection established."));
							break;
						case 'disconnected':
							$('#messages-' + keyOnClient).append($('<li>').html("Disconnected."));
							break;
						case 'failed':
							$('#messages-' + keyOnClient).append($('<li>').html("Connection has failed."));
							//on failed do something close window
							break;
						case 'closed':
							$('#messages-' + keyOnClient).append($('<li>').html("Connection closed."));
							break;
						}
					});
				}
			}

		});

		/**
		 * On video removed event
		 * 1.Remove video container
		 * 2.Inform peer that window was closed and comm is of
		 * 3.Resize window and add call option for opened windows again
		 */
		webrtc.on('videoRemoved', function(video, peer) {
			console.log("on video removed ", currentVideoContainer);
			var keyOnClient = currentVideoContainer.split('-')[1];
			webrtc.leaveRoom();
			$('#container-' + webrtc.getDomId(peer)).remove();
			$('#messages-' + keyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "Video was closed by peer. Streaming is off."));
			$('#chatWindow-' + keyOnClient).css({
				'width' : 400
			});
			$('#video-' + keyOnClient).css({
				'background-color' : 'white'
			});

			currentVideoContainer = '#chatWindow-';
			helperFunctions.addCallButtonForOpenedWindows();
			helperFunctions.updateScroll(keyOnClient);
		});

		/**
		 * Stop/Start local sound
		 */
		this.manageLocalSound = function() {
			jQuery.inArray($('#local-sound-icon').getParentBackgroundColor('rgb(255,0,0)'), ['rgb(255, 255, 255)', 'rgb(230, 230, 230)']) >= 0 ? webrtc.mute() : webrtc.unmute();
		};

		/**
		 * Stop/Start local video streaming only
		 */
		this.manageLocalVideo = function() {
			jQuery.inArray($('#local-video-icon').getParentBackgroundColor('rgb(255,0,0)'), ['rgb(255, 255, 255)', 'rgb(230, 230, 230)']) >= 0 ? webrtc.pauseVideo() : webrtc.resumeVideo();
		};

		/**
		 * Stop/Start local audio and video streaming
		 */
		this.manageAll = function() {
			$('#local-all-sound-video-icon').hasClass('glyphicon-pause') ? (function() {
				webrtc.pause();
				$('#local-all-sound-video-icon').removeClass('glyphicon-pause');
				$('#local-all-sound-video-icon').addClass('glyphicon-play');
				$('#local-all-sound-video-button').attr({
					'title' : 'Start sending audio and video to peers'
				});
			})() : (function() {
				webrtc.resume();
				$('#local-all-sound-video-icon').removeClass('glyphicon-play');
				$('#local-all-sound-video-icon').addClass('glyphicon-pause');
				$('#local-all-sound-video-button').attr({
					'title' : 'Stop sending audio and video to peers'
				});
			})();
		};

		//local mute/unmute events
		webrtc.on('audioOn', function() {
			$('#local-sound-button').css({
				'background-color' : 'rgb(255, 255, 255)'
			});
			$('#local-sound-button').attr({
				'title' : 'Stop sending audio to peers'
			});
			$('#local-sound-icon').removeClass('glyphicon-volume-up');
			$('#local-sound-icon').addClass('glyphicon-volume-off');
		});
		webrtc.on('audioOff', function() {
			$('#local-sound-button').css({
				'background-color' : 'rgb(255,0,0)'
			});
			$('#local-sound-icon').removeClass('glyphicon-volume-off');
			$('#local-sound-icon').addClass('glyphicon-volume-up');
			$('#local-sound-button').attr({
				'title' : 'Start sending audio to peers'
			});
		});
		webrtc.on('videoOn', function() {
			$('#local-video-button').css({
				'background-color' : 'rgb(255, 255, 255)'
			});
			$('#local-sound-button').attr({
				'title' : 'Stop sending video to peers'
			});
		});
		webrtc.on('videoOff', function() {
			$('#local-video-button').css({
				'background-color' : 'rgb(255,0,0)'
			});
			$('#local-video-button').attr({
				'title' : 'Start sending video to peers'
			});
		});

		/**
		 * Mute event, user is notified with a message.
		 */
		webrtc.on('mute', function(data) {

			webrtc.getPeers(data.id).forEach(function(peer) {
				if (data.name == 'audio') {
					$('#videocontainer_' + webrtc.getDomId(peer) + ' .muted').show();
				} else if (data.name == 'video') {
					$('#videocontainer_' + webrtc.getDomId(peer) + ' .paused').show();
					$('#videocontainer_' + webrtc.getDomId(peer) + ' video').hide();
				}
			});

		});
		/**
		 * Unmute event, user is notified with a mesage
		 */
		webrtc.on('unmute', function(data) {

			webrtc.getPeers(data.id).forEach(function(peer) {
				if (data.name == 'audio') {
					$('#videocontainer_' + webrtc.getDomId(peer) + ' .muted').hide();
				} else if (data.name == 'video') {
					$('#videocontainer_' + webrtc.getDomId(peer) + ' video').show();
					$('#videocontainer_' + webrtc.getDomId(peer) + ' .paused').hide();
				}
			});

		});

		/**
		 * Accept call from other person
		 * join room with name composed out of socketids of the two clients
		 * remove call button from rest of the opened window users.
		 */
		this.acceptCall = function(data) {
			//button dissapears and we go on ready to call and join room

			var connectionKeyOnClient = data.split("-")[1];
			currentVideoContainer += connectionKeyOnClient;

			$('#answear-reject-' + connectionKeyOnClient).remove();

			$(currentVideoContainer).css({
				'width' : 800
			});

			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};

			socket.emit('callAccepted', data);
			$('#video-' + connectionKeyOnClient).attr({
				'onclick' : 'removeChatCall(this.id)'
			}).css({
				'background-color' : 'red'
			});

			webrtc.joinRoom('/#' + socket.id + connections[connectionKeyOnClient].id);
			helperFunctions.removeCallButtonForOpenedWindow(connectionKeyOnClient);
			helperFunctions.updateScroll(connectionKeyOnClient);
			//remove all except this one
		};

		/**
		 * Stop calling the current person
		 * Remove Stop call option from screen
		 */
		this.stopCalling = function(data) {
			var connectionKeyOnClient = data.split("-")[1];
			currentVideoContainer = '#chatWindow-';
			console.log("on stop calling ", currentVideoContainer);
			if ($('.calling-item').length) {
				$('.calling-item').remove();
				//remove option to stop calling person.
				$('#messages-' + connectionKeyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "You stopped calling."));
				helperFunctions.updateScroll(connectionKeyOnClient);
				helperFunctions.addCallButtonForOpenedWindows();
			}

			data = {
				to : connections[connectionKeyOnClient].id,
				me : socket.id
			};

			socket.emit('callStopped', data);

		};

		/**
		 * Call stopped event
		 * Remove possibiliy and answear or reject call because call was stopped.
		 * If window was previously closed, just reopen and show that call was stopped
		 */
		socket.on('callStopped', function(data) {
			console.log("on call stopped ", currentVideoContainer);
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}
			console.log('#answear-reject-' + connectionKeyOnClient);
			if ($('#answear-reject-' + connectionKeyOnClient).length) {
				$('#answear-reject-' + connectionKeyOnClient).remove();
				$('#messages-' + connectionKeyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "Peer has stopped calling."));
			} else {
				helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);
				$('#messages-' + connectionKeyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "Peer has stopped calling."));
			}
			helperFunctions.updateScroll(connectionKeyOnClient);
			helperFunctions.addCallButtonForOpenedWindows();
		});

		/**
		 * Reject call from a user
		 * 1.Remove options to answear or reject call
		 * 2.Print a message and show that the call rejection was done
		 * 3.Emit event for callRejection
		 */
		this.rejectCall = function(data) {
			console.log("on reject call ", currentVideoContainer);
			var connectionKeyOnClient = data.split("-")[1];
			$('#answear-reject-' + connectionKeyOnClient).remove();
			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};
			$('#messages-' + connectionKeyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "You rejected the call..."));
			socket.emit('callRejected', data);
			helperFunctions.updateScroll(connectionKeyOnClient);
			helperFunctions.addCallButtonForOpenedWindows();
			helperFunctions.updateScroll(connectionKeyOnClient);
		};

		/**
		 * Remove chat call on user request when pressing the call button again
		 * 1.Leave room ( let the webrtc listeners handle the rest )
		 * 2.Add callPerson on the button instead of removeChatCall, so another call can take place now
		 * 3.update scroll
		 */
		this.removeChatCall = function(data) {
			var connectionKeyOnClient = data.split("-")[1];
			$('#video-' + connectionKeyOnClient).attr({
				'onclick' : 'callPerson(this.id)'
			}).css({
				'background-color' : 'white'
			});
			webrtc.leaveRoom();
			helperFunctions.updateScroll(connectionKeyOnClient);
		};

		/**
		 * The call was accepted
		 * 1. Prepare window for call, enlarge and add click event for end call.
		 * 2.Check if window was closed by user, open window in order to start video
		 * 3.Call was accepted so remove the stop calling button
		 */
		socket.on('callAccepted', function(data) {
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			console.log(currentVideoContainer, currentVideoContainer.split("-").length, currentVideoContainer.split("-")[1]);
			if (currentVideoContainer.split("-")[1] === "") {
				currentVideoContainer += connectionKeyOnClient;
			}
			console.log("on call accepted ", currentVideoContainer);

			if ($('.calling-item').length) {
				$('.calling-item').remove();
				//remove option to stop calling person.
			}

			helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);

			$(currentVideoContainer).css({
				'width' : 800
			});
			//maybe do the enlarge window thingy here
			$('#video-' + connectionKeyOnClient).attr({
				'onclick' : 'removeChatCall(this.id)'
			}).css({
				'background-color' : 'red'
			});
			helperFunctions.updateScroll(connectionKeyOnClient);
		});

		/**
		 * Call rejected by peer
		 * Print message to corresponding window
		 * Add call button option for opened windows
		 * reopen window and print message for rejected
		 * Remove button for call pending, waiting for an answear ( stop calling person option )
		 */
		socket.on('callRejected', function(data) {
			console.log("on call rejected ", currentVideoContainer);
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);

			if ($('.calling-item').length) {
				$('.calling-item').remove();
				//remove option to stop calling person.
			}

			$('#messages-' + connectionKeyOnClient).append($('<li>').html(" (" + (new Date()).toLocaleTimeString() + "): " + "Call was rejected by peer."));
			helperFunctions.addCallButtonForOpenedWindows();
			helperFunctions.updateScroll(connectionKeyOnClient);
		});

		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		/**
		 * Video + audio call
		 * remove currently joined room
		 * emit call event to that certain person
		 * join room with name composed out of the two socketids
		 * remove all call buttons from other windows except the one called.
		 */
		this.callPerson = function(person) {
			webrtc.leaveRoom();
			var connectionKeyOnClient = person.split("-")[1];
			console.log("key on client ", connectionKeyOnClient);
			console.log("on call person ", currentVideoContainer);
			if (currentVideoContainer.split("-")[1] === "") {
				currentVideoContainer += connectionKeyOnClient;
			}

			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};

			if (!$("#calling-" + connectionKeyOnClient).length) {
				$('#messages-' + connectionKeyOnClient).append($("<li class='calling-item' id ='calling-" + connectionKeyOnClient + "'>").html(" (" + (new Date()).toLocaleTimeString() + "): " + "Calling...waiting for peer to answear" + "<button class='btn btn-danger' onclick='stopCalling(this.id)' id='stop-" + connectionKeyOnClient + "'>STOP</button>"));

				helperFunctions.updateScroll(connectionKeyOnClient);
			}

			socket.emit('call', data);
			webrtc.joinRoom(connections[connectionKeyOnClient].id + "/#" + socket.id);
			helperFunctions.removeCallButtonForOpenedWindow(connectionKeyOnClient);
		};

		/**
		 * Message event for a certain room
		 * Append message to corresponding window if it exists ( add focus on window )
		 * If it doesn't exist, create it, add event listeners for element,
		 */
		socket.on('room message', function(data) {
			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			if (rooms[data.roomName].opened == false || !rooms[data.roomName].opened) {
				createNewChatWindow(data.roomName, rooms, global.windowTypes.ROOM);
				addEventListener('#roomWrittenText-' + data.roomName, 'keyup', keyUpHandlerRooms);
			}

			el = $('#roomWrittenText-' + data.roomName);

			$('#messages-' + data.roomName).append($('<li>').html(connections[connectionKeyOnClient].username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));

			if (!el.is(":focus")) {
				helperFunctions.shakeAnimation($('#roomWindow-' + data.roomName));
				if (notificationProperties.room) {
					spawnNotification(helperFunctions.findLinks(data.message), "", "Room " + data.roomName + " from " + connections[connectionKeyOnClient].username);
				}
			}

			helperFunctions.updateScroll(data.roomName);

		});

		/**
		 * Is typing event
		 * Display in the chat window the fact that a user is writing a message to the other person
		 * Use a few seconds of delay after the user stopped typing
		 */
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

			clearTimeout(timeoutCheck[connections[connectionKeyOnClient].id]);

			timeoutCheck[connections[connectionKeyOnClient].id] = setTimeout(function() {
				$("#typing-" + connectionKeyOnClient).remove();
				timeoutCheck[connections[connectionKeyOnClient].id] = undefined;
				//used undef instead of delete for performance purposes
			}, 5000);
		});

		/**
		 * Is typing event
		 * Search user in roomUsersList and show he/she is typing
		 * Use a few seconds of delay after the user stopped typing
		 */
		socket.on('typingRoom', function(data) {
			var connectionKeyOnClient;

			if (rooms[data.roomName].opened) {

				for (var key in connections) {
					if (connections[key].id == "/#" + data.sender) {
						connectionKeyOnClient = key;
						break;
					}
				}

				var value = $('#roomUser' + data.roomName + "-" + connections[connectionKeyOnClient].username).text();

				if (value.match(/(typing\.{3})/g) != null && value.match(/(typing\.{3})/g).length > 0) {
					//console.log("still typing don't do stuff");
				} else {
					$('#roomUser' + data.roomName + "-" + connections[connectionKeyOnClient].username).text(value + " typing....");
				}

				clearTimeout(roomTimeoutCheck[connectionKeyOnClient]);

				roomTimeoutCheck[connectionKeyOnClient] = setTimeout(function() {
					$('#roomUser' + data.roomName + "-" + connections[connectionKeyOnClient].username).text(connections[connectionKeyOnClient].username);
					roomTimeoutCheck[connectionKeyOnClient] = undefined;
				}, 2000);

			}

		});

		/**
		 * Window creation function
		 * Created for a certain type of window ( CHAT or ROOM )
		 * Add some event listeners for the newly created element
		 * Add it to page
		 * Add element components according to window type
		 * Add classes according to window type, also functions for actions in the same maner
		 */
		function createNewChatWindow(key, connection, type) {

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

			var pos = helperFunctions.makeNewPosition(200),
			    chatWindow = $("<div class=" + classType + ">").css({
				top : pos[0],
				left : pos[1]
			}).attr("id", classType + "-" + key.toString()),
			    closeButton = $("<input class='btn-danger btn chat-window-close'  type = 'button' value='X'/>").attr({
				'id' : 'close-' + key.toString(),
				'onclick' : "removeChatWindow(this.id," + type + ")"
			}),
			    minimizeButton = $("<input class='btn-default btn chat-window-minimize'  type = 'button' value='_'/>").attr({
				'id' : 'minimize-' + key.toString(),
				'onclick' : "minimizeChatWindow(this.id," + type + ")"
			});
			pageHeader = $("<div class='pageHeader' id='main-lobby-header'>").text(pageHeaderText),
			optionsContainer = $("<div class='chat-options-container'></div>").attr({
				'id' : 'chat-options-' + key.toString()
			}),
			buzzButton = $("<button class='btn btn-default chat-window-option-button'><span class='glyphicon glyphicon-bell'></span></button>").attr({
				'id' : 'buzz-' + key.toString(),
				'onclick' : "buzz(this.id)"
			}),
			callButton = $("<button class='btn btn-default chat-window-option-button'><span class='glyphicon glyphicon-facetime-video'></span></button>").attr({
				'id' : 'video-' + key.toString(),
				'onclick' : "callPerson(this.id)"
			}),
			messagesContainer = $("<div class='messagesContainer'>").attr('id', "messagesContainer-" + key.toString()),
			list = $("<ul class='messages'>").attr('id', "messages-" + key.toString() + ""),
			form = $("<form class='form-inline " + classString + "-form' id='formTst' action='' onsubmit='return false;'>"),
			sendButton = $("<input class='sendButton btn-success btn' type = 'button'   value='Send'>").attr({
				'id' : key.toString(),
				'onclick' : type === global.windowTypes.CHAT ? "sendData('writtenText-'+this.id)" : "sendRoomData('roomWrittenText-'+this.id)"
			}),
			textToSend = $("<input  class='form-control " + classString + "-form-text' placeholder='Write your message here...'  autocomplete='off' >").attr('id', writtenText + "-" + key.toString()),
			roomUsersContainer = $("<div class='room-users-container'></div>"),
			roomUsersList = $("<ul></ul>").attr({
				"id" : "users-" + key.toString()
			}).addClass("room-users-list");

			messagesContainer.append(list);
			form.append(sendButton, textToSend);
			pageHeader.append(closeButton, minimizeButton);

			if (type === global.windowTypes.CHAT) {
				if ($('.videoContainer').length || $('.calling-item').length || $('.answear-reject').length) {//call pending or call already existing
					optionsContainer.append(buzzButton);
				} else {
					optionsContainer.append(buzzButton, callButton);
				}
			}

			chatWindow.append(pageHeader, messagesContainer, optionsContainer, form);

			if (type === global.windowTypes.ROOM) {
				roomUsersContainer.append(roomUsersList);
				chatWindow.append(roomUsersContainer);

				console.log("rooms: ", rooms);

				//helperFunctions.updateRoomUsersList(key.toString());

				for (var i = 0; i < rooms[key.toString()].users.length; i++) {

					for (var k in connections) {
						if (connections[k].id == '/#' + rooms[key.toString()].users[i]) {
							var li = $("<li id='roomUser" + key + "-" + connections[k].username + "'>").html(connections[k].username);
							break;
						}
					}
					roomUsersList.append(li);
				}

			}

			$(document.body).append(chatWindow);

			$('.' + classType).draggable({
				containment : 'parent',
				handle : ".pageHeader"
			});

			addEventListener('#' + classType + "-" + key.toString(), 'click', function(event) {

				var maxZIndex = 0,
				    zIndex = $('#' + classType + "-" + key.toString()).css("z-index");

				max = Math.max(maxZIndex, zIndex);

				$('#' + classType + "-" + key.toString()).css("z-index", max + 1);

				$("." + classType + ":not(#" + classType + "-" + key.toString() + ")").css("z-index", max - 1);

			});
		};

		this.minimizeChatWindow = function(id, type) {
			var key,
			    button,
			    buttonText;
			if (id) {
				key = id.split('-')[1];

				if (type === global.windowTypes.ROOM) {
					$('#roomWindow-' + key).slideUp("slow");
					buttonText = 'Room ' + key;
				} else {
					$('#chatWindow-' + key).slideUp("slow");
					buttonText = 'Chat ' + connections[key].username;
				}

				button = $("<button class='btn btn-default' onclick='reopenWindow(this.id)'>" + buttonText + "</button>").attr({
					'id' : 'reopen-' + key,
					'type' : type
				});

			} else {
				$('#chatWindow-all').slideUp("slow");
				button = $("<button class='btn btn-default' onclick='reopenWindow()'>Main Lobby</button>").attr({
					'id' : 'reopen'
				});
			}
			$('#minimize-container').append(button);
		};

		this.reopenWindow = function(id) {
			var key;

			if (id) {
				key = id.split('-')[1];
				if ($('#reopen-' + key).attr('type') == global.windowTypes.ROOM) {
					$('#roomWindow-' + key).slideDown("slow");
				} else {
					$('#chatWindow-' + key).slideDown("slow");
				}
				$('#reopen-' + key).remove();
			} else {
				$('#chatWindow-all').slideDown("slow");
				$('#reopen').remove();
			}
		};

		/**
		 * Remove chat window called from the interface for each window by a certain type
		 * Don using helper function
		 */
		this.removeChatWindow = function(id, type) {

			helperFunctions.removeWindow(id.split("-")[1], type === global.windowTypes.CHAT ? global.windowTypes.CHAT : global.windowTypes.ROOM);
		};

		/**
		 * Buzz function called from the interface
		 */
		this.buzz = function(id) {

			var connectionKeyOnClient = id.split("-")[1];
			data = {
				id : connections[connectionKeyOnClient].id,
				me : socket.id
			};

			$('#messages-' + connectionKeyOnClient).append($('<li>').html("You buzzed ! (" + (new Date()).toLocaleTimeString() + ")"));

			socket.emit('buzz', data);
		};

		/**
		 * Send message to certain window
		 * Emit private message or public message for main lobby accordingly
		 * Display links in message
		 */
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

		/**
		 * **Should have created a room
		 * Main lobby chat message
		 * Append to main window
		 */
		socket.on('chat message', function(data) {

			if (!helperFunctions.windowOnFocus() && notificationProperties.lobby) {
				spawnNotification(data.me.username + ": " + helperFunctions.findLinks(data.message), "", "Main lobby");
			}

			$('#messages-all').append($('<li>').html(data.me.username + " (" + (new Date()).toLocaleTimeString() + "): " + helperFunctions.findLinks(data.message)));
			helperFunctions.updateScroll();
		});

		/**
		 * Buzz event for a certain window
		 */
		socket.on('buzz', function(data) {

			var connectionKeyOnClient;
			for (var key in connections) {
				if (connections[key].id == "/#" + data.me) {
					connectionKeyOnClient = key;
					break;
				}
			}

			helperFunctions.openWindowForInfoIfClosed(connectionKeyOnClient);

			$('#messages-' + connectionKeyOnClient).append($('<li>').html("Buzzzzzzz ring ding ! (" + (new Date()).toLocaleTimeString() + ")"));

			helperFunctions.updateScroll(connectionKeyOnClient);

			// maybe do a funny func move
			if (notificationProperties.buzz) {
				var audio = new Audio('static/doorbell.wav');
				audio.play();
			}
		});

		/**
		 * Private message event
		 * Write message to corresponding window
		 * If the window is opened add focus to window and animation
		 * In the eventuality in which the window is not opened, open it and disaplay the message
		 */
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
				if (notificationProperties.private) {
					spawnNotification(helperFunctions.findLinks(data.message), "", "Private message from " + data.me.username);
				}
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

		/**
		 * Status change event for a certain user, append to user the correct status
		 */
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

		/**
		 * When a user leaves the room update list of users for rooms
		 * Same case when a user joins a room
		 * Same case when a user disconnects
		 */
		socket.on('update room users', function(data) {
			helperFunctions.updateRoomUsersList(data);
		});

		/**
		 *Update rooms when a rooms is created or closed.
		 * keep property opened of window on new update
		 * update joined rooms buffer with new coresponding room
		 * create room entry for list and append to list
		 * clicking on a room opens options (buttons opacity on timeout)
		 * double-clicking oppend a new window if the window is not already opened (only focus on window on this case).
		 * create window if not present
		 *  */
		socket.on('update rooms', function(data) {
			for (var key in rooms) {

				if (rooms[key] && rooms[key].opened) {
					data[key].opened = rooms[key].opened;
				}

				if (joinedRooms[key]) {
					joinedRooms[key] = data[key];
				}

			}

			rooms = data;
			var roomType;
			$('#rooms').empty();

			for (var key in rooms) {

				if (rooms[key]) {

					roomType = rooms[key].private ? "private" : "public";

					var li = $('<li>').addClass("room").attr('id', key.toString()).html(rooms[key].room + " Members:" + rooms[key].users.length);

					$('#rooms').append(li);

					$("#" + key.toString()).addClass(roomType);

					$("#" + key.toString()).removeClass('room');
					$("#" + key.toString()).addClass('room');

					//add event listeners

					addEventListener('#' + key.toString(), 'click', function(event) {

						clearTimeout(buttonsTimeout[event.target.id]);
						delete buttonsTimeout[event.target.id];

						var join = $("<input class='btn-success btn room-button pull-right'  type = 'button' value='Join'/>").attr({
							"id" : 'join-' + event.target.id,
							"onclick" : "joinRoom(this.id)"
						}),
						    leave = $("<input class='btn-warning btn room-button pull-right'  type = 'button' value='Leave'/>").attr({
							"id" : 'leave-' + event.target.id,
							"onclick" : "leaveRoom(this.id)"
						});

						if (joinedRooms[event.target.id]) {

							$("#leave-" + event.target.id).length > 0 ? "" : leave.appendTo($("#" + event.target.id)).animate({
								opacity : '0.2'
							}, 5000);
							//TODO add open button
						} else {

							$("#leave-" + event.target.id).length > 0 && $("#join-" + event.target.id).length > 0 ? "" : (function() {
								leave.appendTo($("#" + event.target.id)).animate({
									opacity : '0.2'
								}, 5000);
								join.appendTo($("#" + event.target.id)).animate({
									opacity : '0.2'
								}, 5000);
							})();

						}

						buttonsTimeout[event.target.id] = setTimeout(function() {
							$("#leave-" + event.target.id).remove();
							$("#join-" + event.target.id).remove();
						}, 5000);

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
			}

			//

		});

		/**
		 * Event on user disconnecting from chat.
		 * An opened conversation is prompted that the user left.
		 * Update users list.
		 * Event listener on click to open window or focus if already opened.
		 */
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
				$('#buzz-' + connectionKeyOnClient).attr({
					"disabled" : true
				});
				$('#video-' + connectionKeyOnClient).attr({
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
			doTypingMessageRooms(event.target.id);
		}
		event.preventDefault();
		event.stopPropagation();
		return false;
	}

});
