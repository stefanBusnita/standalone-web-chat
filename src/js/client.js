$(document).ready(function() {

	(function() {
		var socket = io(),
		    data = {},
		    username,
		    connections = [],
		    openedChats = [];

		$("#myModal").modal();
		$('.chatWindow').draggable({
			containment : 'parent',
			handle : ".lobby-header"
		});
		$('.chatWindow').resizable();
		$('#myModal').on('hidden.bs.modal', function() {
			socket.emit('username', $('#username').val());
		});

		function updateScroll() {
			$('.messagesContainer').animate({
				scrollTop : $('.messagesContainer').prop("scrollHeight")
			}, 500);
		}

		function makeNewPosition(offset) {
			var pageHeight = $(window).height() - offset,
			    pageWidth = $(window).width() - offset,
			    randomHeight = Math.floor(Math.random() * pageHeight),
			    randomWidth = Math.floor(Math.random() * pageWidth);
			return [randomHeight, randomWidth];
		}

		function createNewChatWindow(key, connection) {

			connections[key].opened = true;

			var pos = makeNewPosition(150),
			    chatWindow = $("<div class='chatWindow'>").css({
				top : pos[0],
				left : pos[1]
			}),
			    pageHeader = $("<div class='pageHeader' id='main-lobby-header'>").text(connection.username),
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
			chatWindow.append(pageHeader, messagesContainer, form);

			$(document.body).append(chatWindow);

			$('.chatWindow').draggable({
				containment : 'parent',
				handle : ".lobby-header"
			});

			//addEventListener()
		}

		function findLinks(text) {
			var regx = /(http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/;
			return text.replace(regx, function(capture) {
				return "<a href="+ capture + " target='_blank'> "+ capture +"</a>";
			});
		}


		this.sendData = function(id) {
			var sendTo = "#" + id.toString();
			console.log(sendTo, $(sendTo).val());
			data = {
				message : $(sendTo).val(),
				id : socket.id
			};

			if ( typeof data.message != undefined && data.message != null && data.message != "") {
				$('#messages-all').append($('<li>').html(username + ": " + findLinks($(sendTo).val())));
				socket.emit('chat message', data);
				$(sendTo).val('');
				updateScroll();
			} else {
				$('#messages-all').append($('<li>').text("You can't send an empty message."));
			}

		};

		socket.on('chat message', function(data) {
			$('#messages-all').append($('<li>').html(data.me + ": " + findLinks(data.message)));
			updateScroll();
		});

		socket.on('username', function(data) {

			if (data === "has") {
				alert("username already chosen");
				$("#myModal").modal();
				return;
			}

			username = data;
		});

		socket.on('update', function(users) {
			$('#users').empty();
			connections = users;
			for (var key in users) {
				$('#users').append($('<li>').addClass('user').attr('id', key.toString()).text(users[key.toString()].username));

				addEventListener('#' + key.toString(), 'click', function(event) {

					console.log("clicked ", event.target.id);

					//1.check if window is already open and focus on that window ??

					//2.at remove delete event listeners, remove chat window, remove from openedWindows

					//3.keyup event listener

					!connections[(event.target.id).toString()].opened ? createNewChatWindow(event.target.id, connections[(event.target.id).toString()]) : "do focus on window";

					event.stopPropagation();
				});
			}
		});

	})();

	(function() {
		var handlers = [];

		this.addEventListener = function(element, type, fn) {
			$(element).on(type, fn);
			handlers[element] = fn;
		};

		this.removeEventListener = function(element, type) {

		};

	})();

	addEventListener('#writtenText-all', 'keyup', function(event) {
		var keycode = (event.keyCode ? event.keyCode : event.which);
		if (keycode == '13') {
			sendData(event.target.id);
		}
		event.preventDefault();
		event.stopPropagation();
		return false;
	});

});
