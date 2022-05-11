## To bring up the project

```bash
npm install
npm run gcreate
npm run gpush
npm run gedit
```

The `gedit` command opens the project in your browser. Click on the "Run" button and authorize the application.

Now open the webapp:

```bash
npm run gopen
```

If you see the "Welcome" page, the webapp is running.

To pass the initial setup on the Welcome page:

* Create the Firebase Realtime database and provide the URL, click "Connect".
* Create Binance API key and secret and provide them, click "Connect".

If you see the "Assets" page, the webapp is now fully configured and is ready to use.

See the YouTube playlist with tutorials [here](https://www.youtube.com/playlist?list=PLAiqSgC5hs1fcFglYk81W7hpNRJbqu0Ox)

## To push your changes

```bash
npm run gpush
```

This will re-build and push your local changes.

If the changes are related to the webapp ([src](./src) folder) you will need to reload the browser page.
If the changes are related to the backend ([apps-script](./apps-script) folder), no need to reload the browser page.

## Troubleshooting

All the errors and alerts are sent to the gmail as emails.
If some error and alert occurs indefinitely every minute, the app can reach the daily Google Apps limit,
and you will stop receiving errors and alerts from the app until next day.
