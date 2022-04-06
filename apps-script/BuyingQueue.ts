import {DefaultStore} from "./Store";

export class BuyingQueue {
  static getAll(): string[] {
    return Object.values(DefaultStore.get("lazyBuy") || {});
  }

  static add(coinName: string): void {
    DefaultStore.set(`lazyBuy/${coinName}`, coinName);
  }

  static remove(coinName: string) {
    DefaultStore.delete(`lazyBuy/${coinName}`);
  }
}
