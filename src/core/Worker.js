import { logger, queue } from '../config';

// Define a skeleton factory
class Worker {
  // Our default instance
  mode = 'development';

  // setup coin api factory
  constructor(options) {
    this.mode =
      ['production', 'development', 'uat'].indexOf(options.mode) !== -1
        ? options.mode
        : 'development';
  }

  createWorker = (task, data, timer, backoff) => {
    queue
      .create(task, data)
      .removeOnComplete(true)
      .delay(timer || 1)
      .attempts(12)
      .backoff({ delay: backoff || 1000 * 60 * 10, type: 'fixed' }) // delay the next failed job for 10 minutes
      .save(err => {
        if (err) {
          logger(
            `Failed to create a job for task: ${task}. Data detail ${JSON.stringify(
              data,
            )}`,
            'Worker.js - Function createWorker()',
            err.message,
          );
        }
      });
  };

  createSingleWorker = (task, data, timer) => {
    queue
      .create(task, data)
      .delay(timer || 1)
      .save(err => {
        if (err) {
          logger(
            `Failed to create a job for task: ${task}. Data detail ${JSON.stringify(
              data,
            )}`,
            'Worker.js - Function createWorker()',
            err.message,
          );
        }
      });
  };

  finalize = (err, done) => {
    if (err) {
      done(err);
    } else {
      done();
    }
  };

  initialize = () => {
    queue.setMaxListeners(0);

    return queue;
  };
}

export default Worker;
