"use strict";
define(["explosion", "events", "colors", "entity", "dir", "pos", 
	"util", "network"], 
	//TODO: don't have Network here.
	function (Explosion, Events, Colors, Entity, Dir, Pos, Util,
		Network) {

	console.log("Define Shot");
	var shotSpriteH = "111111\n";
	var shotSpriteV = "1\n1\n1\n1\n1\n1\n";

	var Shot = function (level, pos, dir, owner, isLocal) {
		Util.extend(this, new Entity(pos, new Pos(5,1)));
		var _this = this;

		this.dir = dir;
		this.age = 0;

		this.hitsMonsters = (owner === "player");
		this.killPlayerOnTouch = !this.hitsMonsters;

		this.isLocal = !!isLocal;

		this.pos.moveXY(2,1);

		if (!dir.isHorizontal) {
			this.size.x = 1;
			this.size.y = 5;
		}

		if (dir === Dir.LEFT) {
			this.pos.moveXY(-8, 0);
		} else if (dir === Dir.RIGHT) {
			this.pos.moveXY(3, 0);
		} else if (dir === Dir.UP) {

		} else {

		}

		this.update = function () {
			if (this.live === false) return;

			this.collisions.forEach(function (other) {
				if (other.ignoreShots !== true) {
					_this.live = false;
				}
			});
			
			this.collisions.length = 0;
			if (this.live === false) return;

			this.pos.moveInDir(this.dir, 2);

			var checkPos;
			if (this.dir === Dir.LEFT) {
				checkPos = this.pos;
			} else if (this.dir === Dir.RIGHT) {
				checkPos = this.pos.clone().moveXY(this.size.x, 0);
			} else if (this.dir === Dir.UP) {
				checkPos = this.pos;
			} else if (this.dir === Dir.DOWN) {
				checkPos = this.pos.clone().moveXY(0, this.size.y);
			}
			
			if (level.isPointColliding(checkPos)) {
				if (owner === "player") Events.playSound("hitwall", this.pos.clone());
				this.live = false;

				if (this.isLocal) {
					//network collision with wall
					Network.send({
						type:"break", 
						pos:level.posToGridPos(checkPos).toData(),
						dir: Dir.toId(this.dir)
					});
					//test hacks
					Network.ping();
				}

				//Move out of wall to place explosion correctly.
				checkPos.moveInDir(this.dir.reverse, 1);
				var count = 0;
				while (level.isPointColliding(checkPos) && count < 10) {
					checkPos.moveInDir(this.dir.reverse, 1);
					count++;
				}
				//Move to the left side of the explosion
				if (this.dir === Dir.RIGHT) checkPos.moveXY(-4, 0);
				if (this.dir === Dir.UP) checkPos.moveXY(-2, -5);
				if (this.dir === Dir.DOWN) checkPos.moveXY(-2, -2);
				checkPos.moveXY(0, -2); //explosion starts above the shot
				Events.explosion(new Explosion(this.dir, owner, checkPos));
			}

			this.age++;
			if (this.age > 35) {
				this.live = false;
			}
		}

		this.draw = function (painter) {
			var sprite = this.dir.isHorizontal ? shotSpriteH : shotSpriteV;
			if (this.live) {
				var color = this.hitsMonsters ? Colors.good : Colors.bad;
				painter.drawSprite(this.pos.x, this.pos.y, sprite, color);
			}
		}
	}
	return Shot;
});