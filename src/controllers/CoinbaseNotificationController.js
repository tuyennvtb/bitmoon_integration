import coinbase from 'coinbase';
import { tasks, env, logger, service } from '../config';
import Worker from '../core/Worker';
import Util from '../core/Util';

class CoinbaseNotificationController {
  constructor(req, res) {
    if (!req || !res) {
      throw new Error('Please setup the Request/Response for Controller.');
    }
    this.request = req;
    this.response = res;
    this.worker = new Worker({
      mode: env,
    });
    this.initCoinbaseSetting();
  }

  initCoinbaseSetting = () => {
    const { Client } = coinbase;
    const setting = service.coinbase.warm;
    this.client = new Client({
      apiKey: Util.decrypt(setting.api_key),
      apiSecret: Util.decrypt(setting.api_secret),
    });
  };

  getBody = () => this.request.body;

  handleNotification = async () => {
    const { client } = this;
    console.log('-----------------header-------------');
    console.log(this.request.headers);
    if (this.request.query.key === 'bitmoon2018cb' && client) {
      const { rawBody } = this.request;
      const coinbaseSignature = this.request.headers['cb-signature'];
      if (rawBody && coinbaseSignature) {
        if (client.verifyCallback(rawBody, coinbaseSignature)) {
          const requestBody = this.getBody();
          if (requestBody) {
            const bodyData = requestBody.data;
            const coinAddress = bodyData && bodyData.address;
            let finalCoinAddress = coinAddress;
            let coinID = bodyData && bodyData.network;
            const additionalBodyData = requestBody.additional_data;
            if (coinID && coinID.indexOf('_') !== -1) {
              if (coinID === 'bitcoin_cash') {
                logger(
                  `the coin address is ${coinAddress}`,
                  'CoinbaseNotificationController.js - Function handleNotification()',
                  ``,
                );
                if (bodyData.legacy_address) {
                  logger(
                    `found legacy address, and the value is ${bodyData.legacy_address
                    }`,
                    'CoinbaseNotificationController.js - Function handleNotification()',
                    ``,
                  );
                  finalCoinAddress = bodyData.legacy_address;
                }
                coinID = 'bitcoin-cash';
                // additionalBodyData.amount.currency = 'BCHABC';
                additionalBodyData.amount.currency = 'BCH';
              }
            } else if (
              coinID.toLowerCase() == 'ethereum' &&
              additionalBodyData.amount &&
              additionalBodyData.amount.currency.toLowerCase() != 'eth'
            ) {
              coinID = await this.getCoinIDMapping(
                additionalBodyData.amount.currency.toUpperCase(),
              );
            }
            const transactionData = {
              coinID,
              coinCode:
                additionalBodyData.amount && additionalBodyData.amount.currency,
              transfer: {
                notificationId: requestBody.id,
                accountId: requestBody.account && requestBody.account.id,
                transactionId:
                  additionalBodyData.transaction &&
                  additionalBodyData.transaction.id,
                createdAt: requestBody.created_at,
                data: {
                  address: finalCoinAddress,
                  coinID,
                  coinCode:
                    additionalBodyData.amount &&
                    additionalBodyData.amount.currency,
                  amount:
                    additionalBodyData.amount &&
                    additionalBodyData.amount.amount,
                },
              },
            };
            this.worker.createWorker(
              tasks.createTransaction,
              transactionData,
              1000 * 1,
              1000 * 1200,
            );
          } else {
            logger(
              `Fail to check the request body`,
              'CoinbaseNotificationController.js - Function handleNotification()',
              `rawBody: ${rawBody} - signature: ${requestBody}`,
            );
          }
        } else {
          logger(
            `Fail to verify callback from coinbase`,
            'CoinbaseNotificationController.js - Function handleNotification()',
            `rawBody: ${rawBody} - signature: ${coinbaseSignature}`,
          );
        }
      } else {
        logger(
          `Fail to verify callback from coinbase - rawbody or signature not found`,
          'CoinbaseNotificationController.js - Function handleNotification()',
          `rawBody: ${rawBody} - signature: ${coinbaseSignature}`,
        );
      }
    }

    this.response.json({
      title: 'coinbase-notification',
      status: 200,
    });
  };

  getCoinIDMapping = async coinCode => {
    const coinMapping = service.coinMapping;
    let coinID = null;
    await Object.keys(coinMapping).filter(async key => {
      if (key == coinCode) {
        coinID = coinMapping[key];
      }
    });
    return coinID || null;
  };
}
export default CoinbaseNotificationController;
