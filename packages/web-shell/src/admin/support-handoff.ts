// Opening clinic web at a support hand-off (slice A-02-08; A-02 criterion 11, ADR-0050). The tab is
// opened empty inside the person's click, so no pop-up blocker refuses it after the request; once
// the hand-off arrives its opener is cut (clinic web cannot reach admin web's window) and it is
// sent there with `location.replace`, so the hand-off stays out of the new tab's history. Only an
// http(s) address is followed. The hand-off is never logged, stored or kept in the query cache.

export type HandoffResult = 'opened' | 'blocked' | 'refused';

/** The empty tab, opened synchronously in the click; null when the browser refused it. */
export function openBlankTab(): Window | null {
  return window.open('', '_blank');
}

export function isWebAddress(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Sends the empty tab to the hand-off, or closes it when the address is not a web address. */
export function sendTab(tab: Window | null, url: string): HandoffResult {
  if (tab === null) return 'blocked';
  if (!isWebAddress(url)) {
    tab.close();
    return 'refused';
  }
  tab.opener = null;
  tab.location.replace(url);
  return 'opened';
}
