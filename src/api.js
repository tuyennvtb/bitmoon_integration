import CoinbaseNotificationController from './controllers';
import UniswapController from './controllers/UniswapController';

class API {
  constructor(app) {
    if (!app) {
      throw new Error('Please input the Express App to API.');
    }
    this.app = app;
  }

  initialize = () => {
    /* ---------API---------- */
    this.app.post('/coinbase-notification', async (req, res) => {
      const coinbaseController = new CoinbaseNotificationController(req, res);
      coinbaseController.handleNotification();
    });

    /* ---------Uniswap---------- */
    this.app.post('/uniswap/create_transaction', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.createTransaction();
    });

    this.app.post('/uniswap/eth_to_tokens', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.swapETHToTokens();
    });

    this.app.post('/uniswap/tokens_to_eth', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.swapTokensToETH();
    });

    this.app.post('/uniswap/usdt_to_tokens', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.swapUSDTToTokens();
    });

    this.app.post('/uniswap/tokens_to_usdt', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.swapTokensToUSDT();
    });

    this.app.post('/uniswap/estimate_tokens_price_by_usdt', async (req, res) => {
      const controller = new UniswapController(req, res);
      controller.estimateTokensPriceByUSDT();
    });


  };
}

export default API;
