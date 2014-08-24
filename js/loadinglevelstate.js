"use strict";
define(["colors"], function (Colors) {
	var LoadingLevelState = function () {
		var fakeLoadingProgress = 0;
		var maxLoadingProgress = 20;

		this.gotData = function (data) {
			console.log(data);
			if (data.type === "level") {
				console.log("Level has loaded.");
				this.transition = true;
				this.levelData = data.level;
			}
			if (data.type === "monsterHost") return false;
			return true;
		}

		this.update = function (keys, painter, Network, Events) {
			if (fakeLoadingProgress < maxLoadingProgress) {
				fakeLoadingProgress+= 0.5;
			}
		};
		this.draw = function (painter) {
			painter.drawText(40, 20, "Loading level", Colors.good);
			painter.drawText(20, 74, Array(Math.floor(fakeLoadingProgress+1)).join("…"), Colors.good);
			painter.drawAbsRect(0, 0, 192, 104, Colors.bad, 10);
		};
	}
	return LoadingLevelState;
});