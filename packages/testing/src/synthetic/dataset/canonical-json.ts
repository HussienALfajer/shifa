/**
 * Stable JSON text for datasets: object keys sorted, bigint written as the string "<n>n",
 * undefined properties left out. Two deep-equal values always give the same text, so the
 * golden hash and later JSON dumps do not depend on key insertion order.
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'bigint':
      return JSON.stringify(`${value.toString()}n`);
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalJson: non-finite number');
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const items: unknown[] = value;
        return `[${items.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
      }
      const entries = Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
      return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
    }
    case 'undefined':
    case 'function':
    case 'symbol':
      break;
  }
  throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
};
