const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

function forEachWithCallback(callback, after) {
  const arrayCopy = JSON.parse(JSON.stringify(this));
  let index = 0;
  const next = () => {
    index++;
    if (arrayCopy.length > 0) {
      callback(arrayCopy.shift(), index, next);
    } else {
      if (after) after();
    }
  }
  next();
}

Array.prototype.forEachWithCallback = forEachWithCallback;

const myContractAbi = [
  'function getAllAssetInfos() public',
  `event AssetInfoLog(tuple(
    uint8 offset,
    address asset,
    address priceFeed,
    uint64 scale,
    uint64 borrowCollateralFactor,
    uint64 liquidateCollateralFactor,
    uint64 liquidationFactor,
    uint128 supplyCap
  ))`,
  'event LogUint(string, uint)',
  'event LogAddress(string, address)',

  'function getPriceFeedAddress(address asset) public view returns (address)',
  'function getBaseTokenPriceFeed() public view returns (address)'
];

const cometAbi = [
  `function getAssetInfo(uint8 i) public view returns (
    tuple(
      uint8 offset,
      address asset,
      address priceFeed,
      uint64 scale,
      uint64 borrowCollateralFactor,
      uint64 liquidateCollateralFactor,
      uint64 liquidationFactor,
      uint128 supplyCap
    ) memory
  )`,

  `function getAssetInfoByAddress(address) public view returns (
    tuple(
      uint8 offset,
      address asset,
      address priceFeed,
      uint64 scale,
      uint64 borrowCollateralFactor,
      uint64 liquidateCollateralFactor,
      uint64 liquidationFactor,
      uint128 supplyCap
    ) memory
  )`,

  'function baseBorrowMin() returns (uint)',
  'function baseMinForRewards() returns (uint)',
  'function baseScale() returns (uint)',
  'function baseToken() returns (address)',
  'function baseTokenPriceFeed() returns (address)',
  'function baseTrackingBorrowSpeed() returns (uint)',
  'function baseTrackingSupplySpeed() returns (uint)',

  'function numAssets() returns (uint)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Finds asset price feeds for an instance of Compound III", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: '127.0.0.1',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    cometAddress = networks[net].comet;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Finds asset price feeds supported by a Comet instance using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    wbtcAddress = networks[net].WBTC;

    // If you don't already have the asset address, use `getAssetInfo`
    // see `get-supported-assets.js` example file

    const priceFeed = (await comet.callStatic.getAssetInfoByAddress(wbtcAddress)).priceFeed;
    console.log('\tJS - WBTC Price Feed', priceFeed);
    console.log('\tJS - baseTokenPriceFeed', (await comet.callStatic.baseTokenPriceFeed()).toString());
  });

  it('Finds asset price feeds supported by a Comet instance using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(addresses[0]);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, signer);

    wbtcAddress = networks[net].WBTC;

    // If you don't already have the asset address, use `getAssetInfo`
    // see `get-supported-assets.js` example file

    const priceFeedAddress = await MyContract.callStatic.getPriceFeedAddress(wbtcAddress);
    const baseTokenPriceFeed = await MyContract.callStatic.getBaseTokenPriceFeed();

    console.log('\tSolidity - WBTC Price Feed', priceFeedAddress);
    console.log('\tSolidity - baseTokenPriceFeed', baseTokenPriceFeed);
  });
});
