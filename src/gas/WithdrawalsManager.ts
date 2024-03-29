import { Config } from "../lib";
import { type Statistics } from "./Statistics";
import { type ConfigDao } from "./dao/Config";

export class WithdrawalsManager {
  constructor(
    private readonly configDao: ConfigDao,
    private readonly statistics: Statistics
  ) {
  }

  addWithdrawal(amount: number): { amount: number; balance: number } {
    const addWithdrawalFn = (config: Config) => {
      // Check internal balance
      if (amount > config.StableBalance) {
        throw new Error(
          `Withdrawal amount is greater than the current balance.`
        );
      }

      config.StableBalance -= amount;
      this.statistics.addWithdrawal(amount);
      return config;
    };

    const latestConfig = this.configDao.update(addWithdrawalFn);

    return {
      amount,
      balance: latestConfig.StableBalance
    };
  }
}
