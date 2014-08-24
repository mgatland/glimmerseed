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
var monsterHost = null;

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

function electMonsterHost () {
    for (var i = 0; i < users.length; i++) {
        if (users[i].isReal()) {
            monsterHost = users[i];
            users[i].socket.emit("data", 
                {type:"monsterHost"});
            return;
        }
    }
}

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

        if (data.type === "mon") {
            user.socket.broadcast.emit("data", data);
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

        if (monsterHost === null) {
            electMonsterHost();
        }
    };

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

        if (user === monsterHost) {
            monsterHost = null;
            electMonsterHost();
        }
    });

    function parseIntOrZero(string) {
        var num = parseInt(string, 10);
        if (isNaN(num)) return 0;
        return num;
    }

    function sendServerMessage(emitter, message) {
        emitter.emit('data', { type: 'servermessage', data: { text: message }});
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