/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Promise from 'bluebird';
import fetch, { Request, Headers, Response } from 'node-fetch';
import { host } from '../../config';

fetch.Promise = Promise;
Response.Promise = Promise;

function localUrl(url) {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (url.startsWith('http')) {
    return url;
  }

  return `http://${host}${url}`;
}

function localFetch(url, options) {
  return new Promise(resolve => {
    function success(response) {
      resolve(response);
    }

    function finalHandler(finalError) {
      resolve(finalError.message);
    }

    function fetchUrl() {
      fetch(localUrl(url), options)
        .then(success)
        .catch(finalHandler);
    }
    fetchUrl();
  });
}

export { localFetch as default, Request, Headers, Response };
