"use strict";
define(["colors"], function (Colors) {
	var TitleState = function () {

		this.gotData = function (data) {
			if (data.type === "loggedin") {
				console.log("Logged in");
				this.transition = true;
				this.userData = data.data; //hacked way to pass data out.
				//hide the menu
				document.querySelector("#menu").classList.add("hide");
				return true;
			}
			if (data.type === "p") return true; //ignore
			if (data.type === "mon") return true; //ignore
			return false;
		}

		this.update = function (keys, painter, Network, Events) {
		};
		this.draw = function (painter) {
		};
		this.paused = true; //fixme: controls if menu is shown
	}
	return TitleState;
});