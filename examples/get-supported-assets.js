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
  const arrayCopy = this;
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
];

const cometAbi = [
  `function getAssetInfo(uint8 i) virtual public view returns (
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

describe("Finds asset info for an instance of Compound III", function () {
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

  it('Finds all assets supported by a Comet instance using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    function logCollateralAssetInfos() {
      return new Promise(async (resolve, reject) => {
        const indexes = [];
        const numAssets = +(await comet.callStatic.numAssets()).toString();
        for (let i = 0; i < numAssets; i++) indexes.push(i);
        indexes.forEachWithCallback(async (i, x, done) => {
          const collateralAssetInfo = await comet.callStatic.getAssetInfo(i);
          console.log('Collateral Asset Info', i, collateralAssetInfo);
          done();
        }, resolve);
      });
    }

    await logCollateralAssetInfos();

    console.log('Base asset info:');
    console.log('baseBorrowMin \t\t', (await comet.callStatic.baseBorrowMin()).toString());
    console.log('baseMinForRewards \t', (await comet.callStatic.baseMinForRewards()).toString());
    console.log('baseScale \t\t', (await comet.callStatic.baseScale()).toString());
    console.log('baseToken \t\t', (await comet.callStatic.baseToken()).toString());
    console.log('baseTokenPriceFeed \t', (await comet.callStatic.baseTokenPriceFeed()).toString());
    console.log('baseTrackingBorrowSpeed ', (await comet.callStatic.baseTrackingBorrowSpeed()).toString());
    console.log('baseTrackingSupplySpeed ', (await comet.callStatic.baseTrackingSupplySpeed()).toString());
  });

  it('Finds all assets supported by a Comet instance using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(addresses[0]);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, signer);

    let trx = await MyContract.getAllAssetInfos();
    const receipt = await trx.wait(1);
    console.log('\tSolidity:');

    receipt.events.forEach((event) => {
      console.log(event.args);
    });
  });
});
