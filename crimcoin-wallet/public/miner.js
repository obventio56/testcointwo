var enc = new TextEncoder();
var dec = new TextDecoder("utf-8");

let miningInterval;
let hashString = "";

const serialize = block => {
  hashString = `${block.index}${block.previousHash}${block.timestamp}${block.transactions}${block.nounce}`;
  return hashString;
};

mineBlock = async ({ block, target }) => {
  let nounce = 0;

  miningInterval = setInterval(async () => {
    if (nounce % 1000 === 0) {
      console.log("still mining");
    }

    block.nounce = nounce;
    const serializedData = enc.encode(serialize(block)).buffer;
    const hash = await crypto.subtle.digest("SHA-256", serializedData);

    const byteArray = new Uint8Array(hash);

    for (let i = byteArray.length - 1; i >= 0; i--) {
      if (byteArray[i] < target[i]) {
        break;
      }
      if (byteArray[i] > target[i]) {
        nounce++;
        return;
      }
    }

    //console.log("hash string from miner", hashString, byteArray);

    clearInterval(miningInterval);
    postMessage({ nounce, byteArray });
  }, 1);
};

onmessage = async e => {
  //console.log(e.data)

  if (miningInterval) clearInterval(miningInterval);
  mineBlock(e.data);
};
