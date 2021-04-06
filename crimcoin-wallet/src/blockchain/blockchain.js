/* global BigInt */

import { Block } from "./block";
import { Transaction, TxIn, TxOut, UnspentTxOut } from "./transaction";
import { pubFromPriv, verify } from "./helpers";
import emitter from "../events";

import cloneDeep from "lodash/cloneDeep";
class Blockchain {
  blocks;
  unspentTxOuts;
  target;
  targetIndex;

  constructor({ blocks }) {
    this.blocks = blocks;
    this.unspentTxOuts = [];
    this.target = BigInt("0x" + "f".repeat(64));
    this.targetIndex = 0;
  }

  getTarget() {
    this.recalculateTarget();
    return this.target;
  }

  getTargetBuffer() {
    const target = this.getTarget();

    //console.log(target);

    const targetString = target.toString(16).padEnd(64, "0");

    //console.log(targetString, targetString.length);
    return Buffer.from(targetString, "hex");
  }

  recalculateTarget() {
    const endIndex = Math.floor(this.blocks.length / 10) * 10;
    if (endIndex < 10) {
      return;
    }

    while (this.targetIndex < endIndex) {
      const target = this.target;

      const last10Blocks = this.blocks
        .slice(this.targetIndex, this.targetIndex + 10)
        .map(b => b.timestamp);

      const interval = (last10Blocks[9] - last10Blocks[0]) / 10;
      const scaleFactor = Math.sqrt(interval / 5000);

      //console.log(scaleFactor, interval, last10Blocks[9], last10Blocks[0]);

      let newTarget;
      if (scaleFactor > 1) {
        newTarget = target * BigInt(Math.round(scaleFactor));
      } else {
        newTarget = target / BigInt(Math.round(1 / scaleFactor));
      }

      if (newTarget > BigInt("0x" + "f".repeat(64))) {
        newTarget = BigInt("0x" + "f".repeat(64));
      }
      this.targetIndex = this.targetIndex + 10;
      this.target = newTarget;

      //console.log("new target", this.target);
    }
  }

  getBalance({ address }) {
    return this.unspentTxOuts
      .filter(utxo => utxo.address === address)
      .reduce((balance, utxo) => balance + utxo.amount, 0);
  }

  addBlock({ block }, broadcast = false) {
    const newUnspentTxOuts = isValidNextBlock(
      this.blocks[this.blocks.length - 1],
      block,
      this.unspentTxOuts,
      this.target
    );

    if (newUnspentTxOuts) {
      this.blocks.push(block);
      this.unspentTxOuts = newUnspentTxOuts;

      if (broadcast) {
        emitter.emit("blockAdded", { index: block.index });
      }
      return true;
    } else {
      console.log("Block invalid, not added");
    }
    return false;

    //console.log(newUnspentTxOuts);
  }

  getBlockDataAtIndex({ index }) {
    return this.blocks[index].toObject();
  }

  getBlockRange(start, end) {
    return this.blocks.slice(Math.max(start, 0), end).map(b => b.toObject());
  }

