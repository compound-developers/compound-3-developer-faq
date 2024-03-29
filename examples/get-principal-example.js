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
  'event Withdraw(address indexed src, address indexed to, uint256 amount)',
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

describe("Find an account's Compound III principal base asset supplied", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: '127.0.0.1',
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

  it('Finds the original supplied amount of base asset using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const base = new ethers.Contract(baseAssetAddress, baseAbi, provider);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const myAddress = addresses[0];
    const eventFilterSupply = comet.filters.Supply(myAddress);
    const eventFilterWithdraw = comet.filters.Withdraw(myAddress);
    const eventsSupply = await comet.queryFilter(eventFilterSupply);
    const eventsWithdraw = await comet.queryFilter(eventFilterWithdraw);

    let principal = 0;
    eventsSupply.forEach((event) => {
      principal += +event.args[1].toString();
    });

    eventsWithdraw.forEach((event) => {
      principal -= +event.args[0].toString();
    });

    const decimals = await base.callStatic.decimals();
    principal = principal / Math.pow(10, +decimals.toString());

    console.log('\tPrincipal', principal);
  });
});
