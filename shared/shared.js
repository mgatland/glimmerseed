//This might not be used. Leftover from Ducks.
(function(exports){

	exports.Pos = function(x, y) {
	    this.x = x;
	    this.y = y;
	    this.toString = function() {
	        return "(" + this.x + "," + this.y + ")";
	    }
	}

})(typeof exports === 'undefined'? this['shared']={}: exports);