/**
 * Node.js API Starter Kit (https://reactstarter.com/nodejs)
 *
 * Copyright © 2016-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */

import knex from 'knex';

// locahost config
const databases = {
  userWebapp: knex({
    client: 'mysql',
    connection: {
      host: process.env.BITMOON_HOST || 'xxxx',
      port: process.env.BITMOON_PORT || 3306,
      user: process.env.BITMOON_USER || 'backendapi_dev',
      password: process.env.BITMOON_PASSWORD || 'xxxx',
      database: process.env.BITMOON_DATABASE || 'bitmoon',
    },
    debug: false,
  }),
  webApp: knex({
    client: 'mysql',
    connection: {
      host: process.env.BA_HOST || 'xxxx',
      port: process.env.BA_PORT || 3306,
      user: process.env.BA_USER || 'wallet_dev',
      password: process.env.BA_PASSWORD || 'xxxx',
      database: process.env.BA_DATABASE || 'bitmoon_wallet',
    },
    debug: false,
  }),
  wallet: knex({
    client: 'mysql',
    connection: {
      host: process.env.BW_HOST || 'xxxx',
      port: process.env.BW_PORT || 3306,
      user: process.env.BW_USER || 'wallet_dev',
      password: process.env.BW_PASSWORD || 'xxxx',
      database: process.env.BW_DATABASE || 'bitmoon_wallet_data',
    },
    debug: false,
  }),
  walletAdmin: knex({
    client: 'mysql',
    connection: {
      host: process.env.BWA_HOST || 'xxxx',
      port: process.env.BWA_PORT || 3306,
      user: process.env.BWA_USER || 'wallet_dev',
      password: process.env.BWA_PASSWORD || 'xxxx',
      database: process.env.BWA_DATABASE || 'bitmoon_wallet_admin',
    },
  }),
  exchanger: knex({
    client: 'mysql',
    connection: {
      host: process.env.EX_HOST || 'xxxx',
      port: process.env.EX_PORT || 3306,
      user: process.env.BW_USER || 'wallet_dev',
      password: process.env.BW_PASSWORD || 'xxxx',
      database: process.env.EX_DATABASE || 'exchanger',
    },
  }),
};

export default databases;
