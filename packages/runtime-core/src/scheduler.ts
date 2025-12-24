const queue = [];
let isFlushing = false;
const resolvePromise = Promise.resolve();

export function queueJob(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }

  if (!isFlushing) {
    isFlushing = true;

    resolvePromise.then(() => {
      isFlushing = false;

      const currentQueue = queue.slice(0);
      queue.length = 0;

      currentQueue.forEach((job) => job());
    });
  }
}
