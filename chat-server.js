// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

process.title = 'node-chat';
var express = require("express");
var app = express();
var port = process.env.PORT || 80;
var io = require('socket.io').listen(app.listen(port));
console.log("listening on port " + port);

var shared = require('./shared/shared');


//fixme

  var mapData = [];
mapData[0] =
"OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO\n" +
"OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO   x                      O           O\n" +
"O !    m      O ! O m O m O   O   x !                    O           O\n" +
"O OOO OOO OOO O O O O O O O O O OOOOOOOOOOOOOOOO  OOO  OOO    @      O\n" +
"O OOO OOO OOO k O m O   O   O   OOOO                   OOO    OO     O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO                  OOOO    OO  m  O\n" +
"O O                                O               m OOOOO        OO O\n" +
"O O                                            OOOOOOOOOOO     m  OO O\n" +
"O O                    ! O    m       ! OO  k  O              OO     O\n" +
"O Op  !  OOO OO  k    OOOO    OOO    OOOOOOOOOOO          m   OO     O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOO OOO  k OOOOOOOOOOO         OO          O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO      m  OO   !      O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO     OO      OO      O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO   m OO      OO      O\n" +
"O OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO  OO                 O\n" +
"O  !                 O       x mm            !    OO                 O\n" +
"O  O   m O  m O  k O !       x OO           OOOOOOOOOOOOOOOOOOOOOOOOOO\n" +
"O  OOOOOOOOOOOOOOOOOOO    OOOO OO OOOO OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO\n" +
"OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO\n" +
"";

function loadMap(mapData) {
    var map = {};
    map.map = [];
    map.spawners = [];
    var n = 0;
    var x = 0;
    var y = 0;
    map.map[y] = [];
    while (mapData[n]) {
        if (mapData[n]==="O") {
            map.map[y][x] = 1;
            x++;
        } else if (mapData[n]===" ") {
            map.map[y][x] = 0;
            x++;
        } else if (mapData[n] === "\n") {
            x = 0;
            y++;
            map.map[y] = [];
        } else {
            map.map[y][x] = 0;
            map.spawners.push({x:x, y:y, type:mapData[n]});
            x++;
        }
        n++;
    }
    return map;
}
var level = loadMap(mapData[0]);

var setCell = function(x, y, value) {
    if (!level.map[y]) {
        level.map[y] = [];
    }
    level.map[y][x] = value;
}
//end of fixme level hacks

//consts
var moveDelay = 1000/4;

//globals
var history = [ ]; //totally unused
var users = [ ];
var lurkers = [ ];

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var echoMap = new shared.Pos(11,11);

var colors = [  //in order of attractiveness
    '#fff8bc', //white
    '#dda0dd', //light pink
    '#ffa500',  //orange
    '#8effc1', //light green
    '#ff0000', //red
    '#2badff', //blue
    '#008000', //green
    '#800080', //maroon
    '#ff00ff', //bright pink
    '#7f3300' // brown
    ];

var unusedColors = colors.slice(0);

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.use("/client", express.static(__dirname + '/client'));
app.use("/shared", express.static(__dirname + '/shared'));
app.use("/js", express.static(__dirname + '/js'));
app.use("/sounds", express.static(__dirname + '/sounds'));
app.use("/css", express.static(__dirname + '/css'));

io.set('log level', 1); // reduce logging

/*//Force xhr-polling, this means no websockets (because appfog doesn't support websockets)
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});*/

var lastId = 0;
function nextId () {
    return lastId++;
}

