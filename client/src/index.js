import { io } from "socket.io-client";
import { Block, Blockchain } from "./blockchain";
import { Mempool, Transaction } from "./blockchain";

import genisis from "./genisis";

const TURN_SERVER_URL = "104.154.65.135:3478";
const TURN_SERVER_USERNAME = "obventio";
const TURN_SERVER_CREDENTIAL = "testpass";
const SIGNALING_SERVER_URL = "http://104.154.65.135:9000";

const MAX_BLOCKS_PER_REQUEST = 100;

const MAX_PEER_CONNECTIONS = 256;
const MAX_SIGNALING_SERVER_CONNECTIONS = 16;

const PC_CONFIG = {
  iceServers: [
    {
      urls: "turn:" + TURN_SERVER_URL + "?transport=tcp",
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    },
    {
      urls: "turn:" + TURN_SERVER_URL + "?transport=udp",
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    }
  ]
};

const PRIVATE_KEY = "abc123";

// Some function to get public key
const PUBLIC_KEY = (() => {
  return PRIVATE_KEY;
})();

let activeSignalingServersCount = 0;
let activePeersCount = 0;

/* 
'addr' : {
    status,
    peerCount,
    lastMessage
}
*/
const signalingServers = {};

/* 
'id' : {
    status,
    servers: [],
    lastMessage
}
*/
const peers = {};

// TODO: presistance
const blockchain = new Blockchain([new Block(genisis)]);
const mempool = new Mempool();

const refreshSignalingServers = () => {
  const inactiveServers = Object.entries(signalingServers)
    .filter(ss => ss[1].status === "inactive")
    .sort((a, b) => {
      if (a.lastMessage < b.lastMessage) return -1;
      if (a.lastMessage > b.lastMessage) return 1;
      return 0;
    });

  while (activeSignalingServersCount < MAX_SIGNALING_SERVER_CONNECTIONS) {
    const newConnection = inactiveServers.shift()[0];
    initiateServerConnection(newConnection);
    activeSignalingServersCount++;
  }
};

const randn_bm = (min, max, skew) => {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) num = randn_bm(min, max, skew); // resample between 0 and 1 if out of range
  num = Math.pow(num, skew); // Skew
  num *= max - min; // Stretch to fill range
  num += min; // offset to min
  return Math.round(num);
};

const refreshPeers = () => {
  const availablePeers = Object.entries(peers)
    .filter(p => p[1].status === "available")
    .sort((a, b) => {
      if (a.lastMessage < b.lastMessage) return -1;
      if (a.lastMessage > b.lastMessage) return 1;
      return 0;
    });

  while (activePeersCount < MAX_PEER_CONNECTIONS) {
    const randomIndex = randn_bm(0, availablePeers.length - 1, 3);
    const newConnection = availablePeers[randomIndex][0];
    initiatePeerConnection(newConnection);
    activePeersCount++;
  }
};

const handleAddr = (id, data) => {
  newServers = data.signalingServers.filter(ss => !(ss in signalingServers));
  newServers.forEach(ss => {
    signalingServers[ss] = {
      status: "inactive",
      peerCount: 0,
      lastMessage: 0
    };
    if (activeSignalingServersCount < MAX_SIGNALING_SERVER_CONNECTIONS) {
      refreshSignalingServers();
    }
  });
};

const handleGetaddr = id => {
  peers[id].send("addr", {
    signalingServers: Object.keys(signalingServers)
  });
};

const handleInv = (id, data) => {
  const { type, headers } = data;

  switch (type) {
    case "block":
      const { index } = headers;
      if (index > blockchain.currentIndex) {
        peers[id].send("getblocks", {
          fromIndex: blockchain.currentIndex,
          toIndex: Math.min(
            headers.index + 1,
            blockchain.currentIndex + MAX_BLOCKS_PER_REQUEST
          )
        });
      }
    case "transaction":
      if (!mempool.hasTransaction(headers)) {
        peers[id].send("gettransactions", headers);
      }
  }
  // Check if we have data
  // request if not
};

const handleGetblocks = (id, data) => {
  const { fromIndex, toIndex } = data;
  const validToIndex = Math.min(toIndex, fromIndex + MAX_BLOCKS_PER_REQUEST);
  peers[id].send(
    "blocks",
    blockchain.blocks.slice(fromIndex, validToIndex).map(b => b.toObject())
  );
};

const handleTransactions = (id, data) => {
  // Validate transaction
  // save transaction
  // send inv
};

const handleBlocks = (id, data) => {
  const { blocks } = data;
  const isValidChain = blockchain.syncBlocks(blocks);

  if (isValidChain) {
    peers[id].send("getversion");
  }
  // Validate block
  // save block
  // send inv
};

const handleGettransactions = (id, data) => {};

const handleVersion = (id, headers) => {
  const status = blockchain.checkVersion(headers);
  switch (status) {
    case "newer":
      peers[id].send("getblocks", {
        fromIndex: blockchain.currentIndex,
        toIndex: Math.min(
          headers.index + 1,
          blockchain.currentIndex + MAX_BLOCKS_PER_REQUEST
        )
      });
    case "matches":
      peers[id].inSync = true;
  }
};

const handleGetversion = id => {
  peers[id].send("version", blockchain.version);
};

