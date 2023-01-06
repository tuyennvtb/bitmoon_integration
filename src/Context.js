/**
 * Copyright © 2016-present Kriasoft.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* @flow */
import type { request as Request } from 'express';
import type { t as Translator } from 'i18next';

class Context {
  request: Request;
  user: any;
  t: Translator;

  constructor(request: Request) {
    this.request = request;
    this.t = request.t;
  }
}

export default Context;
