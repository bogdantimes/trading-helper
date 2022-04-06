import {DefaultStore} from "./Store";

export type BuyingQueueItem = {
  quantityAsset: string;
  priceAsset: string;
  cost: number;
};

export class BuyingQueue {
  static getAll(): BuyingQueueItem[] {
    return Object.values(DefaultStore.get("buyingQueue") || {});
  }

  static add(symbol: ExchangeSymbol, cost: number): void {
    DefaultStore.set(`buyingQueue/${symbol.quantityAsset}`, {
      quantityAsset: symbol.quantityAsset,
      priceAsset: symbol.priceAsset,
      cost: cost,
    });
  }

  static remove(symbol: ExchangeSymbol) {
    DefaultStore.delete(`buyingQueue/${symbol.quantityAsset}`);
  }
}
