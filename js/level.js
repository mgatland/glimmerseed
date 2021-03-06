"use strict";
define(["monster", "player", "events", "colors", "pos"],
	function (Monster, Player, Events, Colors, Pos) {
	var Level = function(mapData, tileSize) {
		var level = this; //for use in private methods
		var map = [];
		var spawners = [];

		var drawEdge = function(x, y, checkX, checkY, mode, painter) {
			if (!level.isSolid(x+checkX, y+checkY)) {
				var drawOffsetX = (checkX === 1) ? tileSize - 1 : 0;
				var drawOffsetY = (checkY === 1) ? tileSize - 1 : 0;
				var width;
				var height;
				if (mode === "horizontal") {
					width = 10;
					height = 1;
				} else if (mode === "vertical") {
					width = 1;
					height = 10;
				} else { //corner
					width = 1;
					height = 1;
				}
				painter.drawRect(x*tileSize+drawOffsetX,y*tileSize+drawOffsetY, width, height, Colors.background);
			}
		}

		var drawTile = function (x, y, painter) {
			if (!painter.isOnScreen(x*tileSize, y*tileSize, tileSize, tileSize)) return;
			drawEdge(x, y, 0, -1, "horizontal", painter);
			drawEdge(x, y, 0, 1, "horizontal", painter);
			drawEdge(x, y, -1, 0, "vertical", painter);
			drawEdge(x, y, +1, 0, "vertical", painter);
			drawEdge(x, y, -1, -1, "corner", painter);
			drawEdge(x, y, +1, -1, "corner", painter);
			drawEdge(x, y, -1, +1, "corner", painter);
			drawEdge(x, y, +1, +1, "corner", painter);
		}

		var loadMap = function (mapData) {
			map = mapData.map;
			spawners = mapData.spawners;
			spawnEntities();
		}

		var spawnEntities = function () {
			spawners.forEach(function (s) {
				if (s.type==="p") {
					Events.player(new Player(level, s.x*tileSize, s.y*tileSize));
				}
				if (s.type==="m") {
					Events.monster(Monster.create1(level, s.x*tileSize, s.y*tileSize));
				}
				if (s.type==="k") {
					Events.monster(Monster.create2(level, s.x*tileSize, s.y*tileSize));
				}
				if (s.type==="x") {
					Events.monster(Monster.createCrate(level, s.x*tileSize, s.y*tileSize));
				}
				if (s.type==="!") {
					Events.monster(Monster.createFlag(level, s.x*tileSize, s.y*tileSize));
				}
				if (s.type==="@") {
					Events.monster(Monster.createEnd(level, s.x*tileSize, s.y*tileSize));
				}
			});
		}

		//actor must have pos, size
		//this returns a grid coord, not real coord
		this.trace = function (actor, dir, range) {
			if (range === undefined) range === 99999;
			var tracePos = actor.pos.clone();
			tracePos.moveXY(
				Math.floor(actor.size.x/2), 
				Math.floor(actor.size.y/2));
			while (!this.isPointColliding(tracePos) && range > 0) {
				tracePos.moveInDir(dir, tileSize);
				range--;
			}
			return this.posToGridPos(tracePos);
		}

		this.isColliding = function (player) {
			//find out which cell each corner is in.
			//If a corner is inside a solid square, return true.
			var corner = player.pos.clone();
			if (this.isPointColliding(corner)) return true;
			if (this.isPointColliding(corner.moveXY(player.size.x-1,0))) return true;
			if (this.isPointColliding(corner.moveXY(0,player.size.y-1))) return true;
			if (this.isPointColliding(corner.moveXY(-player.size.x+1,0))) return true;
			return false;
		}
		this.isPointColliding = function (pos) {
			var x = Math.floor(pos.x / tileSize);
			var y = Math.floor(pos.y / tileSize);
			return this.isSolid(x, y);
		}

		this.posToGridPos = function (pos) {
			var x = Math.floor(pos.x / tileSize);
			var y = Math.floor(pos.y / tileSize);
			return new Pos(x, y);
		}

		this.gridPosToPos = function (gridPos) {
			var x = gridPos.x * tileSize;
			var y = gridPos.y * tileSize;
			return new Pos(x, y);			
		}

		this.cellDepthAt = function (p) {
			var pos = p.clone();
			var depth = 0;
			while (!this.isPointColliding(pos)) {
				depth++;
				pos.y += tileSize;
			}
			return depth;
		}

		this.isSolidAtGridPos = function(gridPos) {
			return this.isSolid(gridPos.x, gridPos.y);
		}

		this.isSolid = function(x, y) {
			if (x < 0) return true;
			if (y < 0) return true;
			if (map[y] === undefined) return true;
			if (map[y][x] === 0) return false;
			return true;
		}

		this.draw = function(painter) {
			var bounds = painter.screenBounds();
			var minX = Math.floor(bounds.minX / tileSize);
			var minY = Math.floor(bounds.minY / tileSize);
			var maxX = Math.floor(bounds.maxX / tileSize);
			var maxY = Math.floor(bounds.maxY / tileSize);
			for (var y = minY; y <= maxY; y++) {
				for (var x = minX; x <= maxX; x++) {
					if (map[y] && map[y][x] === 1) {
						drawTile(x, y, painter);	
					}
				}
			}
		}

		//for editor only
		this.setCell = function(x, y, value) {
			if (!map[y]) {
				map[y] = [];
			}
			map[y][x] = value;
		}

		//for editor only
		this.getSpawners = function () {
			return spawners;
		}

		//for editor only
		this.setSpawners = function (newSpawners) {
			spawners = newSpawners;
		}

		loadMap(mapData);
	};
	return Level;
});