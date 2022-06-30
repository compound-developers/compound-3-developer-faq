const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const { resetForkedChain } = require('./common.js');
const networks = require('./addresses.json');
const net = 'kovan';

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const cometAbi = [
  'event Supply(address indexed from, address indexed dst, uint256 amount)',
  'function balanceOf(address account) returns (uint256)',
];

const baseAbi = [
  'function decimals() returns (uint)'
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

describe("Find an account's Compound III base asset interest earned", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    baseAssetAddress = networks[net].USDC;
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

  // This example only works for accounts that have not ever borrowed
  it('Finds the interest earned of base asset using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const base = new ethers.Contract(baseAssetAddress, baseAbi, provider);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const myAddress = addresses[0];

    const balance = await comet.callStatic.balanceOf(myAddress);

    const eventFilterSupply = comet.filters.Supply(myAddress);
    const eventsSupply = await comet.queryFilter(eventFilterSupply);

    let principal = 0;
    eventsSupply.forEach((event) => {
      principal += +event.args[1].toString();
    });

    const decimals = await base.callStatic.decimals();
    const interest = (balance - principal) / Math.pow(10, +decimals.toString());

    console.log('\tInterest', interest);
  });
});
