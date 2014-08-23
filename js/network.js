"use strict";
define([], function () {

  var socket = undefined;
  var port = "80";

	var Network = {};
	Network.debug = {};
	var simulateNetworkProblems = false;
	Network.debug.fakeLag = 50;
	Network.debug.fakeJitter = 50;
	Network.debug.fakePacketLoss = 0.02;

	Network.debug.simulateNetworkProblems = function (value) {
		simulateNetworkProblems = value ? true : false;
		if (simulateNetworkProblems) {
			var newAlert = document.createElement("p");
  			var newContent = document.createTextNode("simulateNetworkProblems ON - adding lag, jitter and packet loss.");
  			newAlert.appendChild(newContent); //add the text node to the newly created div.
			document.getElementById('alerts').appendChild(newAlert);
		} else {
			var newAlert = document.createElement("p");
  			var newContent = document.createTextNode("simulateNetworkProblems OFF");
  			newAlert.appendChild(newContent); //add the text node to the newly created div.
			document.getElementById('alerts').appendChild(newAlert);
		}
	}

	var causeFakeNetworkProblems = function (dataCallback, data) {
		if (Math.random() < Network.debug.fakePacketLoss) return; //packet lost.
		var lag = Network.debug.fakeLag + Math.random() * Network.debug.fakeJitter;
		window.setTimeout(dataCallback, lag, data);
	}

	Network.connectToServer = function (dataCallback) {

    console.log("connecting to port " + port);
    socket = io.connect("http://" + document.domain + ":" + port);

    socket.on('connect', function () {
        // first we want users to enter their names
        console.log("Connected!");
    });

    socket.on('data', function (data) {

    	if (data.type === "pong") {
    		pong(data.num);
    		return;
    	}

			if (simulateNetworkProblems === true) {
				causeFakeNetworkProblems(dataCallback, data);
			} else {
				dataCallback(data);
			}
    });
	}

	Network.logIn = function (name) {
		console.log("logging in " + name);
		this.send({type:"login", name:name});
	}

	var reallySend = function (data) {
		socket.emit("data", data);
	}

	Network.send = function (data) {
		if (simulateNetworkProblems === true) {
			causeFakeNetworkProblems(reallySend, data);
		} else {
			reallySend(data);
		}
	}

	var pingNum = 0;
	var pingTime = [];
	Network.ping = function () {
		pingNum++;
		pingTime[pingNum] = Date.now();
		this.send({
			type:"ping", 
			num: pingNum
		});
	}

	var pong = function (num) {
		var delay = Date.now() - pingTime[num];
		console.log("latency: " + delay);
	}

	var connectButton = document.querySelector("#connect-button");
	var nameInput = document.querySelector("#name-input");

	var triggerLogIn = function (e) {
		var name = nameInput.value;
		Network.logIn(name);
	}

	connectButton.addEventListener('click', triggerLogIn);
	nameInput.addEventListener('keydown', function (event) {
		if (event.keyCode == 13) {
          triggerLogIn(event);
          return false;
    }
	});

	return Network;
});