require('@nomiclabs/hardhat-ethers');

// Choose the Comet instance to run tests against using the `connections` object
const cometInstance = 'usdc-mainnet';

// Optionally, you can hardcode provider URLs here
const connections = {
  'usdc-mainnet': {
    providerUrl: process.env.MAINNET_PROVIDER_URL,
    // blockNumber: 15415000, // 2022-08-26T11:06:22.000Z
    blockNumber: 16192000, // 2022-12-15T18:51:47.000Z
    chainId: 1,
  },
  'usdc-goerli': {
    providerUrl: process.env.GOERLI_PROVIDER_URL,
    blockNumber: 8141000, // 2022-12-15T19:00:48.000Z
    chainId: 5,
  },
  // 'usdc-kovan': { // Consider this entire testnet deprecated
  //   providerUrl: process.env.KOVAN_PROVIDER_URL,
  //   blockNumber: 33218700,
  //   chainId: 42,
  // },
  'usdc-fuji': { // Warning, Fuji instance is not properly configured on chain
    providerUrl: process.env.FUJI_PROVIDER_URL,
    blockNumber: 6184762,
    chainId: 1, // 43113
  }
};

const { providerUrl, blockNumber, chainId } = connections[cometInstance];

if (!providerUrl) {
  console.error('Cannot connect to the blockchain.');
  console.error('Add a provider URL in the hardhat.config.js file.');
  process.exit(1);
}

// Do not use this mnemonic outside of localhost tests!
const mnemonic = 'romance zebra roof insect stem water kiwi park acquire domain gossip second';

if (!providerUrl) {
  console.error('Missing JSON RPC provider URL as environment variable. See hardhat.config.js.');
  process.exit(1);
}

module.exports = {
  cometInstance, // this tells the test scripts which addresses to use
  testProviderUrl: providerUrl,
  testBlockNumber: blockNumber,
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  networks: {
    hardhat: {
      chainId,
      forking: {
        url: providerUrl,
        blockNumber,
      },
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      loggingEnabled: false,
      accounts: {
        mnemonic
      },
    },
  },
  mocha: {
    timeout: 60000
  }
};
