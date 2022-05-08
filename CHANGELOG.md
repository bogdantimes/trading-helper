# v2.3.0

* Added "Survivors" feature, which tracks currencies that keep the price when 99% of the market goes down.
* Visual improvements.
* Improved Binance connection stability.
* Trading state machine minor improvements.

# v2.2.0

* "Averaging Down" feature.
* Fixed #8 "Alerts for crossing profit limit are repeated".
* Added "Cancel" button to cancel the request of selling a coin.
* Other minor fixes.

# v2.1.1

* Fixed critical issue in `sumWithMaxPrecision`
* Final fix for  #9 "Trade result quantity is sometimes rounded to wrong number resulting in error"
* Added "Cancel" button to cancel the request of buying a coin.

# v2.1.0

* Trading tab removed, the "Coin Name" input and the "Buy" button moved to the "Assets" tab.
* Added badges with counters to the state toggle group on "Assets" page. Trade card:
* Added price at which the asset was sold.
* Added "Buy Again" button.
* Added displaying of quantity (Qty).
* Fixed #7 "Weird javascript rounding issue in Settings tab for Profit / Loss limits"
* Fixed #9 "Trade result quantity is sometimes rounded to wrong number resulting in error"

# v2.0.1

* Fixed #5 "Regression in profit and commission calc"
* Made "Profit" and "Stop limit" lines dashed when auto-selling is disabled for them.

# v2.0.0

* Fine-tuned initial setup.
* Several fixes and improvements under the hood.

# v2.0.0-beta

* Brand-new UI on React.js
* Simplified initial setup.
* Security improvements: no external access from Trading View for now, only authorized access through UI.
* Swing trade feature.
* Statistics.

# v1.0.0-beta (DEPRECATED)

* Integration with Trading View notifications and Binance to buy or sell coins.
* A moving stop-limit, which goes up together with the price.
* A simple UI to display currently tracked assets and the total profit counter.
