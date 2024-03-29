import { digest, sign, verify } from "./helpers";

const KING_PUBLIC =
  "3059301306072a8648ce3d020106082a8648ce3d030107034200041e577c985f0b20f73bad4ee3b9df350965d05a3634b7e277fd75b4b63ded21531b3f520570fbb072d60915d65295f324dfb727e1bb101a3849587c4852e7ec6a";
const COINBASE_REWARD = 100;
class UnspentTxOut {
  txOutId;
  txOutIndex;
  address;
  amount;

  constructor({ txOutId, txOutIndex, address, amount }) {
    this.txOutIndex = txOutIndex;
    this.txOutId = txOutId;
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  txOutId; // Transaction ID
  txOutIndex; // Index of TxOut in transaction TxOuts
  amount;
  address;
  signature;

  constructor({ txOutId, txOutIndex, amount, signature, address }) {
    this.txOutIndex = txOutIndex;
    this.txOutId = txOutId;
    this.amount = amount;
    this.address = address;
    this.signature = signature;
  }

  sign(privateKey, id) {
    this.signature = sign(privateKey, id);
  }

  getIdData() {
    return `${this.txOutId}${this.txOutIndex}${this.amount}${this.address}`;
  }

  serialize() {
    return `${this.txOutId}${this.txOutIndex}${this.amount}${this.address}${this.signature}`;
  }

  toObject() {
    return {
      txOutId: this.txOutId,
      txOutIndex: this.txOutIndex,
      amount: this.amount,
      address: this.address,
      signature: this.signature
    };
  }

  static fromObject(TxInObj) {
    return new TxIn({
      txOutIndex: TxInObj.txOutIndex,
      txOutId: TxInObj.txOutId,
      amount: TxInObj.amount,
      address: TxInObj.address,
      signature: TxInObj.signature
    });
  }
}

class TxOut {
  address;
  amount;

  constructor({ address, amount }) {
    this.address = address;
    this.amount = amount;
  }

  getIdData() {
    return `${this.address}${this.amount}`;
  }

  serialize() {
    return `${this.address}${this.amount}`;
  }

  toObject() {
    return {
      address: this.address,
      amount: this.amount
    };
  }

  static fromObject(TxOutObj) {
    return new TxOut({
      address: TxOutObj.address,
      amount: TxOutObj.amount
    });
  }
}

class Transaction {
  type;
  memo;
  id;
  fee;

  txIns;
  txOuts;

  constructor({ type, memo, txIns, txOuts, fee = 0 }) {
    this.type = type;
    this.memo = memo;
    this.txIns = txIns;
    this.txOuts = txOuts;
    this.fee = fee;
    this.id = this.generateId();
  }

  static fromObject(transactionObj) {
    const transaction = new Transaction({
      type: transactionObj.type,
      memo: transactionObj.memo,
      fee: transactionObj.fee,
      txIns: transactionObj.txIns.map(txIn => TxIn.fromObject(txIn)),
      txOuts: transactionObj.txOuts.map(txOut => TxOut.fromObject(txOut))
    });

    transaction.id = transactionObj.id;
    return transaction;
  }

  sign(privateKey) {
    this.txIns.forEach(txIn => txIn.sign(privateKey, this.id));
  }

  generateId() {
    const serializedTxIns = this.txIns.map(txIn => txIn.getIdData());
    const serializedTxOuts = this.txOuts.map(txOut => txOut.getIdData());
    return digest(
      `${this.type}${this.fee}${this.memo}${serializedTxIns}${serializedTxOuts}`
    );
  }

  validate(unspentTxOuts, block, target) {
    switch (this.type) {
      case "KING_TOKEN":
        return validateKingToken(this, unspentTxOuts);
      case "INVITE":
        return validateInvite(this, unspentTxOuts);
      case "COINBASE":
        return validateCoinbase(this, unspentTxOuts, block, target);
      default:
        return validateTransaction(this, unspentTxOuts);
    }
  }

