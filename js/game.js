"use strict";
require(["events", "colors", "network", "bridge", "playingstate",
	"titlestate", "endlevelstate", "camera", "audio", 
	"loadinglevelstate"], 
	function(Events, Colors, Network, Bridge, PlayingState,
		TitleState, EndLevelState, Camera, Audio, LoadingLevelState) {
	var initGame = function () {

		var state = new TitleState();

		var onData = function (data) {
			if (state.gotData) {
				var accepted = state.gotData(data);
				//Hacks: replay unaccepted messages
				if (!accepted) {
					console.log("Message must be replayed: " + data.type);
					window.setTimeout(function () {
						onData(data)
					}, 64);
				}
			} else {
				console.log("Got data but game is not running.");
			}
		};

		Network.connectToServer(onData);

		var update = function(keyboard) {

			if (state.transition === true) {
				if (state.endStats) {
					state = new EndLevelState(state.endStats);
				} else {
					if (state.levelData) {
						var levelData = state.levelData;
						state = new PlayingState(Events, camera, levelData);		
					} else {
						state = new LoadingLevelState();
					}
					
				}
			}

			var keys = {};
			keys.left = keyboard.isKeyDown(KeyEvent.DOM_VK_LEFT);
			keys.right = keyboard.isKeyDown(KeyEvent.DOM_VK_RIGHT);
			keys.up = keyboard.isKeyDown(KeyEvent.DOM_VK_UP);
			keys.down = keyboard.isKeyDown(KeyEvent.DOM_VK_DOWN);
			keys.jumpIsHeld = keyboard.isKeyDown(KeyEvent.DOM_VK_X);
			keys.jumpIsHit = keyboard.isKeyHit(KeyEvent.DOM_VK_X);

			keys.shoot = keyboard.isKeyDown(KeyEvent.DOM_VK_Y) || keyboard.isKeyDown(KeyEvent.DOM_VK_Z);
			keys.shootHit = keyboard.isKeyHit(KeyEvent.DOM_VK_Y) || keyboard.isKeyHit(KeyEvent.DOM_VK_Z);

			keys.start = keyboard.isKeyHit(KeyEvent.DOM_VK_ENTER) || keyboard.isKeyDown(KeyEvent.DOM_VK_RETURN) || keyboard.isKeyHit(KeyEvent.DOM_VK_SPACE);
			keys.esc = keyboard.isKeyHit(KeyEvent.DOM_VK_ESCAPE);

			state.update(keys, Network, Events);
		}

		var draw = function (painter, touch) {
			painter.clear();

			state.draw(painter);
			if (state.showTouchButtons) {
				touch.draw(painter);
			}
		};

		var updateAudio = function (audio, painter) {
			Events.sounds.forEach(function (sound) {
				if (sound.pos === null || painter.isOnScreen(sound.pos.x, sound.pos.y, 10, 10)) {
					audio.play(sound.name);
				}
			});
			Events.sounds.length = 0;
			audio.update();
		}

		var pixelWindow = {width:192, height:104}; //I could fit 200 x 120 on Galaxy s3 at 4x pixel scale
		var camera = new Camera(pixelWindow);
		var scale = 4;

		var desiredFps = 60;

		var bridge = new Bridge(pixelWindow, scale, desiredFps);
		var touch = bridge.createTouch();
		var keyboard = bridge.createKeyboard(touch);
		var painter = bridge.createPainter();
		var levelEditor = null;

		var bridgeUpdate = function () {

			if (levelEditor && state.getLevel) {
				levelEditor.setLevel(state.getLevel());
				levelEditor.update(keyboard);
			}

			if (!levelEditor && keyboard.isKeyDown(KeyEvent.DOM_VK_E) &&
				keyboard.isKeyDown(KeyEvent.DOM_VK_L)) {
				levelEditor = bridge.createLevelEditor(camera);
			}

			if (keyboard.isKeyHit(KeyEvent.DOM_VK_P)) {
				bridge.resetWorstStats();
			}
			update(keyboard, painter);
			keyboard.update();
		}
		var bridgeDraw = function () {
			draw(painter, touch);
			if (levelEditor) {
				levelEditor.draw(painter);
			}
			updateAudio(Audio, painter);
		}
		bridge.showGame(bridgeUpdate, bridgeDraw);
	}

	initGame();
});