/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import session from 'express-session';
import connectRedis from 'connect-redis';
// import expressGraphQL from 'express-graphql';
import PrettyError from 'pretty-error';
// import { printSchema } from 'graphql';

import API from './api';
import redis from './redis';
// import schema from './schema';
// import Context from './Context';
// import errors from './errors';

const app = express();

app.set('trust proxy', 'loopback');

app.use(
  cors({
    origin(origin, cb) {
      const whitelist = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : [];
      cb(null, whitelist.includes(origin));
    },
    credentials: true,
  }),
);

app.use(compression());
app.use(cookieParser());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(
  bodyParser.json({
    verify(req, res, buf) {
      // get rawBody
      req.rawBody = buf.toString();
    },
  }),
);
app.use(
  session({
    store: new (connectRedis(session))({
      client: redis,
    }),
    name: 'sid',
    resave: true,
    saveUninitialized: true,
    secret: 'bitmoon-middleware',
  }),
);

// app.get('/graphql/schema', (req, res) => {
//   res.type('text/plain').send(printSchema(schema));
// });

// app.use(
//   '/graphql',
//   expressGraphQL(req => ({
//     schema,
//     context: new Context(req),
//     graphiql: process.env.NODE_ENV !== 'production',
//     pretty: process.env.NODE_ENV !== 'production',
//     formatError: (error: any) => {
//       errors.report(error.originalError || error);
//       return {
//         message: error.message,
//         code: error.originalError && error.originalError.code,
//         state: error.originalError && error.originalError.state,
//         locations: error.locations,
//         path: error.path,
//       };
//     },
//   })),
// );

const services = new API(app);
services.initialize();

app.use('/', (req, res) => {
  res.json({
    status: 200,
  });
});

const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => {
  process.stderr.write(pe.render(err));
  next();
});

export default app;
