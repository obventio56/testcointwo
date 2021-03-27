useEffect(() => {

    const generateKeys = async () => {

      crypto.generateKeyPair('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: {
          type: 'spki',
          format: 'der'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'der'
        }
      }, (err, publicKey, privateKey) => {

        const pub = Buffer.from(publicKey).toString('hex');
        const priv = Buffer.from(privateKey).toString('hex');

        console.log(pub, priv)
      })
      
    }

    generateKeys()

  }, []) 