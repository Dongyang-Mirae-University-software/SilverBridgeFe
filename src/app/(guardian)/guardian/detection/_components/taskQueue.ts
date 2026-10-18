// 동시에 돌릴 작업 수를 제한한다(썸네일처럼 목록의 카드마다 파일을 받을 때 한꺼번에 몰리지 않게).
export function createTaskQueue(limit: number) {
  let running = 0;
  const waiting: Array<() => void> = [];

  const next = () => {
    if (running >= limit) return;
    const start = waiting.shift();
    if (start) start();
  };

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        running += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            running -= 1;
            next();
          });
      };
      waiting.push(start);
      next();
    });
  };
}
