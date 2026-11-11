// Stack traces reduced to their frames. A V8 stack starts with `Name: message`, and the message
// may span lines and quote a value (an indented line can even look like a frame), so the
// message is cut away first and only lines in strict V8 frame form are kept.
// No SDK import: platform logging and the log forwarder load this with telemetry off.

/** `    at fn (file:line:col)`, `    at file:line:col` or `    at fn (native)`. */
const FRAME = /^ {4}at (?:(?:[^()]+ \()?[^()\s]+:\d+:\d+\)?|[^()]+ \(native\))$/;

/** The error type followed by the stack's frames; never any part of the message. */
export function stackFrames(stack: string, type: string, message?: string): string {
  let rest = stack;
  if (message !== undefined && message !== '') {
    const at = rest.indexOf(message);
    if (at !== -1) rest = rest.slice(at + message.length);
  }
  const frames = rest.split('\n').filter((line) => FRAME.test(line));
  return [type, ...frames].join('\n');
}

/** The `Name` of a V8 stack header (`Name: message`); the name an error had when created. */
const HEADER_NAME = /^[A-Za-z0-9_.$-]{1,64}$/;

/**
 * Stricter than stackFrames(), for data that leaves the API as structured frames (error
 * events): only when the stack starts with `Name: <the message as it is now>` are frames kept,
 * and only the run of frame lines right after it, up to the first line that is not one. A
 * message changed after creation, or a `Caused by:` section appended to the stack, yields the
 * type alone.
 */
export function leadingStackFrames(stack: string, type: string, message: string): string {
  let rest: string;
  if (message === '') {
    const end = stack.indexOf('\n');
    // V8 writes `Name`; source-map rewriting (Vitest) writes `Name: `.
    const name = (end === -1 ? stack : stack.slice(0, end)).replace(/: ?$/, '');
    if (!HEADER_NAME.test(name)) return type;
    rest = end === -1 ? '' : stack.slice(end);
  } else {
    const colon = stack.indexOf(': ');
    if (colon === -1 || !HEADER_NAME.test(stack.slice(0, colon))) return type;
    if (!stack.startsWith(message, colon + 2)) return type;
    rest = stack.slice(colon + 2 + message.length);
  }
  if (rest !== '' && !rest.startsWith('\n')) return type;
  const frames: string[] = [];
  for (const line of rest.split('\n').slice(1)) {
    if (!FRAME.test(line)) break;
    frames.push(line);
  }
  return [type, ...frames].join('\n');
}
