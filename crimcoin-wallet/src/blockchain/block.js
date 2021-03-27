import { digest } from "./helpers";

class Block {
  index;
  hash;
  previousHash;
  timestamp;
  transactions;
  nounce;

  constructor({ index, previousHash, timestamp, transactions, nounce }) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nounce = nounce || 0;
    this.hash = this.generateHash();
  }

  generateHash() {
    const serialized = this.serialize();
    //console.log("hash string", serialized);
    return digest(serialized, false);
  }

  updateHash() {
    this.hash = this.generateHash();
  }

  getHashBuffer() {
    const hashString = this.hash.toString(16).padEnd(64, "0");
    return Buffer.from(hashString, "hex");
  }

  serialize() {
    const serializedTransactions = this.transactions.map(t => t.serialize());
    return `${this.index}${this.previousHash}${this.timestamp}${serializedTransactions}${this.nounce}`;
  }

  getBlockData() {
    const serializedTransactions = this.transactions.map(t => t.serialize());
    return {
      index: this.index,
      previousHash: this.previousHash,
      timestamp: this.timestamp,
      transactions: serializedTransactions,
      nounce: this.nounce,
      hash: this.hash
    };
  }

  // Validate transactions one at a time
  validateTransactions(unspentTxOuts) {
    for (const t of this.transactions) {
      unspentTxOuts = t.validate(unspentTxOuts);
      if (!unspentTxOuts) {
        break;
      }
    }

    return unspentTxOuts;
  }
}

export { Block };
