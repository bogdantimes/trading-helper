# v4.3.4

* Trading Algorithm:
  * Increase top candidates check frequency for buy signals (30 min -> 5 min).

# v4.3.3

* Trading Algorithm:
  * Require 80% confidence for buy signals (instead of 60%).
* Minor usability fixes.

# v4.3.2

* Fixed production build error

# v4.3.1

* Added "Dry Run" mode.
* UI: Terminal updated.
* API: Added `topc` command for candidates discovery.
* Improved storage lock, `swap` command.

# v4.3.0

* Bull-run detection feature:
  * Trading-algorithm is more aggressive when "Bull Run Mode" is active.
  * UI: Settings tab updated with a new control for "Bull Run Mode".

# v4.2.6

* Trading Algorithm:
  * Fixed mismatch with back-testing when getting the imbalance value.
* UI: minor fixes
* API: added `swap` function

# v4.2.5

* Trading Algorithm:
  * Removed a condition that prevented trading high-volatility (on a 10 minutes timescale) candidates

# v4.2.4

* Bug fix: coin buy skipped.

# v4.2.3

* Bug fix: coin is not removed.

# v4.2.2

* Trading Algorithm:
  * Removed a condition that prevented buying coins that pumped for more than +7%
* Other:
  * Various console API improvements

# v4.2.1

* Trading Algorithm:
  * Market Strength updated to work better for the bull market cycle.
* Other:
  * Add current price indicator on assets cards.
  * Notify by email when Auto-stop switched.
  * Improved temporary errors handling.
  * Added `edit` API command.
  * Improved `importCoin` API command.
  * Removed UI swipe effect to switch tabs.

# v4.2.0

* Auto-stop (Market Strength) feature.
* Trading algorithm adjustments to pick coins that have confidence 60%+.

# v4.1.13

* Market Strength indicator (to start collecting data for v4.2.0 "Auto-stop" feature).
* Reverted "Switch from `quoteOrderQty` to `quantity` type of market order (Binance issue)."

# v4.1.12

* Take price fluctuations into account in previous fix.

# v4.1.11

* Take standard fee into account in previous fix.

# v4.1.10

* Switch from `quoteOrderQty` to `quantity` type of market order (Binance issue).

# v4.1.9

* Added MarketDemand card.
* Check asset demand with 0.5% step.

# v4.1.8

* Enable buy signals for TH+ in View-only mode when balance is 0.
* Fix Candidates view counter.

# v4.1.7

* Re-enabled "buy" notifications by email.
* Fixed `importCoin` incorrectly importing fees.

# v4.1.6

* UI: Added ability to pin candidates.
* Updated `info` API command, to return an average market demand.
* Updated `importCoin` API command to optionally include quantity when importing a coin.
* Improved demand scanning for TH+.

# v4.1.5

* Fix: Cannot read properties of null (reading 'BTC')

# v4.1.4

* More frequent demand re-scan for TH+ (every 4 hours - reset).
* Stability fixes.

# v4.1.3

* Bug-fixes.

# v4.1.2

* Continuous demand scanning for TH+ subscribers to show candidates with high demand.
* BUY signals, when unlocked, are sent via email in View-only mode.
* Bug-fixes.
* Landing page updates.

# v4.1.1

* Trading Library updated to v35 with improvements to candidates selection.
* Minor UI bugfixes.

# v4.1.0

* New "Minimum budget split" setting.
* New `info COIN` API command.
* Added "Entry price" on the current asset cards.
* Adjusted "Confidence" to be more accurate with respect to the Smart Exit logic.
* Trading Library updated to v33 with minor adjustments to candidates selection.
* Fixed BNB budget replenishment issue.

# v4.0.1

* Trading Library updated to v32 with a safeguard against pump&dump cases added.

# v4.0.0

* New trading algorithm that provides more signals, with GPT-4 as signal noise filter.
* New smart-exit logic that uses supply/demand imbalance as main exit reason.
* New UI layout with focus on fully-autonomous trading.
* Not relevant features removed from UI.
* API console button with improved API commands.

# v3.3.10

* Switched the default stable coin to USDT. BUSD will be removed by the end of 2023.

# v3.3.9

* Added "Replenish fees budget" setting.
* Added check for Spot balance when saving the config.
* Added an "eye" icon to sneak-peek balances when they are hidden.
* Removed "Market trend" setting.
* Other minor updates along the way.

