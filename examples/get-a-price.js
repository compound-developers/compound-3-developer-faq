const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const networks = require('./addresses.json');
const net = 'kovan';

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const myContractAbi = [
  'function getCompoundPrice(address priceFeed) public view returns (uint)',
];

const cometAbi = [
  'function getPrice(address priceFeed) public view returns (uint)',
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

describe("Find out an asset's present price according to Compound III", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
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

  it('Finds the price of WBTC and USDC', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);
    const wbtc = networks[net].WBTC;
    const wbtcPriceFeed = networks[net].WBTC_Price_Feed;
    const usdc = networks[net].USDC;
    const usdcPriceFeed = networks[net].USDC_Price_Feed;

    let wbtcPrice = await comet.callStatic.getPrice(wbtcPriceFeed);
    wbtcPrice /= Math.pow(10, 8);

    let usdcPrice = await comet.callStatic.getPrice(usdcPriceFeed);
    usdcPrice /= Math.pow(10, 8);

    console.log('\tWBTC Price', wbtcPrice);
    console.log('\tUSDC Price', usdcPrice);
  });

  it('Runs the solidity examples', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const wbtcPriceFeed = '0x6135b13325bfC4B00278B4abC5e20bbce2D6580e';
    const usdcPriceFeed = '0x9211c6b3bf41a10f78539810cf5c64e1bb78ec60';

    let wbtcPrice = await MyContract.callStatic.getCompoundPrice(wbtcPriceFeed);
    wbtcPrice /= Math.pow(10, 8);

    let usdcPrice = await MyContract.callStatic.getCompoundPrice(usdcPriceFeed);
    usdcPrice /= Math.pow(10, 8);

    console.log('\tSolidity - WBTC Price', wbtcPrice);
    console.log('\tSolidity - USDC Price', usdcPrice);
  });
});
