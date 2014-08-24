"use strict";
define([], function () {
	var Sprites = {};
	var spriteWidth = 12;

	Sprites.rotate = function(frames) {
		var rotFrames = [];
		frames.forEach(function (frame) {
			var width = frame.width;
			var rotFrame = [];
			for (var i = 0; i < frame.length; i++) {
				var x = i % width;
				var y = Math.floor(i / width);
				rotFrame[x*width+y] = frame[i];
			}
			rotFrame.width = width;
			rotFrames.push(rotFrame);
		});
		return rotFrames;
	}

	Sprites.flip = function(frames) {
		var rotFrames = [];
		frames.forEach(function (frame) {
			var width = frame.width;
			var rotFrame = [];
			for (var i = 0; i < frame.length; i++) {
				var x = i % width;
				var y = Math.floor(i / width);
				rotFrame[width-x-1+y*width] = frame[i];
			}
			rotFrame.width = width;
			rotFrames.push(rotFrame);
		});
		return rotFrames;
	}

	Sprites.loadFramesFromData = function (data) {
		var frames = [];
		var frameSize = spriteWidth * spriteWidth;
		var pointer = 0 + "v1.0:".length;
		var frameToLoad = 0;
		while (pointer < data.length) {
			frames[frameToLoad] = [];
			frames[frameToLoad].width = spriteWidth;
			var frameEnd = pointer + frameSize;
			while (pointer < frameEnd) {
				frames[frameToLoad].push(parseInt(data.slice(pointer, pointer+1)));
				pointer++;
			}
			frameToLoad++;
		}
		return frames;
	}
	return Sprites;
});