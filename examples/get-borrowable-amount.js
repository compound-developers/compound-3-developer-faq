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
  'function getBorrowableAmount(address account) external view returns (int)',
];

const cometAbi = [
  'function numAssets() returns (uint8)',
  'function getAssetInfo(uint8 i) public view returns (tuple(uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap) memory)',
  'function collateralBalanceOf(address account, address asset) external view returns (uint128)',
  'function getPrice(address priceFeed) public view returns (uint128)',
  'function baseTokenPriceFeed() public view returns (address)',
  'function borrowBalanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint)',
  'function userBasic(address) public returns (tuple(int104 principal, uint64 baseTrackingIndex, uint64 baseTrackingAccrued, uint16 assetsIn, uint8 _reserved) memory)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, baseAssetPriceFeed;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Find an account's present limits on borrowing from Compound III", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    cometAddress = networks[net].comet;
    baseAssetPriceFeed = networks[net].USDC_Price_Feed;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Calculates the borrow capacity of an account that has supplied collateral using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const myAddress = addresses[0];

    const numAssets = await comet.callStatic.numAssets();

    const promisesAssets = [];
    for (let i = 0; i < numAssets; i++) {
      promisesAssets.push(comet.callStatic.getAssetInfo(i));
    }

    const infos = await Promise.all(promisesAssets);
    
    const promisesCollaterals = [];
    const promisesDecimals = [];
    const promisesPrices = [];
    for (let i = 0; i < numAssets; i++) {
      const { asset, priceFeed } = infos[i];
      promisesCollaterals.push(comet.callStatic.collateralBalanceOf(myAddress, asset));
      promisesPrices.push(comet.callStatic.getPrice(priceFeed));
    }

    const collateralBalances = await Promise.all(promisesCollaterals);
    const collateralPrices = await Promise.all(promisesPrices);

    const baseTokenPriceFeed = await comet.callStatic.baseTokenPriceFeed();
    const basePrice = +(await comet.callStatic.getPrice(baseTokenPriceFeed)).toString() / 1e8;
    const baseDecimals = +(await comet.callStatic.decimals()).toString();

    let collateralValueUsd = 0;
    let totalBorrowCapacityUsd = 0;
    for (let i = 0; i < numAssets; i++) {
      const balance = +(collateralBalances[i].toString()) / +(infos[i].scale).toString();
      const price = +collateralPrices[i].toString() / 1e8;
      collateralValueUsd += balance * price;
      totalBorrowCapacityUsd += balance * price * (+infos[i].borrowCollateralFactor.toString() / 1e18);
    }

    const borrowBalance = +(await comet.callStatic.borrowBalanceOf(myAddress)).toString();
    const borrowedInUsd = borrowBalance / Math.pow(10, baseDecimals) * basePrice;

    const borrowCapacityUsd = totalBorrowCapacityUsd - borrowedInUsd;

    console.log('\tMaximum borrowable amount (USD)', borrowCapacityUsd);
    console.log('\tAlready Borrowed amount (USD)', borrowedInUsd);

    const borrowCapacityBase = borrowCapacityUsd / basePrice;
    const borrowedInBase = borrowedInUsd / basePrice
    console.log('\tMaximum borrowable amount (base)', borrowCapacityBase);
    console.log('\tAlready Borrowed amount (base)', borrowedInBase);
  });

  it('Calculates the borrow capacity of an account that has supplied collateral using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const myAddress = addresses[0];
    let borrowable = await  MyContract.callStatic.getBorrowableAmount(myAddress);
    borrowable /= Math.pow(10, 8);

    console.log('\tSolidity - Base asset borrowable amount', borrowable);
  });

});
