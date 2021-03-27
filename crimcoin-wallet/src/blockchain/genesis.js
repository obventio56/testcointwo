import { Block } from "./block";
import { Transaction } from "./transaction";

export default new Block({
  index: 0,
  timestamp: 1615150337000,
  previousHash: "",
  transactions: [
    new Transaction({
      type: "KING_TOKEN",
      txIns: [],
      txOuts: [],
      memo:
        "3059301306072a8648ce3d020106082a8648ce3d030107034200041e577c985f0b20f73bad4ee3b9df350965d05a3634b7e277fd75b4b63ded21531b3f520570fbb072d60915d65295f324dfb727e1bb101a3849587c4852e7ec6a"
    })
  ]
});
