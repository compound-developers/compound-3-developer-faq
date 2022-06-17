const assert = require('assert');
const { TASK_NODE_CREATE_SERVER } = require('hardhat/builtin-tasks/task-names');
const hre = require('hardhat');
const ethers = require('ethers');
const networks = require('./addresses.json');
const net = 'kovan';

const jsonRpcUrl = 'http://127.0.0.1:8545';
const providerUrl = hre.config.networks.hardhat.forking.url;
const blockNumber = hre.config.networks.hardhat.forking.blockNumber;

const cometAbi = [
  'event Supply(address indexed from, address indexed dst, uint256 amount)',
  'function supply(address asset, uint amount)',
  'function withdraw(address asset, uint amount)',
  'function balanceOf(address account) returns (uint256)',
  'function borrowBalanceOf(address account) returns (uint256)',
  'function collateralBalanceOf(address account, address asset) external view returns (uint128)',
];

const wethAbi = [
  'function deposit() payable',
  'function balanceOf(address) returns (uint)',
  'function approve(address, uint) returns (bool)',
];

const stdErc20Abi = [
  'function approve(address, uint) returns (bool)',
  'function transfer(address, uint)',
];

let jsonRpcServer, deployment, cometAddress, myContractFactory, baseAssetAddress, wethAddress;

const mnemonic = hre.network.config.accounts.mnemonic;
const addresses = [];
const privateKeys = [];
for (let i = 0; i < 20; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
  addresses.push(wallet.address);
  privateKeys.push(wallet._signingKey().privateKey);
}

describe("Repay an entire Compound III account's borrow", function () {
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
    cometAddress = networks[net].comet;
    wethAddress = networks[net].WETH;
    myContractFactory = await hre.ethers.getContractFactory('MyContract');
  });

  beforeEach(async () => {
    await resetForkedChain();
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Repays an entire borrow without missing latest block interest', async () => {
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(addresses[0]);
    const comet = new ethers.Contract(cometAddress, cometAbi, signer);
    const weth = new ethers.Contract(wethAddress, wethAbi, signer);
    const usdc = new ethers.Contract(usdcAddress, stdErc20Abi, signer);

    let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
    await tx.wait(1);

    console.log('Approving Comet to move WETH collateral...');
    tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
    await tx.wait(1);

    console.log('Sending initial supply to Compound...');
    tx = await comet.supply(wethAddress, ethers.utils.parseEther('10'));
    await tx.wait(1);

    const borrowSize = 1000; // baseBorrowMin is 1000 USDC
    console.log('Executing initial borrow of the base asset from Compound...');
    console.log('Borrow size:', borrowSize);

    tx = await comet.withdraw(usdcAddress, (borrowSize * 1e6).toString());
    await tx.wait(1);

    let borrowBalance = await comet.callStatic.borrowBalanceOf(addresses[0]);
    console.log('borrowBalance 1', +borrowBalance.toString() / 1e6);

    // accrue some interest
    await advanceBlockHeight(100);

    borrowBalance = await comet.callStatic.borrowBalanceOf(addresses[0]);
    console.log('borrowBalance 2', +borrowBalance.toString() / 1e6);

    // For example purposes, get extra USDC so we can pay off the accrued 
    //     borrower interest
    await seedWithBaseToken(addresses[0], 5);

    tx = await usdc.approve(cometAddress, ethers.constants.MaxUint256);
    await tx.wait(1);

    console.log('Repaying the entire borrow...');
    tx = await comet.supply(usdcAddress, ethers.constants.MaxUint256);
    await tx.wait(1);

    borrowBalance = await comet.callStatic.borrowBalanceOf(addresses[0]);
    console.log('borrowBalance 3', +borrowBalance.toString() / 1e6);
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

async function advanceBlockHeight(blocks) {
  const txns = [];
  for (let i = 0; i < blocks; i++) {
    txns.push(hre.network.provider.send('evm_mine'));
  }
  await Promise.all(txns);
}

// Test account index 9 uses Comet to borrow and then seed the toAddress with tokens
async function seedWithBaseToken(toAddress, amt) {
  const baseTokenDecimals = 6; // USDC
  const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
  const signer = provider.getSigner(addresses[9]);
  const comet = new ethers.Contract(cometAddress, cometAbi, signer);
  const weth = new ethers.Contract(wethAddress, wethAbi, signer);
  const usdc = new ethers.Contract(usdcAddress, stdErc20Abi, signer);

  let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
  await tx.wait(1);

  tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
  await tx.wait(1);

  tx = await comet.supply(wethAddress, ethers.utils.parseEther('10'));
  await tx.wait(1);

  // baseBorrowMin is 1000 USDC
  tx = await comet.withdraw(usdcAddress, (1000 * 1e6).toString());
  await tx.wait(1);

  // transfer from this account to the main test account (0th)
  tx = await usdc.transfer(toAddress, (amt * 1e6).toString());
  await tx.wait(1);

  return;
}