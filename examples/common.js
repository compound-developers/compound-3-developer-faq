module.exports = {
  resetForkedChain: async function (hre, providerUrl, blockNumber) {
    // Parent directory's hardhat.config.js needs these to be set
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [{
        forking: {
          jsonRpcUrl: providerUrl,
          blockNumber,
        },
        gasPrice: 0,
        initialBaseFeePerGas: 0,
      }]
    });
  }
};