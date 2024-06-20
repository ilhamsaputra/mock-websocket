const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
let wss;

let serverStarted = false;

app.post('/start-server', (req, res) => {
  if (!serverStarted) {
    wss = new WebSocket.Server({ server });
    setupWebSocketServer(wss);
    serverStarted = true;
    res.json({ message: 'WebSocket server started.' });
  } else {
    res.json({ message: 'WebSocket server is already running.' });
  }
});

app.post('/stop-server', (req, res) => {
  if (serverStarted) {
    wss.close(() => {
      serverStarted = false;
      res.json({ message: 'WebSocket server stopped.' });
    });
  } else {
    res.json({ message: 'WebSocket server is not running.' });
  }
});

function setupWebSocketServer(wss) {
  let symbol = 'BBCA';
  let intervalTime = 1000;
  let totalDataSent = 10;

  const rooms = {};

  var orderbookIntervalId = null;
  var runningTradeIntervalId = null;

  wss.on('connection', function connection(ws, req) {
    const roomID = req.url.replace('/', '');
    console.log(`Client connected to room: ${roomID}`);

    if (!rooms[roomID]) {
      rooms[roomID] = { clients: [] };
    }
    rooms[roomID].clients.push(ws);

    ws.on('message', function incoming(message) {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'config') {
          symbol = msg.symbol || symbol;
          intervalTime = msg.intervalTime || intervalTime;
          totalDataSent = msg.totalDataSent || totalDataSent;
          console.log(`Configuration updated: symbol=${symbol}, intervalTime=${intervalTime}, totalDataSent=${totalDataSent}`);
        } else {
          handleClientMessage(roomID, message);
        }
      } catch (err) {
        handleClientMessage(roomID, message);
      }
    });

    ws.on('close', function close() {
      console.log('Client disconnected');
      if (rooms[roomID]) {
        rooms[roomID].clients.splice(rooms[roomID].clients.indexOf(ws), 1);
        if (rooms[roomID].clients.length === 0) {
          delete rooms[roomID];
        }
      }
    });
  });

  function handleClientMessage(roomID, message) {
    console.log('received:', message);
    if (rooms[roomID]) {
      rooms[roomID].clients.forEach(client => {
        if (message == 'start_orderbook') {
          runOrderbook(client);
        } else if (message == 'start_running_trade') {
          runRunningTrade(client);
        } else if (message == 'stop_orderbook') {
          stopIntervalOrderbook();
        } else if (message == 'stop_running_trade') {
          stopIntervalRunningTrade();
        } else {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  function runOrderbook(client) {
    stopIntervalOrderbook();
    orderbookIntervalId = setInterval(() => {
      for (let i = 0; i < randomInt(totalDataSent); i++) {
        let dataString = `#O|${symbol}|`;
        const type = Math.random() < 0.5 ? "OFFER" : "BID";
        dataString += `${type}|`;
        for (let i = 0; i < 50; i++) {
          dataString += `${randomInt(10000)};${randomInt(20)};${randomInt(1000000)}|`;
        }
        dataString = dataString.substring(0, dataString.length - 1);
        const responseJson = {
          stockCode: symbol,
          body: dataString,
          sequenceNumber: Math.floor(Math.random() * 10000000),
          orderBookID: Math.floor(Math.random() * 10000),
          datetime: new Date().toISOString()
        };
        client.send(JSON.stringify(responseJson));
      }
    }, intervalTime);
  }

  function runRunningTrade(client) {
    stopIntervalRunningTrade();
    runningTradeIntervalId = setInterval(() => {
      for (let i = 0; i < randomInt(totalDataSent); i++) {
        const response = generateRunningTradeBatch(randomInt(10, 1));
        client.send(JSON.stringify(response));
      }
    }, intervalTime);
  }

  function generateRunningTradeBatch(numItems = 3) {
    const batch = [];
    for (let i = 0; i < numItems; i++) {
      batch.push(generateRunningTrade(symbol));
    }
    return { batch };
  }

  function generateRunningTrade() {
    return {
      stock: symbol,
      price: Math.floor(Math.random() * 100) + 5000,
      volume: Math.floor(Math.random() * 1000000),
      isGlobal: false,
      percentage: Math.random(),
      action: Math.floor(Math.random() * 3) + 1,
    };
  }

  function stopIntervalOrderbook() {
    if (orderbookIntervalId) {
      clearInterval(orderbookIntervalId);
      orderbookIntervalId = null;
    }
  }

  function stopIntervalRunningTrade() {
    if (runningTradeIntervalId) {
      clearInterval(runningTradeIntervalId);
      runningTradeIntervalId = null;
    }
  }

  function randomInt(max, min = 0) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
