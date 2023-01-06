/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */
/* eslint-disable no-console, no-shadow */

import app from './app';
import databases from './databases';
import errors from './errors';
import { host, port, protocol, env } from './config';
import Worker from './core/Worker';

const worker = new Worker({
  mode: env,
});
// Launch Node.js server
const server = app.listen(port, host, () => {
  console.log(`Running Integration Middleware on ${env} instance.`);
  console.log(
    `Node.js API server is listening on ${protocol}://${host}:${port}/`,
  );
  const queue = worker.initialize();
  queue.watchStuckJobs(1000);
});

// Shutdown Node.js app gracefully
function handleExit(options, err) {
  if (options.cleanup) {
    const actions = [
      server.close,
      databases.wallet.destroy,
      databases.walletAdmin.destroy,
      databases.webApp.destroy /* redis.quit */,
    ];
    actions.forEach((close, i) => {
      try {
        close(() => {
          if (i === actions.length - 1) process.exit();
        });
      } catch (err) {
        if (i === actions.length - 1) process.exit();
      }
    });
  }
  if (err) errors.report(err);
  if (options.exit) process.exit();
}

process.on(
  'exit',
  handleExit.bind(null, {
    cleanup: true,
  }),
);
process.on(
  'SIGINT',
  handleExit.bind(null, {
    exit: true,
  }),
);
process.on(
  'SIGTERM',
  handleExit.bind(null, {
    exit: true,
  }),
);
process.on(
  'uncaughtException',
  handleExit.bind(null, {
    exit: true,
  }),
);