  serialize() {
    const serializedTxIns = this.txIns.map(txIn => txIn.serialize());
    const serializedTxOuts = this.txOuts.map(txOut => txOut.serialize());
    return `${this.type}${this.fee}${this.memo}${this.id}${serializedTxIns}${serializedTxOuts}`;
  }

  toObject() {
    return {
      type: this.type,
      id: this.id,
      memo: this.memo,
      fee: this.fee,
      txIns: this.txIns.map(txIn => txIn.toObject()),
      txOuts: this.txOuts.map(txOut => txOut.toObject())
    };
  }
}

const validateKingToken = (transaction, unspentTxOuts) => {
  return unspentTxOuts;
};

const validateInvite = (transaction, unspentTxOuts) => {
  if (transaction.txIns.length < 1) return false;

  if (
    transaction.txIns
      .map(txIn => verify(KING_PUBLIC, transaction.id, txIn.signature))
      .some(v => !v)
  ) {
    return false;
  }

  transaction.txOuts.forEach((txOut, index) => {
    unspentTxOuts.push(
      new UnspentTxOut({
        txOutId: transaction.id,
        txOutIndex: index,
        amount: txOut.amount,
        address: txOut.address
      })
    );
  });

  return unspentTxOuts;
};

const validateCoinbase = (transaction, unspentTxOuts, block, target) => {
  if (block.transactions[0].id !== transaction.id) return false;

  if (transaction.txIns.length || !transaction.txOuts.length) return false;
  if (transaction.txOuts.length > 1) return false;

  // Potentially should replace with function
  const reward = COINBASE_REWARD;
  const fees = block.getTransactionFee();

  if (transaction.txOuts[0].amount > reward + fees) return false;

  transaction.txOuts.forEach((txOut, index) => {
    unspentTxOuts.push(
      new UnspentTxOut({
        txOutId: transaction.id,
        txOutIndex: index,
        amount: txOut.amount,
        address: txOut.address
      })
    );
  });

  return unspentTxOuts;
};

const validateTransaction = (transaction, unspentTxOuts) => {
  let amoutnIn = 0;

  // Ensure all TxIns are signed
  for (const txIn of transaction.txIns) {
    const utxo = unspentTxOuts.find(
      utxo =>
        utxo.txOutId === txIn.txOutId && utxo.txOutIndex === txIn.txOutIndex
    );

    if (!utxo) {
      return false;
    }
    if (!verify(utxo.address, transaction.id, txIn.signature)) {
      return false;
    }
    amoutnIn += utxo.amount;
  }

  let amountOut = transaction.txOuts.reduce(
    (amount, txOut) => amount + txOut.amount,
    0
  );

  // Ensure amountOut doesn't exceed amountIn
  if (amountOut > amoutnIn) {
    return false;
  }

  // Remove or dinc unspentTxOuts based on TxIns
  for (const txIn of transaction.txIns) {
    if (amountOut <= 0) break;

    const utxo = unspentTxOuts.find(
      utxo =>
        utxo.txOutId === txIn.txOutId && utxo.txOutIndex === txIn.txOutIndex
    );

    if (utxo.amount > amountOut) {
      utxo.amount -= amountOut;
      amountOut = 0;
    } else {
      amountOut -= utxo.amount;
      unspentTxOuts = unspentTxOuts.filter(
        _utxo =>
          utxo.txOutId !== _utxo.txOutId || utxo.txOutIndex !== _utxo.txOutIndex
      );
    }
  }

  // Add new unspentTxOuts based on TxOuts
  transaction.txOuts.forEach((txOut, index) => {
    unspentTxOuts.push(
      new UnspentTxOut({
        txOutId: transaction.id,
        txOutIndex: index,
        amount: txOut.amount,
        address: txOut.address
      })
    );
  });

  // Return updated unspentTxOuts if valid
  return unspentTxOuts;
};

export { Transaction, TxIn, TxOut, UnspentTxOut };
