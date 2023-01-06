import crypto from 'crypto';
import { privateKey, logger } from '../config';

const Util = {
  // get balance of an coinID, response to structure : available to use, withdraw pending, deposit pending, exchange reserved
  encrypt: text => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(privateKey),
      iv,
    );
    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  },

  decrypt: text => {
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(privateKey),
        iv,
      );
      let decrypted = decipher.update(encryptedText);

      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString();
    } catch (error) {
      logger(
        `Failed to decrypt ${text}`,
        'Util.js - Function decrypt()',
        error,
      );
      return text;
    }
  },
};

export default Util;
