"use strict";
define([], function () {

    var fullscreenTools = {};
    fullscreenTools.goFullscreenIfRequired = function (canvas, pixelWindow, pixelSize) {
    	//If the game can't fit full size in any orientation,
    	//then we enable full screen mode (if we can.)
    	var minDimension = Math.min(window.innerWidth, window.innerHeight);
    	var maxDimension = Math.max(window.innerWidth, window.innerHeight);
    	var widthIsOK = maxDimension >= pixelWindow.width * pixelSize;
    	var heightIsOK = minDimension >= pixelWindow.height * pixelSize;
    	if (!widthIsOK || !heightIsOK) {
  
        if (screenfull.enabled) {
          screenfull.request();
        }
          
    	}
    }

    return fullscreenTools;
});