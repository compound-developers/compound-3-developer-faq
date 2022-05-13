const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const networks = require('./addresses.json');
const net = 'kovan';

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
// const blockNumber = hre.config.networks.hardhat.forking.blockNumber;
const blockNumber = 9338786;

const cometAbi = [
  'event Supply(address indexed from, address indexed dst, uint256 amount)',
  'function balanceOf(address account) returns (uint256)',
];

const baseAbi = [
  'function decimals() returns (uint)'
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, usdcAddress;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Find a Compound III asset collateral factors", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    baseAssetAddress = networks[net].USDC;
    usdcAddress = baseAssetAddress;
    cometAddress = networks[net].comet;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain();
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Finds the collateral and liquidation factors for an asset', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const borrowCollateralFactor = (await comet.callStatic.getAssetInfoByAddress(usdcAddress)).borrowCollateralFactor;
    const liquidateCollateralFactor = (await comet.callStatic.getAssetInfoByAddress(usdcAddress)).liquidateCollateralFactor;

    console.log('borrowCollateralFactor', borrowCollateralFactor);
    console.log('liquidateCollateralFactor', liquidateCollateralFactor);
  });

  it('Runs the solidity examples', async () => {
    // TODO: awaiting getAssetInfoByAddress before creating this example
  });
});

async function resetForkedChain() {
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
