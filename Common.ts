interface ExecParams {
  context: any;
  runnable: (any) => any;
  interval?: number;
  attempts?: number;
}

const INTERRUPT = 'INTERRUPT';

function execute({context, runnable, interval=2000, attempts=5}: ExecParams) {
  let errorMessage = '';
  do {
    try {
      return runnable(context);
    } catch (e) {
      errorMessage = e.message;
      if (errorMessage.includes(INTERRUPT)) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval)
    }
  } while (--attempts > 0);

  console.error('All attempts failed. Error message: ' + errorMessage);
  throw Error(errorMessage);
}
