// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

library CometStructs {
  struct AssetInfo {
    uint8 offset;
    address asset;
    address priceFeed;
    uint64 scale;
    uint64 borrowCollateralFactor;
    uint64 liquidateCollateralFactor;
    uint64 liquidationFactor;
    uint128 supplyCap;
  }

  struct UserBasic {
    int104 principal;
    uint64 baseTrackingIndex;
    uint64 baseTrackingAccrued;
    uint16 assetsIn;
    uint8 _reserved;
  }

  struct TotalsBasic {
    uint64 baseSupplyIndex;
    uint64 baseBorrowIndex;
    uint64 trackingSupplyIndex;
    uint64 trackingBorrowIndex;
    uint104 totalSupplyBase;
    uint104 totalBorrowBase;
    uint40 lastAccrualTime;
    uint8 pauseFlags;
  }

  struct UserCollateral {
    uint128 balance;
    uint128 _reserved;
  }

  struct RewardOwed {
    address token;
    uint owed;
  }
}

interface Comet {
  function baseScale() external view returns (uint);
  function supply(address asset, uint amount) external;
  function withdraw(address asset, uint amount) external;

  function getSupplyRate(uint utilization) external view returns (uint);
  function getBorrowRate(uint utilization) external view returns (uint);

  function getAssetInfoByAddress(address asset) external view returns (CometStructs.AssetInfo memory);
  function getAssetInfo(uint8 i) external view returns (CometStructs.AssetInfo memory);


  function getPrice(address priceFeed) external view returns (uint128);

  function userBasic(address) external view returns (CometStructs.UserBasic memory);
  function totalsBasic() external view returns (CometStructs.TotalsBasic memory);
  function userCollateral(address, address) external view returns (CometStructs.UserCollateral memory);

  function baseTokenPriceFeed() external view returns (address);

  function numAssets() external view returns (uint8);

  function getUtilization() external view returns (uint);

  function baseTrackingSupplySpeed() external view returns (uint);
  function baseTrackingBorrowSpeed() external view returns (uint);

  function totalSupply() external view returns (uint256);
  function totalBorrow() external view returns (uint256);

  function baseIndexScale() external pure returns (uint64);
}

interface CometRewards {
  function getRewardOwed(address comet, address account) external returns (CometStructs.RewardOwed memory);
  function claim(address comet, address src, bool shouldAccrue) external;
}

interface ERC20 {
  function approve(address spender, uint256 amount) external returns (bool);
  function decimals() external returns (uint);
}

