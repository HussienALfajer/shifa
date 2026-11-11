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
