var grid;
var gridSize = 8;
var numberOfTurns;

var colors = ["#04AA6D", "#F1705F", "#FF9B6A", "#CF92E1", "#014d6c", "#ffff00"];

export default {
  getOffset( el ) {
    var rect = el[0].getBoundingClientRect();

    return {
      left: rect.left + window.pageXOffset,
      top: rect.top + window.pageYOffset,
      width: rect.width || el.offsetWidth,
      height: rect.height || el.offsetHeight
    };
  },

  connect(div1, div2, id, color, thickness, RT=false, LB=false, update=false) { // for right bottom true both of them
    var off1 = this.getOffset(div1);
    var off2 = this.getOffset(div2);
    // bottom right
    var x1 = off1.left;
    var y1 = off1.top;
    // top right
    var x2 = off2.left;
    var y2 = off2.top;

    if (RT) {
      x1 += off1.width;
      x2 += off2.width;
    }

    if (LB) {
      y1 += off1.height;
      y2 += off2.height;
    }

    var length = Math.sqrt(((x2-x1) * (x2-x1)) + ((y2-y1) * (y2-y1)));
    var cx = ((x1 + x2) / 2) - (length / 2);
    var cy = ((y1 + y2) / 2) - (thickness / 2);
    var angle = Math.atan2((y1-y2),(x1-x2))*(180/Math.PI);

    if (update) {
      var selector = `.lineContainer .${id}`;
      $(selector).css({
        "left": `${cx}px`,
        "top": `${cy}px`,
        "width": `${length}px`,
        "-moz-transform" : "rotate(" + angle + "deg)",
        "-webkit-transform" : "rotate(" + angle + "deg)", 
        "-o-transform" : "rotate(" + angle + "deg)",
        "-ms-transform" : "rotate(" + angle + "deg)",
        "transform" : "rotate(" + angle + "deg)"
      })
    } else {
      var htmlLine = "<div class='" + id + "' style='padding:0px; margin:0px; height:" + thickness + "px; background-color:" + color + "; line-height:1px; position:absolute; left:" + cx + "px; top:" + cy + "px; width:" + length + "px; -moz-transform:rotate(" + angle + "deg); -webkit-transform:rotate(" + angle + "deg); -o-transform:rotate(" + angle + "deg); -ms-transform:rotate(" + angle + "deg); transform:rotate(" + angle + "deg);' />";
      $(".lineContainer").append(htmlLine);
    }
  },

  convertHex(hex, opacity) {
    hex = hex.replace('#','');
    var r = parseInt(hex.substring(0,2), 16);
    var g = parseInt(hex.substring(2,4), 16);
    var b = parseInt(hex.substring(4,6), 16);
    var result = 'rgba('+r+','+g+','+b+','+opacity+')';
    return result;
  },
  
  addPlayer(player) {
    console.log(player);

    $(`.playersList`).append(
      `<div id=${player.id} class="player">
          <div class="playerDp">
          </div>
          <div class="playerName">
            ${player.username}
          </div>
          <input type="checkbox" class="playerStatus">
        </div>` 
    );
    
    //$(`#${player.id}`).css('background', this.convertHex(colors[player.id], 0.5));
  },

  createLobby(users) {
    console.log("Create Lobby", users);

    for (const [key, value] of Object.entries(users)) {
      $(`.playersList`).append(
        `<div id=${key} class="player">
          <div class="playerDp">
          </div>
          <div class="playerName">
            ${value.username}
          </div>
          <input type="checkbox" class="playerStatus">
        </div>`
      );

      //$(`#${key}`).css('background', this.convertHex(colors[key], 0.5));
    }
  },

  removePlayer(id) {
    $(`#${id}`).remove();
  },

  announceText(nop, nopA) {
    $(".announceText").html(
      `${nop} player have joined!<br>${nopA} players are ready!`
    )
  },

  gameTimer(duration) {
    return new Promise((resolve) => {
      const timer = setInterval(function () {
        console.log(duration);
  
        if (duration == 0) {
          clearInterval(timer);
          resolve();
        }
  
        $(".announceText").html(`The game will begin in ... ${duration}`);
        duration--;
      }, 1000);
    });
  },

  addMessage(username, msg, time, id, flag) {
    let message;
    message = `
      <div class="message">
        <div class="sender">${username}</div>
        <div class="messageBody">${msg}</div>
        <div class="eta">${time}</div> 
      </div>
    `;

    let bgColor = this.convertHex(colors[id], 0.6);

    $(".messageContainer").append(message);
    $(".messageContainer").children().last().css({
      "background-color": `${bgColor}`
    })

    if (flag) {
      $(".messageContainer").children().last().addClass("flag");
    }
  },

  createGrid(x) {
    const dims = $(".gameArena")[0].getBoundingClientRect()
    const height = dims.height-50, width = dims.height-150;

    var h = parseInt(x[0]), w = parseInt(x[1]);
    grid = this.initializeGrid(h, w);
    var cnt = 0;

    for (var rows = 0; rows < h; rows++) {
      for (var columns = 0; columns < w; columns++) {
        $(".gameGrid.front").append(
          `<div class='grid f ${cnt}'></div>`
        );

        $(".gameGrid.back").append(
          `<div class='grid b ${cnt}'></div>`
        );

        cnt++;
      }
    }

    $(".gameArena").css({
      "justify-content": "center",
      "align-items": "center"
    });

    $(".gameGrid").width(width), $(".gameGrid").height(height);
    $(".grid").height(height / h - 0.5);
    $(".grid").width(width / w - 0.5);
    (numberOfTurns = 0);
    
    cnt = 0;
    let lineId = 0;
    for (var rows = 0; rows < h; rows++) {
      for (var columns = 0; columns < w; columns++) {
        var div1 = `.grid.f.${cnt}`, div2 = `.grid.b.${cnt}`;
        this.connect($(div1), $(div2), lineId, "white", 1);
        
        if (columns == w-1) {
          lineId++;
          this.connect($(div1), $(div2), lineId, "white", 1, true, false);
        }
        
        if (rows == h-1) {
          lineId++;
          this.connect($(div1), $(div2), lineId, "white", 1, false, true);
        }

        if (columns == w-1 && rows == h-1) {
          lineId++;
          this.connect($(div1), $(div2), lineId, "white", 1, true, true);
        }

        cnt++;
        lineId++;
      }
    }

    console.log("Grid Created");

    return grid;
  },

  // function that clears the grid
  clearGrid() {
    $(".grid").remove();
  },

  // initialize the grid variable
  initializeGrid(rows, columns) {
    grid = new Array(rows + 2);
    for (var i = 0; i < grid.length; i++) {
      grid[i] = new Array(columns + 2);
    }

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
  },

  syncGrid(serverMatrix) {
    // update the in-memory grid first
    for (var i = 0; i < grid.length; i++) {
      for (var j = 0; j < grid[0].length; j++) {
        grid[i][j] = serverMatrix[i][j];
      }
    }

    let ele, idx;

    for (var rows = 0; rows < grid.length - 2; rows++) {
      for (var columns = 0; columns < grid.length - 2; columns++) {
        idx = this.getIdx(rows+1, columns+1);
        ele = $(".grid.f").eq(idx);

        // ele.html(
        //   `${grid[rows + 1][columns + 1][0]}<sub class='sub'>(${rows + 1}, ${
        //     columns + 1
        //   })</sub>`
        // );

        if (grid[rows + 1][columns + 1][0] === 1) {
          ele.html(this.renderOne(colors[grid[rows + 1][columns + 1][1]]));
        } else if (grid[rows + 1][columns + 1][0] === 2) {
          ele.html(this.renderTwo(colors[grid[rows + 1][columns + 1][1]]));
        } else if (grid[rows + 1][columns + 1][0] === 3) {
          ele.html(this.renderThree(colors[grid[rows + 1][columns + 1][1]]));
        } else {
          ele.html("");
        }

        if (colors[grid[rows + 1][columns + 1][1]] == -1)
          ele.css("color", "#0000ff");
        else ele.css("color", colors[grid[rows + 1][columns + 1][1]]);
      }
    }
  },

  // function that prompts the user to select the number of boxes in a new grid
  // the function then also creates that new grid
  refreshGrid() {
    gridSize = prompt("How many boxes per side?");
    chance = true;
    this.clearGrid();
    this.createGrid(gridSize);
  },

  getCoords(idx) {
    var len = (grid[0].length-2);
    var row = Math.floor(idx / len) + 1;
    var col = (idx % len) + 1;
    return [row, col];
  },

  getIdx(X, Y) {
    return (grid[0].length - 2) * (X - 1) + Y - 1;
  },

  detLim(X, Y) {
    var h = grid.length, w = grid[0].length;
    console.log(X, Y, h, w);

    if (X > 1 && X < h - 2 && Y > 1 && Y < w - 2) return 3;
    else if (
      [X, Y].equals([1, 1]) ||
      [X, Y].equals([1, w - 2]) ||
      [X, Y].equals([h - 2, 1]) ||
      [X, Y].equals([h - 2, w - 2])
    )
      return 1;
    else return 2;
  },

  async explode(toPop, userID, lim) {
    for (var i = 0; i < toPop.length; i++) {
      var ele = toPop[i][0], val = toPop[i][1];

      ele.append(this.animate(colors[userID]));

      //await this.sleep(400);

      console.log(ele, val);
      
      if (val-lim === 2) {
        if (ele.children(".ball").length == 0) {
          ele
            .append(
              $.parseHTML(this.renderOne(colors[userID]))[0]
            );
        } else {
          ele.children(".ball")[0]
          .replaceWith(
            $.parseHTML(this.renderOne(colors[userID]))[0]
          );
        }
      } else if (val-lim === 3) {
        if (ele.children(".ball").length == 0) {
          ele
            .append(
              $.parseHTML(this.renderTwo(colors[userID]))[0]
            );
        } else {
          ele.children(".ball")[0]
          .replaceWith(
            $.parseHTML(this.renderTwo(colors[userID]))[0]
          );
        }
      } else if (val-lim === 4) {
        if (ele.children(".ball").length == 0) {
          ele
            .append(
              $.parseHTML(this.renderThree(colors[userID]))[0]
            );
        } else {
          ele.children(".ball")[0]
          .replaceWith(
            $.parseHTML(this.renderThree(colors[userID]))[0]
          );
        }
      } else {
        if (ele.children(".ball").length !== 0)
          ele.children(".ball")[0].replaceWith("");
      }
      
      // remove the elements after animation finishes
      $(".rm").bind(
        "animationend webkitAnimationEnd oAnimationEnd MSAnimationEnd",
        function () {
          $(this).remove();
        }
      );
    }
  },

  async updateGrid(X, Y, userID, nop) {
    var queue = [];

    queue.push([X, Y]);
    grid[X][Y][0]++; // initial move

    var levelCount = 1;
    var nextLevelCount = 0;
    var initialTurn = true;

    while (queue.length !== 0) {
      console.log("Queue in client: ", queue);
      var toPop = [];

      for (var i = 0; i< levelCount && queue.length !== 0; i++) {
        var curr = queue.shift();

        // checking if out of visible boundary
        if (
          curr[0] < 1 ||
          curr[0] > grid.length - 2 ||
          curr[1] < 1 ||
          curr[1] > grid[0].length - 2
        )
          continue;

        var idx = this.getIdx(curr[0], curr[1]),
          lim = this.detLim(curr[0], curr[1]),
          ele = $(".grid.f").eq(idx),
          currVal = grid[curr[0]][curr[1]][0];

        console.log(curr, idx, ele, lim, currVal, userID);
        ele.css("color", colors[userID]);

        if (currVal <= lim) {
          grid[curr[0]][curr[1]][1] = userID;

          if (grid[curr[0]][curr[1]][0] === 1) {
            if (ele.children(".ball").length == 0) {
              ele
                .append(
                  $.parseHTML(this.renderOne(colors[userID]))[0]
                );
            } else {
              ele.children(".ball")[0]
              .replaceWith(
                $.parseHTML(this.renderOne(colors[userID]))[0]
              );
            }
          } else if (grid[curr[0]][curr[1]][0] === 2) {
            if (ele.children(".ball").length == 0) {
              ele
                .append(
                  $.parseHTML(this.renderTwo(colors[userID]))[0]
                );
            } else {
              ele.children(".ball")[0]
              .replaceWith(
                $.parseHTML(this.renderTwo(colors[userID]))[0]
              );
            }
          } else if (grid[curr[0]][curr[1]][0] === 3) {
            if (ele.children(".ball").length == 0) {
              ele
                .append(
                  $.parseHTML(this.renderThree(colors[userID]))[0]
                );
            } else {
              ele.children(".ball")[0]
              .replaceWith(
                $.parseHTML(this.renderThree(colors[userID]))[0]
              );
            }
          } else {    
            if (ele.children(".ball").length !== 0)
              ele.children(".ball")[0].replaceWith("");
          }

        } else {
          // perform animation here
          toPop.push([ele, currVal]);
          grid[curr[0]][curr[1]][0] = currVal-(lim+1);

          if (currVal == lim+1)
            grid[curr[0]][curr[1]][1] = -1;
          else
            grid[curr[0]][curr[1]][1] = userID;

          for (var j = -1; j< 2; j++) {
            for (var k = -1; k< 2; k++) {
              if (Math.abs(j) == Math.abs(k))
                continue;
  
              grid[curr[0]+j][curr[1]+k][0]++;
              queue.push([curr[0]+j, curr[1]+k]);
              nextLevelCount++;
            }
          }
        }
      }

      console.log(toPop);
      levelCount = nextLevelCount;
      nextLevelCount++;

      initialTurn = false;

      this.explode(toPop, userID, lim);
      await this.sleep(2000);
    }

    $(`#${userID % nop}`).removeClass("chance");
    $(`#${(userID+1) % nop}`).addClass("chance");
  },

  renderOne(color) {
    return `<div class="ldng rotateSphere ball" style="background-color: ${color}"></div>`;
  },

  renderTwo(color) {
    return `<div class="div2b ball">
      <div class="ldng rotateSphere" style="background-color: ${color}"></div>
      <div class="ldng rotateSphere overlapHorizontal" style="background-color: ${color}"></div>
    </div>`;
  },

  renderThree(color) {
    return `<div class="div3b rotating-box ball">
      <div class="div2b">
        <div class="ldng rotateSphere" style="background-color: ${color}"></div>
        <div class="ldng rotateSphere overlapHorizontal" style="background-color: ${color}"></div>
      </div>
      <div class="ldng red rotateSphere overlapVertical" style="background-color: ${color}"></div>
    </div>`;
  },

  animate(color) {
    return `<div class="ldng rotateSphere rt-up rm" style="position: absolute;background-color: ${color}"></div>
    <div class="ldng rotateSphere rt-down rm" style="position: absolute;background-color: ${color}"></div>
    <div class="ldng rotateSphere rt-left rm" style="position: absolute;background-color: ${color}"></div>
    <div class="ldng rotateSphere rt-right rm" style="position: absolute;background-color: ${color}"></div>`;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
