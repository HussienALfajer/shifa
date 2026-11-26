// The canvas runs each board in a frame sandboxed with `allow-scripts allow-same-origin` and no
// `allow-forms`: there the browser never submits a form, so a press on «دخول» (or Enter in a
// field) never fires `submit` and the page never sends. Seen on the live canvas: «Wrong» filled
// both fields and stopped. Here, in the screens bundle only (the product is untouched), a submit
// by button or by Enter is done by hand: the browser's own submission is stopped and the `submit`
// event the page listens for is fired, with the constraint check a form without `novalidate`
// gets. The same everywhere, sandbox or not, so the board check exercises what the canvas runs.

type Submitter = HTMLButtonElement | HTMLInputElement;

const isSubmitter = (el: Element | null): el is Submitter =>
  (el instanceof HTMLButtonElement && el.type === 'submit') ||
  (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'image'));

function submit(form: HTMLFormElement, submitter: Submitter | null) {
  if (!form.noValidate && !submitter?.formNoValidate && !form.reportValidity()) return;
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter }));
}

/** The button Enter presses: the form's first submit button, none when it is off. */
function defaultButton(form: HTMLFormElement): Submitter | null {
  const first = [...form.elements].find((el) => isSubmitter(el)) ?? null;
  return first && !first.disabled ? first : null;
}

/** Fields where Enter submits (not a text area, a button or a choice list). */
const ENTER_SUBMITS = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

export function installFormSubmission(doc: Document): void {
  // Last on the way up, after the page's own handlers (React's sit on its root, below): a click
  // they cancelled submits nothing, as in a browser. Cancelling it here stops the browser's own
  // submission, which would be a second `submit` where forms are allowed.
  doc.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button, input') ?? null;
    if (!isSubmitter(button) || button.disabled || !button.form) return;
    event.preventDefault();
    submit(button.form, button);
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
    const field = event.target;
    if (!(field instanceof HTMLInputElement) || !ENTER_SUBMITS.has(field.type) || !field.form) {
      return;
    }
    event.preventDefault();
    const button = defaultButton(field.form);
    // As a browser: with no submit button Enter submits only a form of a single field.
    if (button) button.click();
    else if (![...field.form.elements].some((el) => isSubmitter(el))) submit(field.form, null);
  });
}
