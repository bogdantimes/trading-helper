# v2.6.2

Contains improvements to existing features:
* Survivors feature improved and renamed to Scores. New option related to scores in Settings -> Advanced.
* Stop-limit auto-sell now happens only on crossing-down even.

# v2.6.1

* Start the background process if it is not running (fix for the upgrade from v2.5.0 to v2.6.0+)
* Update stop limit when price movement up is strong (should improve/reduce sensitivity).

# v2.6.0

* Improved "Assets" page UI: all tabs collapsed into a single page with clickable dividers #41.
* Added: "Add" dialog (plus button on the "Assets" page) for entering trades manually.
* Fixed: "Averaging down tries to invest into stablecoins when there are no other assets #38".
* Fixed: "Any error that follows a successfully trade can leave the asset in incomplete buy/sell state #40"
* Fixed: "In some cases changing asset name (for example EPS -> EPX) can cause a corrupted state #34".
* Reduced the frequency of Cache -> Firebase syncing for trades to 5 minutes, to consume less UrlFetch GAS limit.
* Swing Trade now waits for x2 Profit Limit percentage price drop, instead of x1, before buying again.

# v2.5.0

* Added price anomalies alerts with an option to auto-buy when price drops.
* Added profit-based stop limit option, which calculates stop limits based on the available total profit.
* Added "Edit" mode and "Delete" action for Assets cards.
* Added visual indication on Assets cards when price goes down.
* Significantly improved the lag between UI request and the backend side state change.
* Improved Binance errors handling.
* System refactoring under the hood.

# v2.4.0

* Add visual indication on Assets cards when price goes up.
* Change right price scale to be logarithmic.
* Decrease data re-fetch interval for better responsiveness.
* Other minor fixes and improvements under the hood.

# v2.3.4

* Display current balances for top 3 stable coins on the assets page: USDT, USDC, BUSD.
* Disable Buy/Sell buttons if there is no pair with the current stable coin.

# v2.3.3

* Fixed "Old stable coin is used when buying more of existing asset even after stable was changed" #21.
* Implemented "If BNB is present in the assets and fee was paid using BNB - update it's balance" #22.
* Added "Info" msg on the "Scores" tab.
* Improvements in errors handling.

# v2.3.2

* Changing "Stable Coin" will not reset collected "Scores" statistics for this stable coin if you switch back.
* Added autocompletion for "Coin Name" on the "Assets" tab.
* Added suggestions for "Stable Coin" on the "Settings" tab.
* Adjusted "Scores" scores update logic to be less sensitive.

# v2.3.1

* Fixed Reset button on Scores tab crashes the UI #16
* Adjusted scores update logic to be less sensitive
* Minor code clean up and fixes under the hood

# v2.3.0

* Added "Scores" feature, which tracks currencies that keep the price when 99% of the market goes down.
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
