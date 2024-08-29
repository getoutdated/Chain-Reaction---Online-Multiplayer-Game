let express = require("express");
let app = express();
let socketio = require("socket.io");
let path = require("path");

let cache = {};
let roomDetails = {};

const port = process.env.PORT || 3000;
const expressServer = app.listen(port);
const io = socketio(expressServer);
const url = require("url");

app.use(express.static(path.join(__dirname, "client")));
app.use(express.urlencoded());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/client/home.html");
});

app.post("/createRoom", (req, res) => {
  let h = 8, w = 8;
  cache[req.body.roomName] = createSchema(req.body.numPlayers, h, w);

  return res.redirect(
    "/lobby?room=" +
      req.body.roomName +
      "&user=" +
      req.body.userName +
      "&size=" +
      req.body.numPlayers
  );
});

app.post("/joinRoom", (req, res) => {
  return res.redirect(
    "/lobby?room=" + req.body.roomName + "&user=" + req.body.userName
  );
});

app.get("/lobby", (req, res) => {
  res.sendFile(__dirname + "/client/lobby.html");
});

function createSchema(roomSize, h, w) {
  let arr = [];
  for (let i = 0; i < roomSize; i++) {
    arr.push(i);
  }

  return {
    playerQueue: [],
    users: {},
    roomSize: roomSize,
    globalIDs: arr,
    cntReady: 0,
    turns: 0,
    gameMatrix: initializeGrid(h, w),
    next_chance: 0,
    matrixSize: [h, w],
    gameBegun: false,
  };
}

io.of("/").on("connection", (socket) => {
  socket.on("subscribe", (data) => {
    socket.join(data.socketID); // join the sockets
    socket.join(data.room);

    let isPlayer, id;

    // if globalIDs is empty -> room is full, else grab a ID
    if (cache[data.room] === undefined) {
      console.log("Wrong Room");
      // send a custom event to redirect to "NOT FOUND PAGE"
      // use window.location.href = "/notFound"
    } else {
      // room is present

      if (cache[data.room]["globalIDs"].length !== 0) {
        // get a new ID for player
        isPlayer = true;
        id = cache[data.room]["globalIDs"].shift();

        // shifted room details in lobby
        // room details -> socketID = roomid
        roomDetails[data.socketID] = { room: data.room, playerID: id };

        cache[data.room].playerQueue.push(id);
        cache[data.room].users[id] = {
          socketID: data.socketID,
          counts: 0,
          username: data.username,
          readyStatus: false,
        };

        // send ID Number to the sockets.
        socket.emit("playerInfo", { id: id, d: cache[data.room] });

        // broadcasting new player info
        socket.broadcast.to(data.room).emit("newPlayerInfo", {
          id: id,
          isPlayer: isPlayer,
          username: data.username,
        });

      } else {
        console.log("room is full");
        isPlayer = false;
      }

    }
  });

  socket.on("playerStatus", (data) => {
    console.log(data, cache);

    cache[data.room].users[data.userID].readyStatus = data.status;
    io.sockets.in(data.room).emit("playerStatus", {
      status: data.status,
      id: data.userID,
    });

    if (data.status) cache[data.room].cntReady++;
    else cache[data.room].cntReady--;

    if (
      Object.keys(cache[data.room].users).length == cache[data.room].roomSize
    ) {
      console.log("All have arrived");

      if (cache[data.room].cntReady == cache[data.room].roomSize) {
        console.log("All are ready");

        cache[data.room].gameBegun = true;
        io.sockets.in(data.room).emit("gameStart", {
          users: cache[data.room].users,
        });

        send_chance(data.room, io);
        cache[data.room].turns++;
      } else console.log("Not All are ready");
    }
  });

  socket.on("gameInfo", (data) => {
    socket.to(data.room).emit("gameInfo", {
      playerClick: data.userClick,
      playerID: data.userID,
    });

    // upgrade the matrix in server - sole truth #Game Server
    updateGrid(data.userClick.X, data.userClick.Y, data.userID, data.room, io);

    send_chance(data.room, io);
    cache[data.room].turns++;
  });

  socket.on("messageSent", (data) => {
    io.sockets.in(data.room).emit("messageRecieved", {
      room: data.room,
      userID: data.userID,
      msg: data.msg,
      time: data.time,
      username: data.username,
    });
  });

  socket.on("sync_mat", (data) => {
    socket.emit("sync_mat", { gameMatrix: cache[data.room]["gameMatrix"] });
  });

  socket.on("disconnect", (data) => {
    console.log("disconnected", socket.id);

    let details = roomDetails[socket.id];
    console.log(details);

    if (details !== undefined) {
      let roomleft = details.room;
      // user comes in non existing-room, hence isnt added to that room
      let deleted_id = details.playerID;

      // add the id to globalIDs for new player to join;
      // [Harshit] but this must be done only before the game has begun, coz afterwards no one can join again
      if (!cache[roomleft].gameBegun)
        cache[roomleft]["globalIDs"].push(deleted_id);

      delete cache[roomleft]["users"][deleted_id];
      delete roomDetails[socket.id];

      console.log(details, cache[roomleft].users);
      // if all the players left, then delete the room
      if (Object.keys(cache[roomleft].users).length == 0) {
        delete cache[roomleft];

        console.log("Deleted Room: ", roomleft);

      } else {
        const index = cache[roomleft]["playerQueue"].indexOf(deleted_id);

        if (index > -1) {
          cache[roomleft]["playerQueue"].splice(index, 1);
        }

        socket.broadcast.to(roomleft).emit("playerLeft", {
          id: deleted_id,
        });

        // if the chance was of disconnected player, pass the chance
        if (socket.id === cache[roomleft]["next_chance"])
          send_chance(roomleft, io);
      }
    }
  });

  socket.on("reconnect", (data) => {
    console.log("reconnected", data);
  });
});

