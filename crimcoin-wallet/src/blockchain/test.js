import genesis from "./genesis";
import { Blockchain } from "./blockchain";
import { Transaction, TxIn, TxOut } from "./transaction";
import { generateKeyPair } from "./helpers";

const KING_PRIVATE =
  "307702010104209898be8fa3e4752c74fdb1a58fb048f04f2dbe6ab28501395177b5b424dab031a00a06082a8648ce3d030107a14403420004d105b56fcf25ac7cbdc92bd52ff25d1c445a8efd78b10835b33aa192d213b350ad2e510680e85b1f931690bcc8ed1cdbce60615bf9a437b3def4c7a74d82fbf1";

(async () => {
  const blockchain = new Blockchain({ blocks: [genesis] });

  const { privateKey: private1, publicKey: public1 } = await generateKeyPair();
  const { privateKey: private2, publicKey: public2 } = await generateKeyPair();

  const public1RewardSource = new TxIn({
    txOutId: "KING",
    txOutIndex: "KING"
  });

  const public2RewardSource = new TxIn({
    txOutId: "KING",
    txOutIndex: "KING"
  });

  const public1Reward = new TxOut({
    address: public1,
    amount: 100
  });

  const public2Reward = new TxOut({
    address: public2,
    amount: 100
  });

  const invite1 = new Transaction({
    type: "INVITE",
    memo: public1,
    txIns: [public1RewardSource],
    txOuts: [public1Reward]
  });

  const invite2 = new Transaction({
    type: "INVITE",
    memo: public2,
    txIns: [public2RewardSource],
    txOuts: [public2Reward]
  });

  invite1.sign(KING_PRIVATE);
  invite2.sign(KING_PRIVATE);

  const inviteBlock = blockchain.generateBlock({
    transactions: [invite1, invite2]
  });

  blockchain.addBlock({ block: inviteBlock });

  console.log(blockchain);

  const testTransaction = new Transaction({
    type: "PAYMENT",
    memo: "",
    txIns: [
      new TxIn({
        txOutId: invite1.id,
        txOutIndex: 0
      })
    ],
    txOuts: [
      new TxOut({
        address: public2,
        amount: 50
      })
    ]
  });

  testTransaction.sign(private1);

  const payBlock = blockchain.generateBlock({
    transactions: [testTransaction]
  });

  blockchain.addBlock({ block: payBlock });

  console.log(
    blockchain.getBalance({ address: public1 }),
    blockchain.getBalance({ address: public2 })
  );
})();
