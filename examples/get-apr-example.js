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
  'function getSupplyApr() public view returns (uint)',
  'function getBorrowApr() public view returns (uint)',
];

const cometAbi = [
  'function getSupplyRate() public view returns (uint)',
  'function getBorrowRate() public view returns (uint)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory;

describe('Calculating the Compound III APRs', function () {
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
    await resetForkedChain();
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Calculates the Supply APR using JavaScript', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const supplyApr = await comet.callStatic.getSupplyRate();
    console.log('\tJS - Supply APR', +(supplyApr).toString() / 1e18 * 100, '%');
  });

  it('Calculates the Borrow APR using JavaScript', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const comet = new ethers.Contract(cometAddress, cometAbi, provider);

    const supplyApr = await comet.callStatic.getBorrowRate();
    console.log('\tJS - Borrow APR', +(supplyApr).toString() / 1e18 * 100, '%');
  });

  it('Runs the solidity examples', async () => {

    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, provider);

    const supplyApr = await MyContract.callStatic.getSupplyApr();
    const borrowApr = await MyContract.callStatic.getBorrowApr();

    console.log('\tSolidity - Supply APR:', +(supplyApr).toString() / 1e18 * 100, '%');
    console.log('\tSolidity - Borrow APR:', +(borrowApr).toString() / 1e18 * 100, '%');
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