io.sockets.on('connection', function (socket) {

    var user = {};
    user.id = nextId();
    user.socket = socket;
    user.pos = null;
    user.name = false;
    user.color = false;
    user.moved = false;
    user.act = false;
    user.queuedMoves = [];
    user.map = null;
    user.diveMoves = 0;
    user.brick = 0;
    user.secrets = {}; //not replicated
    user.isReal = function() {
        return !(this.name === false);
    }
    lurkers.push(user);
 
    console.log(getTimestamp() + ' Connection accepted. ' + lurkers.length + " lurkers.");

    var cursedMessages = ["woof woof!", "i'm so happy!", "hey everyone i found a secret", "meet me by the fountain", "dinosaur rawr!"];

    socket.on('data', function (data) {
        //console.log(data);
        if (data.type === "login") {
            logIn(data.name);
        }
        //player update
        if (data.type === "p") {
            var p = data.player;
            user.netUser = p;
            //add id to the net data.
            p.id = user.id;
            //broadcast on to other players
            user.socket.broadcast.emit("data", data);
        }

        if (data.type === "ping") {
            user.socket.emit("data", {type:"pong", num:data.num});
        }

        if (data.type === "break") {

            var pos = data.pos;
            var dir = data.dir;

            //broadcast to all players including sender
            if (user.brick === 0) {
                io.sockets.emit("data", {
                type:"break",
                pos: pos});
                user.brick = 1;
                //and apply to server
                setCell(pos.x, pos.y, 0);
            } else {
                if (dir === 3) pos.x--;
                if (dir === 2) pos.x++;
                if (dir === 1) pos.y--;
                if (dir === 0) pos.y++;
                console.log(dir);
                io.sockets.emit("data", {
                type:"lay",
                pos: pos});
                setCell(pos.x, pos.y, 1);
                user.brick = 0;
            }

            //TODO: obviously not everyone needs this.
            //TODO: Update the server's copy of the map.
            
        }
    });

    socket.on('sendchat', function (data) {
        var cursed = user.item === "curse";
        data = data.toLowerCase();
        console.log(getTimestamp() + ' > '
                    + user.name + ': ' + data + (cursed ? " (CURSED)" : ""));

        if (cursed) {
            data = cursedMessages[Math.floor(Math.random()*cursedMessages.length)];
        }

        var obj = makeChatObject(user.name, user.color, data, user.map);
        addMessage(obj);

        if (data === "quack" || data === "dive" || data === "nap") {
            user.socket.emit('data', { type: 'servermessage', data: { text: 'Try putting a slash in front like this: /' + data} });
        }
    });

    function logIn(username){
        if (user.isReal()) {
            return;
        }

        username = htmlEntities(username).toLowerCase();

        if (username.length > 10) {
            username = username.substring(0,8) + "~1";
        }

        //prevent duplicate usernames.
        while (shared.getIndexOfUser(username, users) !== null) {
            console.log("duplicate username " + username);
            var num = parseInt(username.slice(-1), 10);
            //if it has a number, increment it
            if (isNaN(num)) {
                username = username.substring(0,8) + "~1";
            } else if (num === 9) {
                //just give up and let it get longer.
                username = "_" + username;
            } else {
                username = username.slice(0, -1) + (num + 1);
            }
        }

        console.log("setting name: " + username);
        user.name = username;

        if (unusedColors.length === 0) {
            //This allows duplicate colors for ever, but I don't mind.
            //ideally we would issue a random color from the set of "least used colors"
            //which means maintaining a use-count for each color
            unusedColors = colors.slice(0);
        }
        user.color = unusedColors.shift();
        
        users.push(user);
        var index = shared.getIndexOfUser(user.name, lurkers);
        lurkers.splice(index, 1);

        user.socket.emit('data', { type: 'loggedin', data: { name: user.name, color: user.color, id: user.id } });
        user.socket.emit('data', { type: 'level', level: level });

        var netUser = getNetUser(user);
        broadcast('playerUpdate', netUser);
    };

    socket.on('cmd', processCommand);

    socket.on('disconnect', function(){
        console.log(getTimestamp() + " Peer "
            + user.name + " disconnected.");
        if (user.isReal()) {
            unusedColors.push(user.color);
            sendServerMessage(socket.broadcast, user.name + ' disappeared.');
            socket.broadcast.emit('data', { type: 'playerleaves', data: user.name });
            var index = shared.getIndexOfUser(user.name, users);
            console.log("removing user " + user.name);
            users.splice(index, 1);
        } else {
            var index = shared.getIndexOfUser(user.name, lurkers);
            lurkers.splice(index, 1);
            console.log("Removed a lurker, " + lurkers.length + " remain.");
        }
    });

    function parseIntOrZero(string) {
        var num = parseInt(string, 10);
        if (isNaN(num)) return 0;
        return num;
    }

    function processCommand(message) {
        var fullMessage = message;
        message = message.toLowerCase();
        //remove everything after a space
        if (message.indexOf(" ") !== -1) {
            message = message.substring(0, message.indexOf(" "));
        }
        if (!user.isReal()) {
            return;
        }
        if (user.moved === true) {
            user.queuedMoves.push(message);
            if (user.queuedMoves.length > 1) {
                console.log("move queue: " + user.queuedMoves.length);
            }
            return;
        }

        var netUpdate = false;
        var moved = false;

        if (user.name === "pi") {
            var args = fullMessage.split(" ");
            switch (message) {
                case 'map':
                    user.map.x = parseIntOrZero(args[1]);
                    user.map.y = parseIntOrZero(args[2]);
                    netUpdate = true;
                    moved = true;
                    break;
                case 'go':
                    user.pos.x = parseIntOrZero(args[1]);
                    user.pos.y = parseIntOrZero(args[2]);
                    netUpdate = true;
                    moved = true;
                    break;
                case 'info':
                    sendServerMessage(user.socket, "At " + user.map.x + "," + user.map.y);             
            }
        }

        switch (message) {
            case 'east':
                netUpdate = moveDuck(1,0);
                moved = true;
                break;
            case 'west':
                netUpdate = moveDuck(-1,0);
                moved = true;
                break;
            case 'north':
                netUpdate = moveDuck(0,-1);
                moved = true;
                break;
            case 'south':
                netUpdate = moveDuck(0,1);
                moved = true;
                break;
            case 'wilberforce':
                netUpdate = true;
                moved = true;
                user.map.x = 10;
                user.map.y = 8;
                user.pos.x = 5;
                user.pos.y = 5;
                user.item = "curse";
                sendServerMessage(user.socket, "You feel strange");
                break;
            case 'quack':
                if (user.diveMoves > 0) {
                    var quackObj = makeChatObject(user.name, user.color, "glub glub glub", user.map);
                    addMessage(quackObj);
                } else {
                    netUpdate = moveDuck(0,0,'quack');
                    var quackObj = makeChatObject(user.name, user.color, "QUACK!", user.map);
                    addMessage(quackObj);
                    if (shared.posAreEqual(user.map, echoMap)) {
                        //there's an echo one second later.
                        setTimeout(function () {
                            var echoObj = makeChatObject("echo", "#660066", "QUACK!", echoMap);
                            addMessage(echoObj);
                        }, 1000);
                    }
                }
                break;
            case 'dive':
                if (user.diveMoves > 0 && shared.canSurface(user)) {
                    netUpdate = moveDuck(0,0);
                    if (netUpdate) {
                        user.diveMoves = 0;
                    }
                } else if (shared.isSwimming(user)) {
                    netUpdate = moveDuck(0,0);
                    if (netUpdate) {
                        user.diveMoves = 4;
                    }
                } else {
                    sendServerMessage(user.socket, "You can't dive right now.");
                }
                break;
            case 'sleep':
            case 'nap':
                if (user.diveMoves > 0) {
                    sendServerMessage(user.socket, "You can't nap underwater.");
                } else {
                    netUpdate = moveDuck(0,0,'nap');
                }
                break;
            case 'look':
                var lookFind = lookForStuff(user);
                if (lookFind) {
                    sendServerMessage(user.socket, lookFind.message);
                    if (lookFind.item) {
                        if (user.item === "curse" && lookFind.item === "red apple") {
                            sendServerMessage(user.socket, "You eat it and feel better!");
                            user.item = null;
                            user.secrets.curseGiver = null;
                            netUpdate = true;
                        } else if (user.item === "curse") {
                            sendServerMessage(user.socket, "You feel too strange to take it.");
                        } else if (user.item === lookFind.item) {
                            sendServerMessage(user.socket, "You already have that.");
                        } else if (user.item) {
                            sendServerMessage(user.socket, "You need to /drop your " + user.item + " first.");
                        } else {
                            user.item = lookFind.item;
                            netUpdate = true;
                        }
                    }
                } else {
                    sendServerMessage(user.socket, "You find nothing.");
                }
                break;
            case 'drop':
                if (user.item === "curse") {
                    sendServerMessage(user.socket, "You have nothing to drop.");
                } else if (user.item) {
                    sendServerMessage(user.socket, "You drop " + user.item);
                    user.item = null;
                    netUpdate = true;
                } else {
                    sendServerMessage(user.socket, "You have nothing to drop.");
                }
                break;
        }
        if (moved === true) {
            if (shared.isUserOnNote(user)) {
                displayNoteFor(user);
            }
            if (shared.isUserBelowNPC(user)) {
                displayNPCMessageFor(user);
                netUpdate = true; //Only because user inventory might change.
            }
            var noteCode = shared.getMapNoteForUser(user);
            if (noteCode !== null) {
                sendServerMessage(user.socket, getMapNote(noteCode));
            }
            if (user.item === "curse") {
                netUpdate = tryLoseCurse(user) || netUpdate;
            }
        }
        if (netUpdate === true) {
            var netUser = getNetUser(user);
            broadcast('playerUpdate', netUser);
            setTimeout(clearMove, moveDelay);           
        }
    }

    //return true if requires network update
    function tryLoseCurse (user) {
        var usersUnderMe = users.filter(function (other) {
            return (other !== user
                && shared.posAreEqual(user.map, other.map)
                && shared.posAreEqual(user.pos, other.pos));
        });
        if (usersUnderMe.length > 0) {
            var other = usersUnderMe.pop();
            if (other.item === 'curse') {
                return false;
            }
            if (user.secrets.curseGiver === other.name) {
                sendServerMessage(user.socket, "Can't give the curse back.");
                return false;
            }
            user.item = null;
            other.item = "curse";
            other.secrets.curseGiver = user.name;
            var otherNetUser = getNetUser(other);
            broadcast('playerUpdate', otherNetUser);
            sendServerMessage(other.socket, user.name + " put a curse on you :(");
            sendServerMessage(user.socket, "You put the curse on " + other.name);
            console.log(user.name + " cursed " + other.name);
            return true;
        }
        return false;
    }

    var mapNotes = [];
    mapNotes["crypt1"] = "CROWN OF DUCK PRINCE";
    mapNotes["crypt2"] = "CUTSMITH THE SWORD";
    mapNotes["crypt3"] = "SHOE OF LONGEST JOURNEY";
    mapNotes["crypt4"] = "(IT'S BLANK)";
    mapNotes["crypt5"] = "LUSTROUS EARRINGS";
    mapNotes["crypt6"] = "LARGE TOMATO";
    mapNotes["crypt7"] = "RING OF HOLDING";
    mapNotes["crypt8"] = "RARE COMIC BOOKS";
    mapNotes["cryptEntrance"] = "The treasures are missing";
    mapNotes["statue1"] = "KING WALFRED DUCK I 107-143";
    mapNotes["statue2"] = "KING WALFRED DUCK II 128-202";
    mapNotes["statue3"] = "QUEEN PERSIMMON I 152-221";
    mapNotes["statue4"] = "MAYOR ROLLYDUCK WHO SOLVED THE INK CRISIS";
    mapNotes["statue5"] = "THE STRANGEST DUCK WHO SAVED US ALL";
    mapNotes["statue6"] = "ANNA DUCK WHO CURED THE DUCK PLAGUE";
    mapNotes["statue7"] = "THE LOST BROTHERS WE WILL NOT FORGET";

    function getMapNote(code) {
        return mapNotes[code];
    }


    function lookForStuff(user) {
        if (shared.posIsAt(user.map, 10, 10)) {
            return {message: "You found some dirt.", item: "dirt"};
        }
        if (shared.posIsAt(user.map, 11, 11)) {
            return {message: "You found a violin.", item: "violin"};
        }
        if (shared.posIsAt(user.map, 9, 12)) {
            return {message: "You found a red apple.", item: "red apple"};
        }
        if (shared.posIsAt(user.map, 9, 10)) {
            return {message: "The chest is locked. From the inside?"};
        }
        if (shared.posIsAt(user.map, 12, 12)) {
            return {message: "You catch a forest lizard.", item: "lizard"};
        }
    }

    var notes = {};
    notes['9:10'] = "Feeling sleepy? Take a /nap"; 
    notes['11:10'] = "Type /quack to quack!";
    notes['9:11'] = "It's hot here! A /dive would be nice.";

    //max 15 characters * 3 lines
    //123456789012345\n123456789012345\n123456789012345
    var npc = {};
    npc["13:10"] = function (user) {
        if (user.item === "violin") {
            user.item = null;
            user.secrets.gaveViolin = true;
            return "MY VIOLIN!\nA GIFT FROM THE\nLOST BROTHERS";
        } else if (user.item === "curse") {
            return "YOU ARE CURSED\nYOU NEED APPLE\nCAN YOU SWIM?";
        } else if (user.item === "dirt") {
            return "THE TOWN HALL\nWAS ONCE CLEAN\nAND GRAND";
        } else if (user.item === "lizard") {
            return "IS THAT A\nDELICIOUS\nLIZARD?";
        } else if (user.item === "red apple") {
            return "MY HUSBAND USED\nTO LOVE APPLES\nHE IS GONE NOW";
        } else if (user.secrets.gaveViolin) {
            return "THERE ARE MANY\nSECRETS TO FIND\nIN DUCKTOWN."
        } else {
            return "PLEASE LOOK FOR\nMY VIOLIN ITS\nBY SOME ROCKS"
        }
    }
    npc["0:1"] = function (user, users) {

        if (user.item === "curse") {
            return "DON'T TOUCH ME\nYOU HAVE CURSE\nFACE";
        }

        if (user.item === "dirt" && !user.secrets.gaveDirt) {
            user.item = null;
            user.secrets.gaveDirt = true;
            return "THANK YOU FOR\nTHE DIRT NOW\nI'll SHARE MINE"
        }

        if (!user.secrets.gaveDirt) {
            return "BRING ME SOME\nDIRT AND I WILL\nTELL ALL";
        }

        var roomsWithUsers = [];
        var gossips = [];
        users.forEach(function (other) {
            if (other === user) return; //no self-gossip
            if (other.item === "curse") {
                gossips.push(other.name + "\nis cursed!");
            }
            if (other.item === "red apple") {
                gossips.push(other.name + " \nhas a red apple!");
            }
            var room = other.map.x + other.map.y * 100;
            if (roomsWithUsers[room] === undefined) {
                roomsWithUsers[room] = [];
            }
            roomsWithUsers[room].push(other.name);
        });
        //Find people alone together.
        roomsWithUsers.forEach(function (names) {
            console.log("Room " + names);
            if (names.length === 2) {
                gossips.push(names[0] + " and\n" 
                    + names[1] + " are\nalone together!");
            }
        });
        if (gossips.length === 0) {
            if (users.length === 1) {
                return "YOU ARE THE\nONLY DUCK IN\nTOWN"
            } else {
                return "I have no\nstories now"
            }
        }
        gossips.forEach(function (gos) {
            console.log(gos);
        });
        return gossips[Math.floor(Math.random()*gossips.length)];
    }

    function sendServerMessage(emitter, message) {
        emitter.emit('data', { type: 'servermessage', data: { text: message }});
    }

    function sendNPCMessage(emitter, message) {
        emitter.emit('data', { type: 'npc', data: { text: message }});
    }

    function displayNoteFor (user) {
        var note = notes[user.map.x + ":" + user.map.y];
        if (note) {
            sendServerMessage(user.socket, note);
        } else {
            console.log("Error: User found a missing note at map " + user.map.x + ":" + user.map.y);
        }
    }

    function displayNPCMessageFor (user) {
        var npcMessage = npc[user.map.x + ":" + user.map.y](user, users);
        if (npcMessage) {
            sendNPCMessage(user.socket, npcMessage);
        } else {
            console.log("Error: User found a glitched NPC at map " + user.map.x + ":" + user.map.y);
        }
    }

    function moveDuck(x, y, act) {
        act = typeof act !== 'undefined' ? act : false; //default arguments
        user.moved = true;
        shared.move(user, x, y);
        user.act = act;
        return true;
    }

    function clearMove() {
        user.moved = false;
        if (user.queuedMoves.length > 0) {
            var oldMove = user.queuedMoves.shift();
            processCommand(oldMove);
        }
    }

});