# v3.3.8

* Improved the process ticker to make it synchronized with the exchange ticker.

# v3.3.7

* Fixed a bug with balance auto-detect missing $1 after initialization.
* Minor visual improvements on the Info page.

# v3.3.6

* UI: Fixed an issue with Smart-exit label percentage.

# v3.3.5

* UI: Added percentages visualization on price chart labels.

# v3.3.4

* Trading Library updated to v21 with minor fixes in candidates analysis.
* Back-testing updated with new 6m time-frame included.
* Statistic improvements + `addWithdrawal` API method.
* Email notification format updated.

# v3.3.3

* Fixed: ExitImbalanceCheck feature was disabled for old installations.

# v3.3.2

* Trading Library updated to v20 with more accurate candidates strength visualization on UI.

# v3.3.1

* Minor fix in the balance management to improve efficiency.

# v3.3.0

* "Imbalance Check" is improved and re-enabled on "Smart exit".
* Trading Library updated to v19: improved "buy" signals that work better on the past 6 months period.
* Added tracking of approximate number of trades left, that covered by available BNB (displayed on Home page).
* Fixed Firebase database import when connecting to a new project installation.

# v3.2.1

* Disabled "Imbalance Check" on Smart Exit (that was introduced in v3.2.0) as it needs further fine-tuning and back-testing.

# v3.2.0

* "Imbalance Check" function is integrated into active stop-limit with stunning **x2** profits/year improvement.
* Active stop-limit renamed to **Smart exit**: sell automatically when smart exit is **crossed down** and there
  are **no** buyers to support the price.
* Updated [back-testing/results.md](back-testing/results.md) with the results of the full test-set.
* Added support of automatic OTA (Over The Air) upgrades to next versions:
  * Upgrade functionality requires the additional permissions:
    `https://www.googleapis.com/auth/drive`
    `https://www.googleapis.com/auth/drive.scripts`

# v3.1.2

* Minor fixes to initial setup for new users.

# v3.1.1

News of the week was Binance restricting REST API access from any US-based cloud providers (like Google).

* Added ability to use EU-based cloud proxy for Binance REST API requests.
* Only Patrons that unlocked autonomous trading get the access to EU service.
* Other fixes: improved experimental "Imbalance Check" feature (it still stays in hidden-disabled mode).

# v3.1.0

* Library updated to v6 with significant algorithm improvements (+30-40% better profits / year).
* Experimental "Imbalance Check" feature included in hidden-disabled mode (in testing yet).

# v3.0.3

* Improved current profit percentage accuracy.
* Improved candidate strength accuracy.
* Fixed concurrent trades update issues.
* Fixes UI state not being immediately updated after trade deletion.
* Added Setting to Hide balances.

# v3.0.2

* Improved stop-limit grid.
* Improved email format.
* Sold assets stay on the Home page for 1 day.

# v3.0.1

* Library updated to v6 with significant auto-trading reliability improvements.
* Minor fixes to candidates display.
* Minor fixes to profit goal estimates.

# v3.0.0

* Project main idea shifted to make it a fully-autonomous trading tool, all cool manual trading features that are in v2 were removed.
* The underlying algorithms were re-worked to focus on automated profit goal and stop-limit decisions making.
* Automated market trend detection.
* Buy signals algorithm re-worked.
* UI simplified, added Candidates section on Home page.
* Settings re-worked:
  * most settings removed;
  * added Balance input, to set initial and current amount of money for trading;
  * added Market Trend selector;
  * added View-only mode which disables trading and allows to not have Binance keys.

# v2.7.1

* Firebase Realtime Database is made optional and initial setup simplified.
* Added "Price Anomaly Alert" actions in Settings: "No action", "Buy Dumps", "Sell Pumps", "Buy Dumps & Sell Pumps".
* Disabled non-important alerts.
* Improved stop limit auto-adjustment.
* Improved Google Apps Script quota limits handling.
* Improved price pump and dump computation speed.
* Minor fixes in buy / sell decision-making.
* Store and Cache unified into a single CachedStore (cache is now synced to store every 5 minutes).

# v2.7.0

* New "Scores" feature (successor to "Survivors"). New related Settings: "Autonomous trading" and "Score Selectivity".
* UI improvements.
* Many improvements under the hood.
* Stop-limit auto-sell now happens only on crossing-down event.

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
