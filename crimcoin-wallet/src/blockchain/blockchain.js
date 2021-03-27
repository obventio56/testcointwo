/* global BigInt */
import { Block } from "./block";
import { Transaction, TxIn, TxOut } from "./transaction";
import { pubFromPriv, compareBuffer } from "./helpers";
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
    if (
      this.blocks.length % 10 === 0 &&
      this.blocks.length !== this.targetIndex
    ) {
      this.target = this.recalculateTarget();
      this.targetIndex = this.blocks.length;
    }
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
    const target = this.target;
    const last10Blocks = this.blocks.slice(-10).map(b => b.timestamp);

    const interval = (last10Blocks[9] - last10Blocks[0]) / 10;
    const scaleFactor = interval / 5000;

    //console.log(last10Blocks[9], last10Blocks[0]);

    //console.log(scaleFactor);

    let newTarget;
    if (scaleFactor > 1) {
      newTarget = target * BigInt(Math.round(scaleFactor));
    } else {
      newTarget = target / BigInt(Math.round(1 / scaleFactor));
    }

    if (newTarget > BigInt("0x" + "f".repeat(64))) {
      return BigInt("0x" + "f".repeat(64));
    }

    return newTarget;
  }

  getBalance({ address }) {
    return this.unspentTxOuts
      .filter(utxo => utxo.address === address)
      .reduce((balance, utxo) => balance + utxo.amount, 0);
  }

  addBlock({ block }) {
    const newUnspentTxOuts = isValidNextBlock(
      this.blocks[this.blocks.length - 1],
      block,
      this.unspentTxOuts,
      this.getTargetBuffer()
    );

    if (newUnspentTxOuts) {
      this.blocks.push(block);
      this.unspentTxOuts = newUnspentTxOuts;

      emitter.emit("blockAdded");
    } else {
      console.log("Block invalid, not added");
    }

    //console.log(newUnspentTxOuts);
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

const isValidBlockStructure = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.transactions === "object"
  );
};

const isValidNextBlock = (
  previousBlock,
  newBlock,
  unspentTxOuts,
  targetBuffer
) => {
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
    console.log(
      "invalid hash: " + newBlock.generateHash() + " " + newBlock.hash
    );
    return false;
  }
  const blockHashBuffer = newBlock.getHashBuffer();

  if (!compareBuffer(targetBuffer, blockHashBuffer)) {
    console.log("new block doesn't have meet target difficulty");
    return false;
  }

  unspentTxOuts = newBlock.validateTransactions(cloneDeep(unspentTxOuts));

  return unspentTxOuts;
};

export { Blockchain };