contract MyContract {
  address public cometAddress;
  uint constant public DAYS_PER_YEAR = 365;
  uint constant public SECONDS_PER_DAY = 60 * 60 * 24;
  uint constant public SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;
  uint public BASE_MANTISSA;
  uint public BASE_INDEX_SCALE;

  constructor(address _cometAddress) {
    cometAddress = _cometAddress;
    BASE_MANTISSA = Comet(cometAddress).baseScale();
    BASE_INDEX_SCALE = Comet(cometAddress).baseIndexScale();
  }

  /*
   * Supply an asset that this contract holds to Compound III
   */
  function supply(address asset, uint amount) public {
    ERC20(asset).approve(cometAddress, amount);
    Comet(cometAddress).supply(asset, amount);
  }

  /*
   * Withdraws an asset from Compound III to this contract
   */
  function withdraw(address asset, uint amount) public {
    Comet(cometAddress).withdraw(asset, amount);
  }

  /*
   * Get the current supply APR in Compound III
   */
  function getSupplyApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint utilization = comet.getUtilization();
    return comet.getSupplyRate(utilization) * SECONDS_PER_YEAR * 100;
  }

  /*
   * Get the current borrow APR in Compound III
   */
  function getBorrowApr() public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint utilization = comet.getUtilization();
    return comet.getBorrowRate(utilization) * SECONDS_PER_YEAR * 100;
  }

  /*
   * Get the current reward for supplying APR in Compound III
   * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
   * @return The reward APR in USD as a decimal scaled up by 1e18
   */
  function getRewardAprForSupplyBase(address rewardTokenPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint rewardTokenPriceInUsd = getCompoundPrice(rewardTokenPriceFeed);
    uint usdcPriceInUsd = getCompoundPrice(comet.baseTokenPriceFeed());
    uint usdcTotalSupply = comet.totalSupply();
    uint baseTrackingSupplySpeed = comet.baseTrackingSupplySpeed();
    uint rewardToSuppliersPerDay = baseTrackingSupplySpeed * SECONDS_PER_DAY * (BASE_INDEX_SCALE / BASE_MANTISSA);
    uint supplyBaseRewardApr = (rewardTokenPriceInUsd * rewardToSuppliersPerDay / (usdcTotalSupply * usdcPriceInUsd)) * DAYS_PER_YEAR;
    return supplyBaseRewardApr;
  }

  /*
   * Get the current reward for borrowing APR in Compound III
   * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
   * @return The reward APR in USD as a decimal scaled up by 1e18
   */
  function getRewardAprForBorrowBase(address rewardTokenPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    uint rewardTokenPriceInUsd = getCompoundPrice(rewardTokenPriceFeed);
    uint usdcPriceInUsd = getCompoundPrice(comet.baseTokenPriceFeed());
    uint usdcTotalBorrow = comet.totalBorrow();
    uint baseTrackingBorrowSpeed = comet.baseTrackingBorrowSpeed();
    uint rewardToSuppliersPerDay = baseTrackingBorrowSpeed * SECONDS_PER_DAY * (BASE_INDEX_SCALE / BASE_MANTISSA);
    uint borrowBaseRewardApr = (rewardTokenPriceInUsd * rewardToSuppliersPerDay / (usdcTotalBorrow * usdcPriceInUsd)) * DAYS_PER_YEAR;
    return borrowBaseRewardApr;
  }

  /*
   * Get the amount of base asset that can be borrowed by an account
   *     scaled up by 10 ^ 8
   */
  function getBorrowableAmount(address account) public view returns (int) {
    Comet comet = Comet(cometAddress);
    uint8 numAssets = comet.numAssets();
    uint16 assetsIn = comet.userBasic(account).assetsIn;
    uint64 si = comet.totalsBasic().baseSupplyIndex;
    uint64 bi = comet.totalsBasic().baseBorrowIndex;
    address baseTokenPriceFeed = comet.baseTokenPriceFeed();

    int liquidity = int(
      presentValue(comet.userBasic(account).principal, si, bi) *
      int256(getCompoundPrice(baseTokenPriceFeed)) /
      int256(1e8)
    );

    for (uint8 i = 0; i < numAssets; i++) {
      if (isInAsset(assetsIn, i)) {
        CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
        uint newAmount = uint(comet.userCollateral(account, asset.asset).balance) * getCompoundPrice(asset.priceFeed) / 1e8;
        liquidity += int(
          newAmount * asset.borrowCollateralFactor / 1e18
        );
      }
    }

    return liquidity;
  }

  /*
   * Get the borrow collateral factor for an asset
   */
  function getBorrowCollateralFactor(address asset) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getAssetInfoByAddress(asset).borrowCollateralFactor;
  }

  /*
   * Get the liquidation collateral factor for an asset
   */
  function getLiquidateCollateralFactor(address asset) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getAssetInfoByAddress(asset).liquidateCollateralFactor;
  }

  /*
   * Get the current price of an asset from the protocol's persepctive
   */
  function getCompoundPrice(address singleAssetPriceFeed) public view returns (uint) {
    Comet comet = Comet(cometAddress);
    return comet.getPrice(singleAssetPriceFeed);
  }

  /*
   * Gets the amount of reward tokens due to this contract address
   */
  function getRewardsOwed(address rewardsContract) public returns (uint) {
    return CometRewards(rewardsContract).getRewardOwed(cometAddress, address(this)).owed;
  }

  /*
   * Claims the reward tokens due to this contract address
   */
  function claimCometRewards(address rewardsContract) public {
    CometRewards(rewardsContract).claim(cometAddress, address(this), true);
  }

  function presentValue(
    int104 principalValue_,
    uint64 baseSupplyIndex_,
    uint64 baseBorrowIndex_
  ) internal view returns (int104) {
    if (principalValue_ >= 0) {
      return int104(uint104(principalValue_) * baseSupplyIndex_ / uint64(BASE_INDEX_SCALE));
    } else {
      return -int104(uint104(principalValue_) * baseBorrowIndex_ / uint64(BASE_INDEX_SCALE));
    }
  }

  function isInAsset(uint16 assetsIn, uint8 assetOffset) internal pure returns (bool) {
    return (assetsIn & (uint16(1) << assetOffset) != 0);
  }
}