function sendNetUsersTo(socket) {
    var state = getAllNetUsers();
    var datagram = { type:'state', data: state };
    socket.emit("data", datagram);
};

function getAllNetUsers() {
    var state = {};
    state.users = users.map( getNetUser );
    return state;
}

function getNetUser (user) {
        return user.netUser;
    }

var ackData = {};
ackData.type = "ack";
var ackJson = JSON.stringify(ackData);

function ack(user) {
    user.connection.sendUTF(ackJson);
}

function broadcast(type, data) {
    // broadcast message to all connected users
    var datagram = { type:type, data: data };
    for (var i=0; i < users.length; i++) {
        users[i].socket.emit('data', datagram);
    }

    for (var i=0; i < lurkers.length; i++) {
        lurkers[i].socket.emit('data', datagram);
    }
}

function addMessage(chatObj) {
    history.push(chatObj);
    history = history.slice(-100);

    var data = {};
    data.messages = [];
    data.messages.push(chatObj);

    var datagram = { type:"messages", data: data };

    users.forEach(function (usr) {
        /*var distance = chatObj.map ? shared.distanceBetweenPos(usr.map, chatObj.map) : 0;
        if (distance < 2) {
            usr.socket.emit('data', datagram);    
        }*/
    });

    lurkers.forEach(function (usr) {
        /*var distance = chatObj.map ? shared.distanceBetweenPos(shared.startingPos(), chatObj.map) : 0;
        if (distance < 2) {
            usr.socket.emit('data', datagram);
        }*/
    });
}

function makeChatObject(name, color, message, map) {
    var obj = {
        text: htmlEntities(message),
        author: name,
        color: color,
        map: map
    };
    return obj;
}

//convert single digit numbers to two digits
function d2(num) {
    if (num < 10) {
        return "0" + num
    }
    return "" + num;
}

function getTimestamp() {
    var d = new Date();
    return d.getFullYear() + "-" + d2(d.getMonth()) + "-" + d.getDate() + 
    " " + d2(d.getHours()) + ":" + d2(d.getMinutes()) + ":" + d2(d.getSeconds());
}