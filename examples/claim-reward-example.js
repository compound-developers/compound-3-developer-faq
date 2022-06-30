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

const myContractAbi = [
  'function getRewardsOwed(address rewardsContract) public view returns (uint)',
  'function claimCometRewards(address rewardsContract) public',
];

const rewardAbi = [
  'function getRewardOwed(address comet, address account) external returns (address token, uint owed)',
  'function claim(address comet, address src, bool shouldAccrue) external',
];

let jsonRpcServer, deployment, cometAddress, rewardsAddress, compAddress, myContractFactory;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Reward token operations for Compound III", function () {
  before(async () => {
    console.log('\n    Running a hardhat local evm fork of a public net...\n');

    jsonRpcServer = await hre.run(TASK_NODE_CREATE_SERVER, {
      hostname: 'localhost',
      port: 8545,
      provider: hre.network.provider
    });

    await jsonRpcServer.listen();

    cometAddress = networks[net].comet;
    rewardsAddress = networks[net].rewards;
    compAddress = networks[net].COMP;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Gets the current amount of reward token due to an account using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const rewards = new ethers.Contract(rewardsAddress, rewardAbi, provider);

    const [ tokenAddress, amount ] = await rewards.callStatic.getRewardOwed(cometAddress, addresses[0]);
    const compTokenMantissa = 1e18;

    console.log('\tReward token is COMP', tokenAddress === compAddress);

    console.log('\tJS - COMP token rewards due to the account', +amount.toString() / compTokenMantissa);
  });

  it('Claims and transfers the current amount of reward token due to an account using JS', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(addresses[0]);
    const rewards = new ethers.Contract(rewardsAddress, rewardAbi, signer);

    let tx = await rewards.claim(cometAddress, addresses[0], true);
    await tx.wait(1);

    // If due rewards, check to see if the account's COMP balance increased

    console.log('\tJS - COMP tokens claimed and transferred to the account');
  });

  it('Runs rewards examples using Solidity', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(addresses[0]);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, signer);

    const amount = await MyContract.callStatic.getRewardsOwed(rewardsAddress);
    const compTokenMantissa = 1e18;
    console.log('\tSolidity - COMP token rewards due to the account', +amount.toString() / compTokenMantissa);

    let tx = await MyContract.claimCometRewards(rewardsAddress);
    await tx.wait(1);
    console.log('\tSolidity - Reward tokens successfully claimed for contract.');
  });
});
