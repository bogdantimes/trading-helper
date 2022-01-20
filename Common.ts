interface ExecParams {
  context: any;
  runnable: (any) => any;
  interval?: number;
  attempts?: number;
}

const INTERRUPT = 'INTERRUPT';

function execute({context, runnable, interval=2000, attempts=5}: ExecParams) {
  let err = '';
  do {
    try {
      return runnable(context);
    } catch (e) {
      err = e.message;
      if (e.message.includes(INTERRUPT)) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval)
    }
  } while (--attempts > 0);

  logger.info('All attempts failed. Error message: ' + err.message);
  throw err;
}
