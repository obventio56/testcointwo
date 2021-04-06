import emitter from "../events";
import { getPrivateKey, getPublicKey, generateKeyPair } from "./helpers";
import genesis from "./genesis";
import { initMiner } from "./miner";
import { Blockchain } from "./blockchain";
import { Transaction, TxIn, TxOut } from "./transaction";
import { joinNetwork } from "../p2p";

const KING_PRIVATE =
  "307702010104206df98d8728b8bfe8cde9121462c270ccbd1e1596fdf570a86379f0e61f5b5c34a00a06082a8648ce3d030107a144034200041e577c985f0b20f73bad4ee3b9df350965d05a3634b7e277fd75b4b63ded21531b3f520570fbb072d60915d65295f324dfb727e1bb101a3849587c4852e7ec6a";

const blockchain = new Blockchain({ blocks: [genesis] });

joinNetwork(blockchain);

let memPool = [];

let myPrivateKey = getPrivateKey();
let myPublicKey = getPublicKey();
(async () => {
  /*
  const { publicKey: public1, privateKey: private1 } = await generateKeyPair();
  const { publicKey: public2, privateKey: private2 } = await generateKeyPair();

  const privateKey = private1;

  const invite1 = new Transaction({
    type: "INVITE",
    txIns: [new TxIn({ txOutId: "THE_TREASURY", txOutIndex: 0 })],
    txOuts: [new TxOut({ address: public1, amount: 5 })]
  });
  const invite2 = new Transaction({
    type: "INVITE",
    txIns: [new TxIn({ txOutId: "THE_TREASURY", txOutIndex: 0 })],
    txOuts: [new TxOut({ address: public2, amount: 5 })]
  });

  invite1.sign(KING_PRIVATE);
  invite2.sign(KING_PRIVATE);

  memPool.push(invite1);
  memPool.push(invite2);
  */

  emitter.on("updatePrivateKey", async () => {
    myPrivateKey = getPrivateKey();
    myPublicKey = getPublicKey();
  });

  let miningBlock;
  const { mineABlock } = initMiner(blockchain);

  const updateMiningBlock = () => {
    const transactions = memPool.slice(0, 10);
    miningBlock = blockchain.generateBlock({ transactions });
    mineABlock(miningBlock.getBlockData());
  };

  const addToMemPool = transaction => {
    if (memPool.find(t => t.id === transaction.id)) return false;
    memPool.push(transaction);
    emitter.emit("newTransaction", {
      transactionObject: transaction.toObject()
    });

    updateMiningBlock();
  };

  emitter.on("requestToken", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const invite = new Transaction({
      type: "INVITE",
      txIns: [new TxIn({ txOutId: "THE_TREASURY", txOutIndex: 0 })],
      txOuts: [new TxOut({ address: publicKey, amount: 5 })]
    });
    invite.sign(KING_PRIVATE);
    memPool.push(invite);

    emitter.emit("newToken", { publicKey, privateKey });
  });

  emitter.on("transaction", transactionData => {
    const transaction = blockchain.generateTransaction(
      myPrivateKey,
      transactionData
    );

    transaction.sign(myPrivateKey);

    addToMemPool(transaction);
  });

  emitter.on("peerTransaction", ({ transactionData }) => {
    const transaction = blockchain.validateTransaction(transactionData);

    if (!transaction) {
      console.log("invalid transaction");
      return;
    }
    addToMemPool(transaction);
  });

  emitter.on("minedBlock", blockData => {
    miningBlock.nounce = blockData.nounce;
    miningBlock.updateHash();
    console.log("Before add mined block", miningBlock.index);
    blockchain.addBlock({ block: miningBlock }, true);
  });

  emitter.on("blockAdded", () => {
    emitter.emit("block", {
      balance: blockchain.getBalance({ address: myPublicKey })
    });

    const newTransactions =
      blockchain.blocks[blockchain.blocks.length - 1].transactions;

    memPool = memPool.filter(t => !newTransactions.some(nt => nt.id === t.id));
    updateMiningBlock();
  });

  updateMiningBlock();
})();
