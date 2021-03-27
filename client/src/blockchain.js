import genesisBlock from './genisis'

class Block {

    index;
    hash;
    previousHash;
    timestamp;
    data;

    constructor({ index, hash, previousHash, timestamp, data }) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
    }

    toJSON() {
        return {
            index: this.index,
            previousHash: this.previousHash,
            timestamp: this.timestamp,
            data: this.data,
            hash: this.hash,
        }
    }

    toObject() {
        return {
            index: this.index,
            previousHash: this.previousHash,
            timestamp: this.timestamp,
            data: this.data,
            hash: this.hash,
        }
    }
}

const isValidBlockStructure = (block) => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};

const calculateHash = (index, previousHash, timestamp, data) => {
    return crypto.subtle.digest('SHA-256', `${index}${previousHash}${timestamp}${JSON.stringify(data)}`)
}

const calculateHashForBlock = (block) => calculateHash(block.index, block.previousHash, block.timestamp, block.data);

const isValidNextBlock = (previousBlock, newBlock) => {

    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid structure');
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    }
    return true;
};

const calculateDifficulty = (blocks) => {
    return blocks
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
}

class Blockchain {
    blocks;
    difficulty;

    constructor(blocks = []) {
        this.blocks = blocks
        this.difficulty = calculateDifficulty(blocks)       
    }

    get currentIndex()  {
        return blocks.length - 1 || 0
    }

    get previousBlock() {
        return this.blocks[this.currentIndex]
    }

    isValidNewBlock(block) {
        return isValidNextBlock(this.previousBlock, block)
    }

    isValidChain(fromIndex = 0) {
        const blockchainToValidate = this.blocks

        const isValidGenesis = (block) => {
            return JSON.stringify(block) === JSON.stringify(genesisBlock);
        };
    
        if (fromIndex === 0 && !isValidGenesis(blockchainToValidate[0])) {
            return false;
        }
    
        for (let i = (fromIndex || 1); i < blockchainToValidate.length; i++) {
            if (!isValidNextBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
                return false;
            }
        }
        return true;
    };

    get version() {
        return {
            index: this.previousBlock.index,
            hash: this.previousBlock.hash
        }
    }


    checkVersion(headers) {
        if (headers.index > this.previousBlock.index) return 'newer'
        if (headers.index < this.previousBlock.index) return 'older'
        if (headers.hash === previousBlock.hash) return 'matches'
        return 'competitor'
    }

    replaceBlockchain(blocks, difficulty = false) {
        this.blocks = blocks
        if (difficulty) {
            this.difficulty = difficulty
        } else {
            this.difficulty = calculateDifficulty(blocks)
        }
    }

    addBlock(blockObj) {
        const newBlock = new Block(blockObj)
        const isValidAddition = isValidNextBlock(this.previousBlock, newBlock)
        if (isValidAddition) {
            this.difficulty += calculateDifficulty([newBlock])
            this.blocks.push(newBlock)
        }
    }

    syncBlocks(blockObjs) {
        const newBlocks = blockObjs.map(bo => new Block(bo))

        const fromIndex = blocks[0].index
        const compBlockchain = new Blockchain([...this.blocks.slice(0,1), ...newBlocks])

        if (compBlockchain.isValidChain(fromIndex)) {
            if (compBlockchain.difficulty > this.difficulty) {
                this.replaceBlockchain(compBlockchain)
                return true
            }
        }

        return false
    }
}


/*
const generateNextBlock = (data) => {
    const previousBlock = blockchain[blockchain.length - 1]
    const nextIndex = previousBlock.index + 1
    const nextTimestamp = new Date().getTime();
    const nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, data)
    return new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, data)
}
*/

export default { Block, Blockchain }

/*

if thier index is higher, request new blocks and compare
    if more than n blocks (bootstraping):
        1. request chunk of size n
        2. version

if their index is the same but different hash, continue on
if their index is less than yours, they will ask you

if new block of higher index, request it
if new block of same or lower index, ignore it

if new transaction: add if you don't already have


*/