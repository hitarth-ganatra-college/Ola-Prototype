import CircuitBreaker from "opossum";

const options = {
  timeout: 4000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountBuckets: 10,
  rollingCountTimeout: 10000,
  name: "mongo-write",
};

async function mongoWriteAction(writeFn, payload) {
  return writeFn(payload);
}

export const mongoBreaker = new CircuitBreaker(mongoWriteAction, options);

mongoBreaker.on("open",     () => console.warn("[Circuit] OPEN — DB writes blocked"));
mongoBreaker.on("halfOpen", () => console.info("[Circuit] HALF-OPEN — testing DB"));
mongoBreaker.on("close",    () => console.info("[Circuit] CLOSED — DB writes restored"));
mongoBreaker.on("fallback", (result) => console.warn("[Circuit] Fallback triggered:", result));
