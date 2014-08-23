"use strict";
define(["entity", "level", "camera", "Player"],
	function (Entity, Level, Camera, Player) {

	//TODO: Events is only passed in so we can access changes made
	//by the Level initialization. Let's change that, let level
	//push changes directly to the game state.
	var PlayingState = function (Events, camera, mapData) {
		this.showTouchButtons = true;

		var tileSize = 10;

		var level = new Level(mapData, tileSize);
		var netFramesToSkip = 0;
		var netFrame = netFramesToSkip;
		var ticks = 0;
		var tickDurationInSeconds = 1/60; //FIXME: derive from Framerate

		//todo: think about how level transitions are replicated
		var winTimer = 0;
		var maxWinTimer = 25;
		var winAnimationPlaying = false;
		var winStats = null;

		//game state:
		var gs = {
			shots: [],
			explosions: [],
			players: [],
			local: 0,
			monsters: []
		};

		function moveElementsTo(dest, source) {
			Array.prototype.push.apply(dest, source);
			source.length = 0;	
		}

		var processEvents = function (Events) {
			moveElementsTo(gs.shots, Events.shots);
			moveElementsTo(gs.monsters, Events.monsters);
			moveElementsTo(gs.explosions, Events.explosions);
			moveElementsTo(gs.players, Events.players);
		};

		var initialize = function () {
				//Hacks to make the player start on the ground
				//with the camera correctly positioned.
				gs.players[gs.local].tryMove(0, 10);
				gs.players[gs.local].groundedY = gs.players[gs.local].pos.y;
				camera.jumpTo(gs.players[gs.local].pos.x, gs.players[gs.local].groundedY);			
		};

		this.update = function (keys, Network, Events) {
			ticks++;
			processEvents(Events);

			//Process collisions
			//Shots collide with monsters and players
			gs.shots.forEach(function (shot) {
				if (shot.live === true) {
					if (shot.hitsMonsters === true) {
						gs.monsters.forEach(function (monster) {
							Entity.checkCollision(shot, monster);
						});
					} else {
						gs.players.forEach(function (player) {
							Entity.checkCollision(shot, player);
						});
					}
				}
			});
			//Enemies collide with players
			//(only notify the player)
			gs.players.forEach(function (p) {
				gs.monsters.forEach(function (monster) {
					Entity.checkCollision(p, monster, "firstOnly");
				});
			});

			gs.shots.forEach(function (shot) {shot.update();});
			gs.explosions.forEach(function (exp) {exp.update();});

			gs.local = 0;
			gs.players[gs.local].update(keys);

			if (netFrame === 0) {
				var playerData = gs.players[gs.local].toData();
				Network.send({type:"p", player:playerData});
				netFrame = netFramesToSkip;
			} else {
				netFrame--;
			}

			gs.monsters.forEach(function (monster) {
				monster.update();
			});

			camera.panTowards(gs.players[gs.local].pos.x, gs.players[gs.local].groundedY);

			if (Events.wonLevel && !winAnimationPlaying) {
				winAnimationPlaying = true;
				this.endStats = this.getStats();
				this.showTouchButtons = false;
			}
			if (winAnimationPlaying) {
				winTimer++;
				if (winTimer === maxWinTimer) {
					//FIXME: Events.wonLevel can leak into the next level
					//making you instantly win it. Currently to prevent it you
					//have to clear Events.wonLevel after all other updates
					//before transitioning to the next level.
					Events.wonLevel = false;
					this.transition = true;
				}
			}
		};

		this.draw = function (painter) {

			painter.setPos(camera.pos); //only needs to be set once per level

			var drawOne = function (x) { x.draw(painter);}			

			gs.monsters.forEach(drawOne);
			gs.players.forEach(drawOne);
			gs.shots.forEach(drawOne);
			gs.explosions.forEach(drawOne);
			level.draw(painter);

			if (winTimer > 0) {
				painter.drawWinTransition(winTimer/maxWinTimer);
			}
		};

		var getIndexOfUser = function (users, id) {
			var index = null;
			users.forEach(function (user, i) {
				if (user.id === id) {
					index = i;
				}
			});
			if (index === null) {
				index = users.length;
				gs.players[index] = new Player(level, 0, 0);
			}
			return index;
		}

		this.gotData = function (data) {
			if (data.type === "p") {
				var index = getIndexOfUser(gs.players, data.player.id);
				gs.players[index].fromData(data.player);
				if (gs.players[index].shotThisFrame) gs.players[index]._shoot();
			} else if (data.type === "break") {
				var pos = data.pos;
				this.getLevel().setCell(pos.x, pos.y, 0);
			} else {
				console.log("Weird data: ", data);
			}
			return true; //always
		};

		this.getStats = function () {
			return {
				deaths: gs.players[gs.local].getDeaths(),
				time: ticks * tickDurationInSeconds,
				mercy: gs.monsters.filter(
					function (f) {return f.live && f.killIsCounted;}
					).length
			};
		}

		//for level editor only
		this.getLevel = function () {
			return level;
		}

		processEvents(Events);
		initialize();
	};

	return PlayingState;
});