function initializeGrid(rows, columns) {
  let grid = new Array(rows + 2);
  for (var i = 0; i < grid.length; i++) {
    grid[i] = new Array(columns + 2);
  }

  /*
    i = cell value (0 default)
    j = cell color (-1 default -> blue)
  */

  for (var i = 0; i < grid.length; i++) {
    for (var j = 0; j < grid[0].length; j++) {
      grid[i][j] = [0, -1];
    }
  }

  for (var i = 0; i < rows + 2; i++) {
    grid[i][0][0] = -10000;
    grid[i][columns + 1][0] = -10000;
  }

  for (var i = 0; i < columns + 2; i++) {
    grid[0][i][0] = -10000;
    grid[rows + 1][i][0] = -10000;
  }

  return grid;
}

function updateGrid(X, Y, userID, roomName, io) {
  var queue = [];

  queue.push([X, Y]);
  cache[roomName]["gameMatrix"][X][Y][0]++; // initial move and then the consequences

  console.log(`${X}, ${Y} after initial move: `, cache[roomName]["gameMatrix"][X][Y][0]);

  var levelCount = 1; // atstart only one explodes
  var nextLevelCount = 0;

  console.log("Queue before starting", queue);

  while (queue.length !== 0) {

    console.log("Queue before loop ", queue, levelCount);
    for (var i = 0; i < levelCount; i++) {
      // cell at focus
      var curr = queue.shift();
      
      // if the index is out of visible boundaries
      if (
        curr[0] < 1 ||
        curr[0] > cache[roomName]["matrixSize"][0] - 2 ||
        curr[1] < 1 ||
        curr[1] > cache[roomName]["matrixSize"][1] - 2
      )
        continue;

      let lim = detLim(curr[0], curr[1], roomName);
      let prevUserID = cache[roomName]["gameMatrix"][curr[0]][curr[1]][1];
      let currVal = cache[roomName]["gameMatrix"][curr[0]][curr[1]][0];
      
      console.log(lim, prevUserID, currVal, userID);

      if (currVal <= lim) {
        // paying dues to the players
        if (prevUserID !== userID) {
          cache[roomName]["users"][userID].counts++;
          cache[roomName]["gameMatrix"][curr[0]][curr[1]][1] = userID;

          if (prevUserID !== -1) {
            cache[roomName]["users"][prevUserID].counts--;
            removeLoser(io, roomName, prevUserID);
          }
        }
      } else {
        // now's the problem

        if (currVal == lim+1) {
          cache[roomName]["gameMatrix"][curr[0]][curr[1]][1] = -1;
          cache[roomName]["gameMatrix"][curr[0]][curr[1]][0] = 0;
          // as it will leave a crater

          if (prevUserID !== -1) {
            cache[roomName]["users"][prevUserID].counts--;

            if (prevUserID !== userID) // special case
              removeLoser(io, roomName, prevUserID);
          } 
        } else {
          cache[roomName]["gameMatrix"][curr[0]][curr[1]][1] = userID;
          cache[roomName]["gameMatrix"][curr[0]][curr[1]][0] = currVal - (lim+1);
        
          if (prevUserID !== userID) {
            cache[roomName]["users"][prevUserID].counts--;
            cache[roomName]["users"][userID].counts++;
            removeLoser(io, roomName, prevUserID);
          }
        }

        for (var j = -1; j< 2; j++) {
          for (var k = -1; k< 2; k++) {
            if (Math.abs(j) == Math.abs(k))
              continue;

            console.log(j, k, cache[roomName]["gameMatrix"][curr[0]+j][curr[1]+k]);
            cache[roomName]["gameMatrix"][curr[0]+j][curr[1]+k][0]++;
            queue.push([curr[0]+j, curr[1] +k]);
            nextLevelCount++;
          }
        }
      }
    }

    levelCount = nextLevelCount;
    nextLevelCount = 0;
  }

  for (const [key, value] of Object.entries(cache[roomName]["users"])) {
    console.log(`${value.counts} is the count of ${key}\n`);
  }
}

