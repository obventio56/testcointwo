const crypto = window.require("crypto");
const electron = window.require("electron");
const fs = window.require("fs");
const path = window.require("path");

const {
  remote: { app }
} = electron;

const HASH_ALG = "sha256";
const CONFIG_FILE = "config.json";

const getConfigPath = () => path.join(app.getPath("userData"), CONFIG_FILE);

const readConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath()));
  } catch {
    return {};
  }
};

const writeConfig = data => {
  const oldData = readConfig();
  fs.writeFileSync(getConfigPath(), JSON.stringify({ ...oldData, ...data }));
};

const getPrivateKey = () => {
  return readConfig().privateKey;
};

const getPublicKey = () => {
  return pubFromPriv(readConfig().privateKey);
};

const compareBuffer = (target, test) => {
  for (let i = test.length - 1; i >= 0; i--) {
    if (test[i] < target[i]) {
      break;
    }
    if (test[i] > target[i]) {
      return false;
    }
  }
  return true;
};

const digest = (data, stringify = true) => {
  const hash = crypto.createHash(HASH_ALG);
  const serializedData = stringify ? JSON.stringify(data) : data;

  //console.log("stringified", serializedData);

  hash.update(serializedData);
  return hash.digest("hex");
};

const pubFromPriv = privateKey => {
  return importPubFromPriv(privateKey)
    .export({
      type: "spki",
      format: "der"
    })
    .toString("hex");
};

const importPubFromPriv = privateKey => {
  return crypto.createPublicKey({
    key: Buffer.from(privateKey, "hex"),
    format: "der",
    type: "sec1"
  });
};

const importPrivateKey = privateKey => {
  return crypto.createPrivateKey({
    key: Buffer.from(privateKey, "hex"),
    format: "der",
    type: "sec1"
  });
};

const importPublicKey = publicKey => {
  return crypto.createPublicKey({
    key: Buffer.from(publicKey, "hex"),
    format: "der",
    type: "spki"
  });
};

const sign = (privateKey, data) => {
  const keyObj = importPrivateKey(privateKey);
  const sign = crypto.createSign("SHA256");
  sign.write(data);
  sign.end();
  return sign.sign(keyObj, "hex");
};

const verify = (publicKey, data, signature) => {
  const keyObj = importPublicKey(publicKey);
  const verify = crypto.createVerify("SHA256");
  verify.write(data);
  verify.end();
  return verify.verify(keyObj, signature, "hex");
};

const generateKeyPair = async () =>
  new Promise((resolve, reject) =>
    crypto.generateKeyPair(
      "ec",
      {
        publicKeyEncoding: {
          type: "spki",
          format: "der"
        },
        privateKeyEncoding: {
          type: "sec1",
          format: "der"
        },
        namedCurve: "P-256"
      },
      (err, publicKey, privateKey) => {
        if (err) reject(err);

        resolve({
          publicKey: publicKey.toString("hex"),
          privateKey: privateKey.toString("hex")
        });
      }
    )
  );

export {
  digest,
  generateKeyPair,
  sign,
  verify,
  readConfig,
  writeConfig,
  importPubFromPriv,
  pubFromPriv,
  compareBuffer,
  getPrivateKey,
  getPublicKey
};
