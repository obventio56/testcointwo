const crypto = require("crypto");

/*
const curve = crypto.createECDH("secp521r1");
curve.generateKeys();

const dehydratedPublic = curve.getPublicKey("hex", "compressed");
const dehydratedPrivate = curve.getPublicKey("hex");


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
    console.log(publicKey, privateKey);

    const dehydratedPublic = publicKey.toString("hex");
    const dehydratedPrivate = privateKey.toString("hex");

    console.log(dehydratedPublic, dehydratedPrivate);

    const privateBuffer = Buffer.from(dehydratedPrivate, "hex");
    const publicBuffer = Buffer.from(dehydratedPublic, "hex");

    const rehydratedPrivate = crypto.createPrivateKey({
      key: privateBuffer,
      format: "der",
      type: "sec1"
    });

    const rehydratedPublic = crypto.createPublicKey({
      key: publicBuffer,
      format: "der",
      type: "spki"
    });

    console.log(rehydratedPrivate, rehydratedPublic);

    data = "abc123";

    const sign = crypto.createSign("SHA256");
    sign.write(data);
    sign.end();
    const signature = sign.sign(rehydratedPrivate, "hex");

    const verify = crypto.createVerify("SHA256");
    verify.write(data);
    verify.end();
    console.log(verify.verify(rehydratedPublic, signature, "hex"));
  }
);



*/

/*

*/

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

(async () => {
  console.log(await generateKeyPair());
})();
