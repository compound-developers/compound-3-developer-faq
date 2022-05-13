require('@nomiclabs/hardhat-ethers');

// const providerUrl = process.env.FUJI_PROVIDER_URL;
// const blockNumber = 6184762;

const providerUrl = process.env.KOVAN_PROVIDER_URL;
const blockNumber = 31572260;

if (!providerUrl) {
  console.error('Missing JSON RPC provider URL as environment variable `FUJI_PROVIDER_URL`');
  process.exit(1);
}

module.exports = {
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
    //// AVAX TESTNET
    // hardhat: {
    //   chainId: 1, // 43113
    //   forking: {
    //     url: providerUrl,
    //     blockNumber,
    //   },
    //   gasPrice: 0,
    //   initialBaseFeePerGas: 0,
    //   loggingEnabled: false,
    //   accounts: {
    //     mnemonic: 'romance zebra roof insect stem water kiwi park acquire domain gossip second',
    //   },
    // },

    //// KOVAN
    hardhat: {
      chainId: 42,
      forking: {
        url: providerUrl,
        blockNumber,
      },
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      loggingEnabled: false,
      accounts: {
        mnemonic: 'romance zebra roof insect stem water kiwi park acquire domain gossip second',
      },
    },
  },
  mocha: {
    timeout: 60000
  }
};
