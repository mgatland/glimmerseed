define(["pos"], function (Pos) {
	var Camera = function (pixelWindow, isSpectator) {
		var _this = this;
		this.pos = new Pos(0,0);
		var cameraSlackX = pixelWindow.width/8;
		var cameraSlackY = 0;

		var moveTowards1d = function(desired, slack, axis, slack2, slack3) {
			if (isSpectator) return;
			var distance = desired - _this.pos[axis];
			var dir = distance ? distance < 0 ? -1:1:0;
			var distanceAbs = Math.abs(distance);
			if (distanceAbs > slack) _this.pos[axis] += dir;
			if (slack2 && distanceAbs > slack2) _this.pos[axis] += dir;
			if (slack3 && distanceAbs > slack3) _this.pos[axis] += dir*4;
		}

		this.panTowards = function (x, y) {
			if (isSpectator) return;
			moveTowards1d(x - pixelWindow.width/2, cameraSlackX, "x", cameraSlackX*2, cameraSlackX*4);
			moveTowards1d(y - pixelWindow.height/2, cameraSlackY, "y", pixelWindow.height/2-12, pixelWindow.height);
		}

		this.jumpTo = function (x, y) {
			if (isSpectator) return;
			this.pos.x = x - pixelWindow.width/2;
			this.pos.y = y - pixelWindow.height/2
		}
	};
	return Camera;
});