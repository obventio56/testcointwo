import { io } from "socket.io-client";
import emitter from "../events";
const TURN_SERVER_URL = "104.154.65.135:3478";
const TURN_SERVER_USERNAME = "obventio";
const TURN_SERVER_CREDENTIAL = "testpass";
const SIGNALING_SERVER_URL = "http://104.154.65.135:9000";

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

const joinNetwork = blockchain => {
  let socket = io(SIGNALING_SERVER_URL);
  const serverConnections = {};
  const peerConnections = {};

  const createPeerConnection = ({ id }) => {
    try {
      serverConnections[id] = new RTCPeerConnection(PC_CONFIG);
      serverConnections[id].onicecandidate = onIceCandidate({ id });
      serverConnections[id].ondatachannel = ondatachannel({ id });
      const dc = serverConnections[id].createDataChannel(`${id}`);

      dc.onmessage = event => {
        handlePeerData({ data: event, from: id });
      };

      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };

  let setAndSendLocalDescription = ({ id }) => sessionDescription => {
    serverConnections[id].setLocalDescription(sessionDescription);
    console.log("Local description set");
    sendMessage({ data: sessionDescription, to: id });
  };

  let sendOffer = ({ id }) => {
    console.log("Send offer");
    serverConnections[id]
      .createOffer()
      .then(setAndSendLocalDescription({ id }), error => {
        console.error("Send offer failed: ", error);
      });
  };

  let sendAnswer = ({ id }) => {
    console.log("Send answer");
    serverConnections[id]
      .createAnswer()
      .then(setAndSendLocalDescription({ id }), error => {
        console.error("Send answer failed: ", error);
      });
  };

  let onIceCandidate = ({ id }) => event => {
    if (event.candidate) {
      console.log("ICE candidate");
      sendMessage({
        data: {
          type: "candidate",
          candidate: event.candidate
        },
        to: id
      });
    }
  };

  let ondatachannel = ({ id }) => event => {
    event.channel.onopen = function() {
      console.log("Data channel is open and ready to be used.");
    };

    peerConnections[id] = event.channel;
  };

  const handlePeerData = ({ data: message, from }) => {
    const { data, type } = JSON.parse(message.data);

    switch (type) {
      case "block":
        if (data.hash === blockchain.blocks[data.index]?.hash) {
          return;
        }

        if (peerConnections[from].blocksBuffer) return;

        blockchain.receiveBlocks({ blocks: [data], from });
        break;
      case "requestBlocks":
        sendToPeer({
          to: from,
          data: {
            type: "blockRange",
            data: blockchain.getBlockRange(data.index - data.count, data.index)
          }
        });
        break;
      case "blockRange":
        const blocks = data.concat(peerConnections[from].blocksBuffer || []);

        blockchain.receiveBlocks({ blocks, from });

        break;
    }
  };

  let handleSignalingData = message => {
    const { data, from: id } = message;
    switch (data.type) {
      case "offer":
        createPeerConnection({ id });
        serverConnections[id].setRemoteDescription(
          new RTCSessionDescription(data)
        );
        sendAnswer({ id });
        break;
      case "answer":
        serverConnections[id].setRemoteDescription(
          new RTCSessionDescription(data)
        );
        break;
      case "candidate":
        serverConnections[id].addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        break;
    }
  };

  socket.on("broadcast", data => {
    console.log("Broadcast received: ", data);
    handleSignalingData(data);
  });

  socket.on("message", data => {
    console.log("Message received: ", data);
    handleSignalingData(data);
  });

  socket.on("ready", ({ id }) => {
    console.log("Ready");
    createPeerConnection({ id });
    sendOffer({ id });
  });

  /*
const broadcastData = data => {
  socket.emit("broadcast", data);
};
*/

  const sendMessage = data => {
    socket.emit("message", data);
  };

  const broadcastToPeers = data => {
    for (const peer in peerConnections) {
      if (peerConnections[peer].readyState === "open") {
        peerConnections[peer].send(JSON.stringify(data));
      }
    }
  };

  const sendToPeer = ({ to, data }) => {
    if (peerConnections[to].readyState === "open") {
      peerConnections[to].send(JSON.stringify(data));
    }
  };

  emitter.on("blockAdded", ({ index }) => {
    if (blockchain.blocks[index].transactions.length) {
      console.log(blockchain.blocks[index]);
    }

    broadcastToPeers({
      type: "block",
      data: blockchain.getBlockDataAtIndex({ index })
    });
  });

  emitter.on("clearBlockBuffer", ({ id }) => {
    delete peerConnections[id].blocksBuffer;
  });

  emitter.on("requestBlocks", ({ blocks, from }) => {
    const index = blocks[0].index;
    const count = 10;

    peerConnections[from].blocksBuffer = blocks;

    sendToPeer({
      to: from,
      data: { type: "requestBlocks", data: { index, count } }
    });
  });
};

export { joinNetwork };
