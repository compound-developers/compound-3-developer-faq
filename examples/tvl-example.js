const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = hre.config.cometInstance;

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const myContractAbi = [
  'function getTvl() public view returns (uint)',
];

const cometAbi = [
  'function numAssets() returns (uint8)',
  'function getAssetInfo(uint8 i) public view returns (tuple(uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap) memory)',
  'function totalsCollateral(address) returns (uint128 totalSupplyAsset, uint128 _reserved)',
  'function totalSupply() returns (uint)',
  'function decimals() returns (uint8)',
  'function baseTokenPriceFeed() returns (address)',
  'function getPrice(address) public view returns (uint128)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory;

describe('Calculating the Compound III APRs', function () {
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
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Calculates the TVL in USD of Compound III using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const numAssets = await comet.callStatic.numAssets();

    const promisesAssets = [];
    for (let i = 0; i < numAssets; i++) {
      promisesAssets.push(comet.callStatic.getAssetInfo(i));
    }

    const assetInfos = await Promise.all(promisesAssets);

    const promisesPrices = [];
    const promisesLocked = [];
    for (let i = 0; i < numAssets; i++) {
      const { asset, priceFeed } = assetInfos[i];
      promisesLocked.push(comet.callStatic.totalsCollateral(asset));
      promisesPrices.push(comet.callStatic.getPrice(priceFeed));
    }

    const prices = await Promise.all(promisesPrices);
    const lockedAmounts = await Promise.all(promisesLocked);

    const baseScale = Math.pow(10, +(await comet.callStatic.decimals()).toString());
    const basePf = await comet.callStatic.baseTokenPriceFeed();
    const basePrice = +(await comet.callStatic.getPrice(basePf)).toString() / 1e8; // price feed 8 decimals
    const totalSupplyBase = +(await comet.callStatic.totalSupply()).toString() / baseScale;

    let tvlUsd = totalSupplyBase * basePrice;

    for (let i = 0; i < numAssets; i++) {
      const price = +prices[i].toString() / 1e8; // price feed 8 decimals
      const locked = +lockedAmounts[i].totalSupplyAsset.toString() / +assetInfos[i].scale.toString();
      tvlUsd += price * locked;
    }

    console.log('\tJS - Compound III TVL in USD', tvlUsd);

  });

  it('Calculates the TVL in USD of Compound III using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const tvlUsd = +(await MyContract.callStatic.getTvl()).toString() / 1e8; // price feed 8 decimals

    console.log('\tSolidity - Compound III TVL in USD', tvlUsd);
  });
});