function detLim(X, Y, roomName) {
  var h = cache[roomName]["matrixSize"][0], w = cache[roomName]["matrixSize"][1];

  if (X > 1 && X < h - 2 && Y > 1 && Y < w - 2) return 3;
  else if (
    [X, Y].equals([1, 1]) ||
    [X, Y].equals([1, w - 2]) ||
    [X, Y].equals([h - 2, 1]) ||
    [X, Y].equals([h - 2, w - 2])
  )
    return 1;
  else return 2;
}

function send_chance(roomName, io) {
  // Condition -
  // user has their chance, but due to some uncertainity, they disconnected.
  // How to then switch chance to next user ?
  // Implement a  `send_chance` function
  // everytime user disconnects, check if the player with chance got disconnected? Send chance to next user

  let next_chance = cache[roomName]["playerQueue"].shift();
  // cache[roomName]["next_chance"] = next_chance; 

  // if user hasn't disconnected push back into the queue

  // [Harshit] question: if the user has disconnected then what will come by providing him next chance
  // shouldn't we have to the next chance to the next available player

  /*
  if (cache[roomName].users[next_chance] !== undefined) {
    cache[roomName]["playerQueue"].push(next_chance);
  }*/

  // !!!! Also have to check for the case when only one player is left

  while (cache[roomName].users[next_chance] === undefined) {
    next_chance = cache[roomName]["playerQueue"].shift();
  }

  cache[roomName]["playerQueue"].push(next_chance);
  cache[roomName]["next_chance"] = next_chance;

  io.sockets.in(roomName).emit("isTurn", {
    userTurn: next_chance,
    numberOfTurns: cache[roomName]["turns"],
  });
}

function removeLoser(io, roomName, playerID) {
  if (cache[roomName]["users"][playerID].counts === 0) {
    // remove the player from playerQueue, send other users

    const index = cache[roomName]["playerQueue"].indexOf(playerID);
    if (index > -1) {
      cache[roomName]["playerQueue"].splice(index, 1);
    }

    io.sockets.in(roomName).emit("removeLoser", {
      userID: playerID,
      userName: cache[roomName]["users"][playerID]["username"],
    });

    console.log(cache[roomName]["playerQueue"].length);

    if (cache[roomName]["playerQueue"].length === 1) {
      io.sockets.in(roomName).emit("isWinner", {
        userID: cache[roomName]["playerQueue"][0],
      });
    }
  }
}








// Keep it in last
// Custom method to compare arrays +++++++++++++++++++++++++++++++++++++++++++++++++++

// Warn if overriding existing method
if (Array.prototype.equals)
  console.warn(
    "Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code."
  );
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
  // if the other array is a falsy value, return
  if (!array) return false;

  // compare lengths - can save a lot of time
  if (this.length != array.length) return false;

  for (var i = 0, l = this.length; i < l; i++) {
    // Check if we have nested arrays
    if (this[i] instanceof Array && array[i] instanceof Array) {
      // recurse into the nested arrays
      if (!this[i].equals(array[i])) return false;
    } else if (this[i] != array[i]) {
      // Warning - two different object instances will never be equal: {x:20} != {x:20}
      return false;
    }
  }
  return true;
};
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", { enumerable: false });
