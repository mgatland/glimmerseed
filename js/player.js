"use strict";
define(["shot", "events", "colors", "walkingthing", "sprites", "dir", "pos", "util", "spritedata", "network", "blockremovefx"], 
	function (Shot, Events, Colors, WalkingThing, Sprites, Dir, Pos, Util, SpriteData, Network, BlockRemoveFx) {

	var Player = function (level, x, y) {
		var _this = this;
		
		var startPos = new Pos(x, y);
		Util.extend(this, new WalkingThing(level, startPos, new Pos(5,6)));

		//Replicated variables
		this.id = null; //replicated in but not out.
		this.name = null;
		this.block = 0;
		this.state = "falling";
		this.fallingTime = 0;
		this.loading = 0;
		this.refireRate = 30;
		this.dir = Dir.RIGHT;
		this.vDir = null;
		this.shotThisFrame = false;
		this.groundedY = this.pos.y;

		var blockToolRange = 2;
		var spawnPoint = startPos.clone();
		var currentCheckpoint = null; //The flag entity we last touched

		var deadTimer = 0;
		var hitPos = null;
		var animFrame = 0;
		var animDelay = 0;

		var animState = "standing";
		var shootingAnim = false;
		var timeSinceLastShot = 0;

		var jumpIsQueued = false;

		this.toData = function () {
			var data = {};
			data.id = this.id; //server should ignore this.
			data.name = undefined; //server will fill it in
			data.block = this.block;
			data.state = this.state;
			data.fallingTime = this.fallingTime;
			data.loading = this.loading;
			data.dir = Dir.toId(this.dir);
			data.vDir = Dir.toId(this.vDir);
			data.shotThisFrame = this.shotThisFrame;
			data.groundedY = this.groundedY;

			data.spawnPoint = spawnPoint.toData();
			//currentCheckpoint
			data.deadTimer = deadTimer;
			data.hitPos = hitPos ? hitPos.toData() : null;
			data.animFrame = animFrame;
			data.animDelay = animDelay;
			data.animState = animState;
			data.shootingAnim = shootingAnim;
			data.timeSinceLastShot = timeSinceLastShot;
			data.jumpIsQueued = jumpIsQueued;

			WalkingThing.toData(this, data);
			return data;
		}

		var stateToBinary = function (stateString) {
			if (stateString === "falling") return 0;
			if (stateString === "jumping") return 1;
			if (stateString === "grounded") return 2;
			console.log("Invalid state " + stateString);
			return 0;
		}

		var stateFromBinary = function (state) {
			if (state === 0) return "falling";
			if (state === 1) return "jumping";
			if (state === 2) return "grounded";
			console.log("Invalid state " + state);
			return "falling";
		}

		var animStateToBinary = function (stateString) {
			if (stateString === "falling") return 0;
			if (stateString === "jumping") return 1;
			if (stateString === "standing") return 2;
			if (stateString === "running") return 3;
			console.log("Invalid animState " + stateString);
			return 0;
		}

		var animStateFromBinary = function (state) {
			if (state === 0) return "falling";
			if (state === 1) return "jumping";
			if (state === 2) return "standing";
			if (state === 3) return "running";
			console.log("Invalid animState " + state);
			return "falling";
		}



		//alternative to 'toData'
		this.toBinary = function (data) {
			var buffer = new ArrayBuffer(35); // 256-byte ArrayBuffer
			var dv = new DataView(buffer);
			dv.setUint16(0, this.id, true); //server should ignore this.
			//name is skipped
			dv.setUint8(2, this.block, true);
			dv.setUint8(3, stateToBinary(this.state), true);
			dv.setUint8(4, this.fallingTime, true);
			dv.setUint8(5, this.loading, true);
			dv.setUint8(6, Dir.toId(this.dir), true);
			dv.setUint8(7, Dir.toId(this.vDir), true);
			dv.setUint8(8, this.shotThisFrame === true ? 1 : 0, true);
			dv.setUint16(9, this.groundedY, true);
			//10
			spawnPoint.toBinary(dv, 11);
			//12
			//13
			//14
			//currentCheckpoint
			dv.setUint8(15, deadTimer, true);
			if (hitPos) {
				hitPos.toBinary(dv, 16);
			} else {
				new Pos(0,0).toBinary(dv,16); //fixme nulls not supported
			}
			//17,18,19
			dv.setUint8(20, animFrame, true);
			dv.setUint8(21, animDelay, true);
			dv.setUint8(22, animStateToBinary(animState), true);
			dv.setUint8(23, shootingAnim === true ? 1 : 0, true);
			dv.setUint8(24, timeSinceLastShot, true);
			dv.setUint8(25, jumpIsQueued === true ? 1 : 0, true);
			WalkingThing.toBinary(this, dv, 26); //9 bytes
			return buffer;
		}

		this.fromBinary = function (buffer) {
			var dv = new DataView(buffer);
			this.id = dv.getUint16(0, true);
			//name is skipped
			this.block = dv.getUint8(2, true);
			this.state = stateFromBinary(dv.getUint8(3, true));
			this.fallingTime = dv.getUint8(4, true);
			this.loading = dv.getUint8(5, true);
			this.dir = Dir.fromId(dv.getUint8(6, true));
			this.vDir = Dir.fromId(dv.getUint8(7, true));
			this.shotThisFrame = (dv.getUint8(8, true) === 1);
			this.groundedY = dv.getUint16(9, true);
			//10
			this.spawnPoint = Pos.fromBinary(dv, 11);
			//12, 13, 14
			//currentCheckpoint
			deadTimer = dv.getUint8(15, true);
			hitPos = Pos.fromBinary(dv, 16);
			if (hitPos.x === 0 && hitPos.y === 0) hitPos = null; //compatible with old code
			//17,18,19
			animFrame = dv.getUint8(20, true);
			animDelay = dv.getUint8(21, true);
			animState = animStateFromBinary(dv.getUint8(22, true));
			shootingAnim = (dv.getUint8(23, true) === 1);
			timeSinceLastShot = dv.getUint8(24, true);
			jumpIsQueued = (dv.getUint8(25, true) === 1);
			WalkingThing.fromBinary(this, dv, 26); //9 bytes
			return this;
		}

		this.fromData = function (data) {
			this.id = data.id;
			this.name = data.name;
			this.block = data.block;
			this.state = data.state;
			this.fallingTime = data.fallingTime;
			this.loading = data.loading;
			this.dir = Dir.fromId(data.dir);
			this.vDir = Dir.fromId(data.vDir);
			this.shotThisFrame = data.shotThisFrame;
			this.groundedY = data.groundedY;

			spawnPoint = Pos.fromData(data.spawnPoint);
			//currentCheckpoint
			deadTimer = data.deadTimer;
			hitPos = Pos.fromData(data.hitPos);
			animFrame = data.animFrame;
			animDelay = data.animDelay;
			animState = data.animState;
			shootingAnim = data.shootingAnim;
			timeSinceLastShot = data.timeSinceLastShot;
			jumpIsQueued = data.jumpIsQueued;

			WalkingThing.fromData(this, data);
		}

		//Constants or not replicated
		var maxDeadTime = 30;
		var playerSprites = Sprites.loadFramesFromData(SpriteData.player);
		this.hidden = false;

		//TODO: decide if replicated
		var deaths = 0;

		//functions

		var states = {

			jumping: new function () {
				var phases = [];
				phases[1] = {ySpeed: -2, normalDuration: 3};
				phases[2] = {ySpeed: -1, normalDuration: 5, jumpHeldDuration: 15};
				phases[3] = {ySpeed: 0, normalDuration: 6};
				this.preupdate = function () {};
				this.update = function (jumpIsHeld) {
					animState = "jumping";
					var phase = phases[this.jumpPhase];

					var speed = phase.ySpeed;
					var spaceAboveMe = this.tryMove(0, speed);

					this.jumpTime++;
					var duration = (jumpIsHeld && phase.jumpHeldDuration) ? phase.jumpHeldDuration : phase.normalDuration;
					if (this.jumpTime > duration) {
						this.jumpPhase++;
						this.jumpTime = 0;
					}
					if (!spaceAboveMe && this.jumpPhase < 3) {
						this.jumpPhase = 3;
						this.jumpTime = 0;
					}
					if (this.jumpPhase === 4) {
						this.state = "falling";
						this.fallingTime = 0;
					}
				};
			},

			falling: new function () {
				this.preupdate = function () {};
				this.update = function () {
					animState = "falling";
					if (this.isOnGround()) {
						Events.playSound("land", this.pos.clone());
						this.state = "grounded";
					} else {
						this.fallingTime++;
						if (this.fallingTime > 255) {
							//prevent overflow in binary mode
							this.fallingTime = 255;
						}
						var speed = this.fallingTime < 10 ? 1 : 2;
						this.tryMove(0,speed);
					}
				};
			},

			grounded: new function () {
				this.preupdate = function () {
					if (jumpIsQueued) {
						this.state = "jumping";
						this.jumpTime = 0;
						this.jumpPhase = 1;
						jumpIsQueued = false;
						Events.playSound("jump", this.pos.clone());
					}
				};
				this.update = function () {
					if (!this.isOnGround()) {
						this.fallingTime++;
						if (this.fallingTime >= 3) {
							this.state = "falling";
						}
					} else {
						this.fallingTime = 0;
					}
				};
			}
		};

		this.draw = function (painter) {
			if (this.hidden) return;

			var frame;
			if (animState === "standing") {
				frame = 0;
			} else if (animState === "running") {
				frame = animFrame+1;
			} else if (animState === "falling" ) {
				frame = 5;
			} else if (animState === "jumping") {
				frame = 1;
			} else {
				console.log("Error animation state " + animState);
			}
			if (shootingAnim && frame === 0) frame = 6;
			var img = playerSprites[frame];
			if (this.live) {
				painter.drawSprite2(this.pos.x, this.pos.y, this.size.x, 
					this.dir, img, Colors.good);
			} else {
				var decay = (maxDeadTime - deadTimer) / maxDeadTime;
				painter.drawSprite2(this.pos.x, this.pos.y, this.size.x, 
					this.dir, img, Colors.highlight, false, decay, hitPos);
			}

			if (this.vDir) {
				drawTargetDot(painter, this.vDir);	
			} else {
				drawTargetDot(painter, this.dir);
			}

			if (this.name) {
				var name = this.name;
				painter.drawText(this.pos.x - name.length * 1.5, this.pos.y + 10,
					name, Colors.good, true, 5);
			}
			
		}

		var drawTargetDot = function (painter, dir) {
			//draw targetting dots
			var targetGrid = level.trace(_this, dir, blockToolRange);
			if (level.isSolidAtGridPos(targetGrid) && _this.block === 1) {
				targetGrid.moveInDir(dir.reverse, 1);
			}
			var targetPos = level.gridPosToPos(targetGrid);
			painter.drawRect(targetPos.x+4, targetPos.y+4, 2, 2, Colors.background);
		}

		this.isOnGround = function () {
			var leftFoot = level.isPointColliding(this.pos.clone().moveXY(0,this.size.y));
			var rightFoot = level.isPointColliding(this.pos.clone().moveXY(this.size.x-1,this.size.y));
			return (leftFoot || rightFoot);
		}

		var networkBreak = function (pos, dir) {
			//network collision with wall
			Network.send({
				type:"break", 
				pos: pos.toData(),
				dir: Dir.toId(dir)
			});
			//Also do a ping test.
			Network.ping();
		}

		this._shoot = function (isLocal) {
			var dir = (this.vDir ? this.vDir : this.dir);
			//no shooting any more
			//nope -> Events.shoot(new Shot(level, this.pos.clone(), dir, "player", isLocal));
			
			//trace a line from the player to a block.
			var hitGridPos = level.trace(this, dir, blockToolRange);
			var isHit = level.isSolid(hitGridPos.x, hitGridPos.y);

			if (this.block === 0 && !isHit) {
				//miss
				Events.playSound("hitwall", this.pos.clone());
				var missPos = level.gridPosToPos(hitGridPos);
				Events.explosion(new BlockRemoveFx(dir, "fail", missPos));				
			} else {
				if (isHit && this.block === 1) {
					hitGridPos.moveInDir(dir.reverse, 1);
				}
				Events.playSound("pshoot", this.pos.clone());
				this.block = (this.block === 1 ? 0: 1);
				var hitPos = level.gridPosToPos(hitGridPos);
				Events.explosion(new BlockRemoveFx(dir, "break", hitPos));
				if (isLocal) {
					networkBreak(hitGridPos, dir);
				}
			}
		}

		this.hurt = function (hurtPos) {
			if (!this.live) return;
			this.live = false;
			deadTimer = maxDeadTime;
			hitPos = hurtPos.clampWithin(_this.pos, _this.size);
			deaths++;
			Events.playSound("pdead", null);
			//clear my spawn point
			Network.send({
				type:"clearspawn", 
				pos:level.posToGridPos(spawnPoint).toData()
			});
		}

		this.update = function (keys) {
			
			if (this.hidden) return;

			if (!this.live) {
				if (deadTimer === 0) {
					this.live = true;
					this.pos = spawnPoint.clone();
					this.state = "falling";
				} else {
					deadTimer--;
				}
				return;
			}

			if (this.isStuck()) {
				this.hurt(this.pos.clone());
			}

			this.collisions.forEach(function (other) {
				if (_this.live === false) return; //so we can't die twice in this loop
				if (other.killPlayerOnTouch) {
					_this.hurt(other.pos.clone());
				}
				if (other.isCheckpoint && other !== currentCheckpoint) {
					if (currentCheckpoint) currentCheckpoint.selected = false;
					spawnPoint = other.pos.clone();
					currentCheckpoint = other;
					currentCheckpoint.selected = true;
					Events.playSound("checkpoint", _this.pos.clone());
				}
				if (other.isEnd) {
					Events.winLevel();
				}
			});
			this.collisions.length = 0;

			if (this.loading > 0) this.loading--;

			if (keys.up && !keys.down) {
				this.vDir = Dir.UP;
			} else if (keys.down && !keys.up) {
				this.vDir = Dir.DOWN;
			} else {
				this.vDir = null;
			}

			if (keys.shoot && this.loading === 0) {
				this.loading = this.refireRate;
				this._shoot(true);
				this.shotThisFrame = true;
			} else {
				this.shotThisFrame = false;
			}

			if (keys.shoot) {
				shootingAnim = true;
				timeSinceLastShot = 0;
			} else {
				timeSinceLastShot++;
				if (timeSinceLastShot > 30) {
					shootingAnim = false;
					timeSinceLastShot = 30; //prevent overflow in binary
				}
			}

			var movingDir = null;
			if (keys.left && !keys.right) {
				this.dir = Dir.LEFT;
				movingDir = Dir.LEFT;
				this.tryMove(-1,0);
			} else if (keys.right && !keys.left) {
				this.dir = Dir.RIGHT;
				movingDir = Dir.RIGHT;
				this.tryMove(1,0);
			}

			//If you hit jump and hold it down, that hit gets queued.
			if (keys.jumpIsHit) {
				jumpIsQueued = true;
			} else {
				jumpIsQueued = jumpIsQueued && keys.jumpIsHeld;
			}

			getState().preupdate.call(this);

			getState().update.call(this, keys.jumpIsHeld);

			if (this.isOnGround() || this.pos.y > this.groundedY) {
				this.groundedY = this.pos.y;
			}

			if (this.state  === "grounded") {
				if (movingDir === null) {
					animState = "standing";
				} else {
					animState = "running";					
				}
			}

			if (animState !== "running") {
				animDelay = 0;
				animFrame = 3; //first frame when we start running after landing\standing still
			} else {
				animDelay++;
				if (animDelay >= 5) {
					animDelay = 0;
					animFrame++;
					if (animFrame === 4) animFrame = 0;
				}
			}
		}

		var getState = function () {
			return states[_this.state];
		}

		this.getDeaths = function () {
			return deaths;
		}

	}
	return Player;
});