const handlePeerMessage = id => event => {
  const { type, data } = event.data;

  peers[id].lastMessage = Date.now();

  switch (type) {
    // Handle most recent block
    case "version":
      handleVersion(id, data);

    // Request most recent block
    case "getversion":
      handleGetversion(id);

    // List of signaling servers
    case "addr":
      handleAddr(id, data);

    // Request signaling servers
    case "getaddr":
      handleGetaddr(id);

    // Invitation to get new block/transaction
    case "inv":
      handleInv(id, data);

    // Request transactions
    case "gettransactions":
      handleGettransactions(id, data);

    // Request block range
    case "getblocks":
      handleGetblocks(id, data);

    // Receive a transaction
    case "transactions":
      handleTransactions(id, data);

    // Receive a block
    case "blocks":
      handleBlocks(id, data);
  }
};

const createPeerConnection = id => {
  try {
    let pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate(id);
    pc.ondatachannel = ondatachannel(id);
    pc.createDataChannel(id);
    console.log("PeerConnection created");
    return pc;
  } catch (error) {
    console.error("PeerConnection failed: ", error);
  }
};

let setAndSendLocalDescription = id => sessionDescription => {
  peers[id].pc.setLocalDescription(sessionDescription);
  console.log("Local description set");
  peers[id].sendViaSignalingServer(sessionDescription);
};

const sendOffer = id => {
  console.log("Send offer");
  peers[id].pc.createOffer().then(setAndSendLocalDescription(id), error => {
    console.error("Send offer failed: ", error);
  });
};

let sendAnswer = id => {
  console.log("Send answer");
  peers[id].pc.createAnswer().then(setAndSendLocalDescription(id), error => {
    console.error("Send answer failed: ", error);
  });
};

let onIceCandidate = id => event => {
  if (event.candidate) {
    console.log("ICE candidate");

    peers[id].sendViaSignalingServer({
      type: "candidate",
      candidate: event.candidate
    });
  }
};

const sendPeerMessage = send => (type, data = {}) => {
  send({
    type,
    data
  });
};

let ondatachannel = id => event => {
  event.channel.onopen = function() {
    peers[id].status = "active";
    peers[id].inSync = false;
  };

  peers[id].send = sendPeerMessage(event.channel.send);
  event.channel.onmessage = handlePeerMessage(id);

  // send most recent block on connection
  handleGetversion(id);
  // request peer's signaling servers
  peers[id].send("getaddr");
  // sync transactions
  peers[id].send("gettransactions");
};

let handleSignalingData = (id, data) => {
  switch (data.type) {
    case "offer":
      peers[id].pc = createPeerConnection(id);
      peers[id].pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer(id);
      break;
    case "answer":
      peers[id].pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case "candidate":
      peers[id].pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};

const sendServerData = (socket, id) => data => {
  socket.emit("data", {
    to: id,
    from: PUBLIC_KEY,
    data
  });
};

const sendViaSignalingServer = id => data => {
  if (!peers[id].servers.length) throw "No active signaling server connection";

  // Prefer sending through less used signaling server
  const prefConnection = Object.keys(peers[id].servers).sort((a, b) => {
    if (signalingServers[a].peerCount < signalingServers[b].peerCount)
      return -1;
    if (signalingServers[a].peerCount > signalingServers[b].peerCount) return 1;
    return 0;
  })[0];

  if (peers[id].prefConnection !== prefConnection) {
    if (
      peers[id].prefConnection &&
      signalingServers[peers[id].prefConnection].peerCount
    ) {
      signalingServers[peers[id].prefConnection].peerCount--;
    }
    signalingServers[prefConnection].peerCount++;
    peers[id].prefConnection = prefConnection;
  }

  peers[id].servers[prefConnection].sendServerdata(data);
};

const initiatePeerConnection = id => {
  peers[id].pc = createPeerConnection(id);
  sendOffer(id);
};

const handleSignalingServerDisconnect = url => {
  Object.keys(peers).forEach(id => {
    if (peers[id].servers[url]) {
      delete peers[id].servers[url];
    }
  });

  signalingServers[url].status = "inactive";
  signalingServers[url].peerCount = 0;

  activeSignalingServersCount--;
  if (activeSignalingServersCount < MAX_SIGNALING_SERVER_CONNECTIONS) {
    refreshSignalingServers();
  }
};

const initiateServerConnection = url => {
  const socket = io(url);

  socket.on("connect", () => {
    signalingServers[url].status = "active";

    socket.emit("id", PUBLIC_KEY);
    socket.emit("list");
  });

  socket.on("connect_error", error => {
    handleSignalingServerDisconnect(url);
    socket.close(); // is this necessary?
  });

  socket.on("disconnect", () => {
    handleSignalingServerDisconnect(url);
  });

  socket.on("list", ids => {
    ids.forEach(id => {
      peers[id] = peers[id] || {};
      peers[id].status = peers[id].status === "active" ? "active" : "available";
      peers[id].lastMessage = peers[id].lastMessage || 0;
      peers[id].servers = peers[id].servers || {};
      peers[id].servers[url] = {
        sendServerdata: sendServerData(socket, id)
      };
      if (activePeersCount < MAX_PEER_CONNECTIONS) {
        refreshPeers();
      }
      peers[id].sendViaSignalingServer = sendViaSignalingServer(id);
    });
  });

  socket.on("data", message => {
    console.log("Data received: ", data);
    const { data, from: id } = message;

    signalingServers[url].lastMessage = Date.now();

    // update connection
    peers[id].servers[url] = sendServerData(socket, id);
    handleSignalingData(id, data);
  });
};

/* 

Todo:

1. peer discovery

    1. join all saved signaling servers
    2. connect to all peers
    3. on each connection
        1. find new servers
            - send/recieve all signaling servers
            - join new servers and repeat
        2. download transactions -> use naive coin method

2. transaction structure
    1. public key
    2. from 
    3. to

3. wallet UI
    1. calculate total
    2. send money

4. generate private keys

*/
