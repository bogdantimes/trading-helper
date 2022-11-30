import * as functions from "firebase-functions";

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//

// fetchBinance receives the request and redirects it to the binance API
export const fetchBinance = functions
  .region(`europe-west1`)
  .https.onRequest((request, response) => {
    // get the resource from the request
    const resource = request.query.resource ?? `ping`;
    const decodedResource = decodeURIComponent(resource as string);

    const binanceRequest = fetch(
      `https://api.binance.com/api/v3/${decodedResource}`,
      {
        method: request.method,
        headers: {
          "X-MBX-APIKEY": (request.headers[`X-MBX-APIKEY`] as string) ?? ``,
        },
      }
    );

    void binanceRequest
      .then((binanceResponse) => {
        binanceResponse
          .json()
          .then((json) => {
            response.status(binanceResponse.status);
            response.send(json);
          })
          .catch((error) => {
            response.status(500).send(error);
          });
      })
      .catch((error) => {
        return response.status(error.status).send(error);
      });
  });
