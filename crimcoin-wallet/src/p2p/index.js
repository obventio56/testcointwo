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

let socket = io(SIGNALING_SERVER_URL);
let pc;

const createPeerConnection = () => {
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    pc.ondatachannel = ondatachannel;
    const dc = pc.createDataChannel("io");

    dc.onmessage = event => {
      console.log("a block from afar", event);
    };

    console.log("PeerConnection created");
  } catch (error) {
    console.error("PeerConnection failed: ", error);
  }
};

let setAndSendLocalDescription = sessionDescription => {
  pc.setLocalDescription(sessionDescription);
  console.log("Local description set");
  sendData(sessionDescription);
};

let sendOffer = () => {
  console.log("Send offer");
  pc.createOffer().then(setAndSendLocalDescription, error => {
    console.error("Send offer failed: ", error);
  });
};

let sendAnswer = () => {
  console.log("Send answer");
  pc.createAnswer().then(setAndSendLocalDescription, error => {
    console.error("Send answer failed: ", error);
  });
};

let onIceCandidate = event => {
  if (event.candidate) {
    console.log("ICE candidate");
    sendData({
      type: "candidate",
      candidate: event.candidate
    });
  }
};

let ondatachannel = event => {
  console.log("Data channel is created!");
  event.channel.onopen = function() {
    console.log("Data channel is open and ready to be used.");
  };

  emitter.on("block", data => {
    if (event.channel.readyState === "open") {
      //console.log("block to send");

      event.channel.send(JSON.stringify({ ...data }));
    }
  });
};

let handleSignalingData = data => {
  switch (data.type) {
    case "offer":
      createPeerConnection();
      pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
      break;
    case "answer":
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case "candidate":
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};

socket.on("data", data => {
  console.log("Data received: ", data);
  handleSignalingData(data);
});

socket.on("ready", () => {
  console.log("Ready");
  createPeerConnection();
  sendOffer();
});

let sendData = data => {
  socket.emit("data", data);
};
