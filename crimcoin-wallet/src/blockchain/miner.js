import emitter from "../events";
const path = window.require("path");

const initMiner = blockchain => {
  const worker = new Worker(path.resolve(__dirname, "miner.js"));

  const mineABlock = blockData => {
    const target = blockchain.getTarget();

    //console.log(targetBuffer, blockData);

    /*
    const blockData = {
      index: 1,
      timestamp: new Date().getTime(),
      data: crypto.randomBytes(20).toString("hex"),
      previousHash: "abc123"
    };
    */

    worker.postMessage({ block: blockData, target });
  };

  worker.onmessage = e => {
    //console.log("Found a block!");
    emitter.emit("minedBlock", e.data);
  };

  return { mineABlock };
};

export { initMiner };
