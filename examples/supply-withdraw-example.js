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
  'function supply(address asset, uint amount) public',
  'function withdraw(address asset, uint amount) public',
];

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
  'function transfer(address, uint)',
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

describe("Compound III Supply Examples", function () {
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
    await resetForkedChain(hre, providerUrl, blockNumber);
    deployment = await myContractFactory.deploy(cometAddress);
  });

  after(async () => {
    await jsonRpcServer.close();
  });

  it('Supplies collateral and then withdraws it using JS', async () => {
    const me = addresses[0];
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(me);
    const comet = new ethers.Contract(cometAddress, cometAbi, signer);
    const weth = new ethers.Contract(wethAddress, wethAbi, signer);
    const wethMantissa = 1e18; // WETH and ETH have 18 decimal places

    let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
    await tx.wait(1);

    console.log('\tApproving Comet to move WETH collateral...');
    tx = await weth.approve(cometAddress, ethers.constants.MaxUint256);
    await tx.wait(1);

    console.log('\tSending initial supply to Compound...');
    tx = await comet.supply(wethAddress, ethers.utils.parseEther('10'));
    await tx.wait(1);

    let collateralBalance = await comet.callStatic.collateralBalanceOf(me, wethAddress);
    console.log('\tMy current WETH collateral balance:', +collateralBalance.toString() / wethMantissa);

    console.log('\tWithdrawing collateral from Compound...');
    tx = await comet.withdraw(wethAddress, ethers.utils.parseEther('10'));
    await tx.wait(1);

    collateralBalance = await comet.callStatic.collateralBalanceOf(me, wethAddress);
    console.log('\tMy current WETH collateral balance:', +collateralBalance.toString() / wethMantissa);
  });

  it('Supplies collateral and then withdraws it using Solidity', async () => {
    const me = addresses[0];
    const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);
    const signer = provider.getSigner(me);
    const comet = new ethers.Contract(cometAddress, cometAbi, signer);
    const MyContract = new ethers.Contract(deployment.address, myContractAbi, signer);
    const weth = new ethers.Contract(wethAddress, wethAbi, signer);
    const wethMantissa = 1e18; // WETH and ETH have 18 decimal places

    let tx = await weth.deposit({ value: ethers.utils.parseEther('10') });
    await tx.wait(1);

    console.log('\tMoving WETH from my wallet to MyContract...');
    tx = await weth.transfer(MyContract.address, ethers.utils.parseEther('10'));
    await tx.wait(1);

    console.log('\tSupplying WETH from MyContract to Compound...');
    tx = await MyContract.supply(wethAddress, ethers.utils.parseEther('3'));
    await tx.wait(1);

    // let wethBalance = await weth.callStatic.balanceOf(MyContract.address);
    // console.log("\tMyContract's current WETH balance:", +wethBalance.toString() / wethMantissa);

    // let collateralBalance = await comet.callStatic.collateralBalanceOf(MyContract.address, wethAddress);
    // console.log("\tMyContract's current WETH collateral balance:", +collateralBalance.toString() / wethMantissa);

    console.log('\tWithdrawing WETH collateral from Compound to MyContract...');
    tx = await MyContract.withdraw(wethAddress, ethers.utils.parseEther('3'));
    await tx.wait(1);

    // wethBalance = await weth.callStatic.balanceOf(MyContract.address);
    // console.log("\tMyContract's current WETH balance:", +wethBalance.toString() / wethMantissa);

    // collateralBalance = await comet.callStatic.collateralBalanceOf(MyContract.address, wethAddress);
    // console.log("\tMyContract's current WETH collateral balance:", +collateralBalance.toString() / wethMantissa);
  });
});
