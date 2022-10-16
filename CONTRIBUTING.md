## To bring up the project

```bash
npm install
npm run glogin
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

Pass the initial setup and once you see the Home page - the initial setup is done.
Candidates will appear in 1 minute after the initial setup is done.

See the YouTube playlist with tutorials [here](https://www.youtube.com/playlist?list=PLAiqSgC5hs1fcFglYk81W7hpNRJbqu0Ox)

## To push your changes

```bash
npm run gpush
```

This will re-build and push your local changes.

If changes are related to the [webapp](./src/web) or [lib](./src/lib) folders you will need to reload the browser page.
If changes are related to the [backend](./src/gas) folder, no need to reload the browser page.

## Troubleshooting

All the errors and alerts are sent to the gmail as emails.
If some error and alert occurs indefinitely every minute, the app can reach the daily Google Apps limit,
and you will stop receiving errors and alerts from the app until next day.