  receiveBlocks({ blocks, from }) {
    let newBlocksIndex;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].previousHash === this.blocks[blocks[i].index - 1]?.hash) {
        newBlocksIndex = i;
      }
    }

    if (!newBlocksIndex) {
      emitter.emit("requestBlocks", { blocks, from });
      return;
    }

    const newBlocks = blocks.slice(newBlocksIndex);

    if (
      sumDifficulty(newBlocks) <
      sumDifficulty(this.blocks.slice(newBlocks[0].index))
    ) {
      console.log("lower diff");
      emitter.emit("clearBlockBuffer", { id: from });
      return;
    }

    console.log("higer diff");

    const testingBlockchain = this.getStateAtIndex({
      index: newBlocks[0].index
    });

    for (let i = 0; i < newBlocks.length; i++) {
      const block = Block.fromObject(newBlocks[i]);
      //console.log("Before add received block", block.index);

      if (!testingBlockchain.addBlock({ block })) {
        emitter.emit("clearBlockBuffer", { id: from });
        console.log("Invalid addition at index:", block.index);
        return;
      }
    }

    console.log(
      `replaced from ${newBlocks[0].index} to ${testingBlockchain.blocks.length} with target diff ${testingBlockchain.target}`
    );

    this.blocks = testingBlockchain.blocks;
    this.unspentTxOuts = testingBlockchain.unspentTxOuts;
    this.target = testingBlockchain.target;
    this.targetIndex = testingBlockchain.targetIndex;

    emitter.emit("clearBlockBuffer", { id: from });
    newBlocks.forEach(b => {
      emitter.emit("blockAdded", { index: b.index });
    });
  }

  getStateAtIndex({ index }) {
    const blockchain = new Blockchain({
      blocks: this.blocks.slice(0, index)
    });

    blockchain.recalculateTarget();

    let resultUnspentTxOuts = cloneDeep(this.unspentTxOuts);
    const removedBlocks = this.blocks.slice(index);

    removedBlocks.reverse().map(b => {
      for (const transaction of b.transactions) {
        resultUnspentTxOuts = resultUnspentTxOuts.filter(
          utxo => utxo.txOutId !== transaction.id
        );
      }

      b.transactions
        .reduce((txIns, t) => [...txIns, ...t.txIns], [])
        .forEach(txIn => {
          const utxo = resultUnspentTxOuts.find(
            utxo =>
              utxo.txOutId === txIn.txOutId &&
              utxo.txOutIndex === txIn.txOutIndex
          );

          if (!utxo) {
            resultUnspentTxOuts.push(
              new UnspentTxOut({
                address: txIn.address,
                amount: txIn.amount,
                txOutId: txIn.txOutId,
                txOutIndex: txIn.txOutIndex
              })
            );
          } else {
            utxo.amount += txIn.amount;
          }
        });
    });

    blockchain.unspentTxOuts = resultUnspentTxOuts;

    return blockchain;
  }

  validateTransaction(transactionData) {
    const { id } = transactionData;

    let unspentTxOuts = cloneDeep(this.unspentTxOuts);
    let inSum = 0;

    for (const txIn of transactionData.txIns) {
      const { address: publicKey, signature, txOutId, txOutIndex } = txIn;
      if (!verify(publicKey, id, signature)) return false;
      const utxo = unspentTxOuts.find(
        utxo =>
          utxo.txOutId === txOutId &&
          utxo.txOutIndex === txOutIndex &&
          utxo.address === publicKey
      );

      if (!utxo) return false;
      if (utxo.amount < txIn.amount) return false;

      inSum += txIn.amount;
    }

    const outSum = transactionData.txOuts.reduce(
      (outSum, txOut) => outSum + txOut.amount,
      0
    );

    if (outSum > inSum) return false;

    return Transaction.fromObject(transactionData);
  }

  generateTransaction(privateKey, transactionData) {
    const { amount, address } = transactionData;
    let unspentTxOuts = cloneDeep(this.unspentTxOuts);
    const TxIns = [];
    let remainingAmount = amount;

    const searchAddress = pubFromPriv(privateKey);

    while (remainingAmount > 0) {
      const utxo = unspentTxOuts.find(utxo => utxo.address === searchAddress);

      //console.log(utxo);

      if (!utxo) break;

      TxIns.push(
        new TxIn({
          amount: Math.min(utxo.amount, remainingAmount),
          address: utxo.address,
          txOutId: utxo.txOutId,
          txOutIndex: utxo.txOutIndex
        })
      );

      if (utxo.amount < remainingAmount) {
        remainingAmount -= utxo.amount;
        unspentTxOuts = unspentTxOuts.filter(
          _utxo =>
            _utxo.txOutId !== utxo.txOutId ||
            _utxo.txOutIndex !== utxo.txOutIndex
        );
      } else {
        remainingAmount = 0;
      }
    }

    if (remainingAmount !== 0) return false;

    const TxOuts = [
      new TxOut({
        address,
        amount
      })
    ];

    return new Transaction({
      type: "PAYMENT",
      memo: "",
      txIns: TxIns,
      txOuts: TxOuts
    });
  }

  /*
  updateTxOuts({ block }) {
    const newTxIns = block.transactions
      .map(t => t.txIns)
      .reduce((c, txIns) => [...c, ...txIns], []);

    for (const txIn of newTxIns) {
      const txOutIndex = this.unspentTxOuts.findIndex(
        utxo => utxo.txOutId === txIn.txOutId
      );

      this.unspentTxOuts[txOutIndex].amount -= txIn.amount;
    }

    for (const transaction of block.transactions) {
      this.unspentTxOuts.push(
        new UnspentTxOut({
          address: transaction.txOut.address,
          txOutId: transaction.id,
          amount: transaction.txOut.amount
        })
      );
    }

    this.unspentTxOuts = this.unspentTxOuts.filter(utxo => utxo.amount > 0);
  }
  */

  generateBlock({ transactions }) {
    const blockProps = {
      index: this.blocks.length,
      timestamp: new Date().getTime(),
      transactions: transactions,
      previousHash: this.blocks[this.blocks.length - 1].hash
    };

    return new Block(blockProps);
  }
}

const sumDifficulty = blocks => {
  const minDifficulty = BigInt("0x" + "f".repeat(64));
  return blocks.reduce(
    (difficulty, block) =>
      difficulty + minDifficulty - BigInt(`0x${block.hash.padEnd(64, "0")}`),
    BigInt(0)
  );
};

const isValidBlockStructure = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.transactions === "object"
  );
};

const isValidNextBlock = (previousBlock, newBlock, unspentTxOuts, target) => {
  if (!isValidBlockStructure(newBlock)) {
    console.log("invalid structure");
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("invalid index");
    return false;
  }
  if (previousBlock.hash !== newBlock.previousHash) {
    console.log("invalid previoushash");
    return false;
  }
  if (newBlock.generateHash() !== newBlock.hash) {
    console.log(newBlock);

    console.log(
      "invalid hash: " + newBlock.generateHash() + " " + newBlock.hash
    );
    return false;
  }
  const blockHash = BigInt("0x" + newBlock.hash);

  if (target < blockHash) {
    console.log("new block doesn't have meet target difficulty");
    return false;
  }

  unspentTxOuts = newBlock.validateTransactions(cloneDeep(unspentTxOuts));

  return unspentTxOuts;
};

export { Blockchain };
