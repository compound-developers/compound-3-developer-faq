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

const cometAbi = [
  'event Supply(address indexed from, address indexed dst, uint256 amount)',
  'function balanceOf(address account) returns (uint256)',
  { "inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getAssetInfoByAddress","outputs":[{"components":[{"internalType":"uint8","name":"offset","type":"uint8"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"address","name":"priceFeed","type":"address"},{"internalType":"uint64","name":"scale","type":"uint64"},{"internalType":"uint64","name":"borrowCollateralFactor","type":"uint64"},{"internalType":"uint64","name":"liquidateCollateralFactor","type":"uint64"},{"internalType":"uint64","name":"liquidationFactor","type":"uint64"},{"internalType":"uint128","name":"supplyCap","type":"uint128"}],"internalType":"struct CometCore.AssetInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function" },
];

const myContractAbi = [
  'function getBorrowCollateralFactor(address asset) public view returns (uint)',
  'function getLiquidateCollateralFactor(address) public view returns (uint)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, usdcAddress, wbtcAddress;

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
    wbtcAddress = networks[net].WBTC;
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

  it('Finds the collateral and liquidation factors for an asset using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const borrowCollateralFactor = (await comet.callStatic.getAssetInfoByAddress(wbtcAddress)).borrowCollateralFactor;
    const liquidateCollateralFactor = (await comet.callStatic.getAssetInfoByAddress(wbtcAddress)).liquidateCollateralFactor;

    console.log('\tborrowCollateralFactor', +borrowCollateralFactor.toString() / 1e18 * 100);
    console.log('\tliquidateCollateralFactor', +liquidateCollateralFactor.toString() / 1e18 * 100);
  });

  it('Finds the collateral and liquidation factors for an asset using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const borrowCollateralFactor = (await MyContract.callStatic.getBorrowCollateralFactor(wbtcAddress));
    const liquidateCollateralFactor = (await MyContract.callStatic.getLiquidateCollateralFactor(wbtcAddress));

    console.log('\tSolidity - borrowCollateralFactor', +borrowCollateralFactor.toString() / 1e18 * 100);
    console.log('\tSolidity - liquidateCollateralFactor', +liquidateCollateralFactor.toString() / 1e18 * 100);
  });
});
