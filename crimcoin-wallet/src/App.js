import { useRef, useEffect, useState } from "react";
import emitter from "./events";
import styles from "./App.module.css";
import { readConfig, writeConfig } from "./blockchain/helpers";

function App() {
  const { privateKey = "" } = readConfig();

  const privateKeyField = useRef();
  const sendAddress = useRef();
  const amountField = useRef();
  const [balance, setBalance] = useState(0);
  const [newToken, setNewToken] = useState("");

  useEffect(() => {
    emitter.on("block", data => {
      setBalance(data.balance);
    });

    emitter.on("newToken", data => {
      setNewToken(JSON.stringify(data));
    });
  }, []);

  const savePrivateKey = () => {
    const privateKey = privateKeyField.current.value;
    writeConfig({ privateKey });
    emitter.emit("updatePrivateKey");
  };

  const submitTransaction = () => {
    const address = sendAddress.current.value;
    const amount = parseFloat(amountField.current.value);

    emitter.emit("transaction", { address, amount });

    sendAddress.current.value = "";
    amountField.current.value = "";
  };

  const requestToken = () => {
    emitter.emit("requestToken");
  };

  return (
    <div className={styles.container}>
      <div>
        <button onClick={requestToken}>Generate new token</button>
        <p className={styles.newToken}>{newToken}</p>
      </div>
      <p>Your balance: ${balance}</p>

      <div className={styles.privateKey}>
        <label>Your private key:</label>
        <textarea ref={privateKeyField} defaultValue={privateKey} />
        <button onClick={savePrivateKey}>Save Key</button>
      </div>
      <div>
        <label>Send crimcoin:</label>
        <input
          type="text"
          ref={sendAddress}
          placeholder="Recipient's public key"
        />
        <input type="text" ref={amountField} placeholder="Amount" />
        <button onClick={submitTransaction}>Send</button>
      </div>
    </div>
  );
}

export default App;
