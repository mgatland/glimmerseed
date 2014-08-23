"use strict";
define(["colors"], function (Colors) {
	var TitleState = function () {
		var fakeLoadingProgress = 0;
		var maxLoadingProgress = 20;

		this.gotData = function (data) {
			if (data.type === "loggedin") {
				console.log("Logged in");
				this.transition = true;
				//hide the menu
				document.querySelector("#menu").classList.add("hide");
			}
		}

		this.update = function (keys, painter, Network, Events) {
			if (fakeLoadingProgress < maxLoadingProgress) {
				fakeLoadingProgress+= 2;
			}
		};
		this.draw = function (painter) {
			if (fakeLoadingProgress >= maxLoadingProgress) {
				painter.drawText(40, 20, "Space Protector", Colors.good);
				painter.drawText(40, 50, "> Press Start  ", Colors.good);
			}
			painter.drawText(20, 74, Array(fakeLoadingProgress+1).join("…"), Colors.good);
			painter.drawAbsRect(0, 0, 192, 104, Colors.bad, 10);
		};
		this.paused = true; //fixme: controls if menu is shown
	}
	return TitleState;
});