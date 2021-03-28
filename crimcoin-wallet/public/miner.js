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
      console.log("still mining", block.index);
    }

    block.nounce = nounce;
    const serializedData = enc.encode(serialize(block)).buffer;
    const hash = await crypto.subtle.digest("SHA-256", serializedData);

    const hashArray = Array.from(new Uint8Array(hash));
    const hexString = hashArray
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const testInt = BigInt("0x" + hexString);

    if (testInt > target) {
      nounce++;
      return;
    }

    clearInterval(miningInterval);
    postMessage({ nounce });
  }, 1);
};

onmessage = async e => {
  //console.log(e.data)

  if (miningInterval) clearInterval(miningInterval);
  mineBlock(e.data);
};
