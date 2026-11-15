// One reception device driven through the prototype's UI, with Playwright's fake clock so two
// simulated hours pass in seconds. Every action is checked to have been queued locally.
import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';
import { deviceUrl, type ProxyName, toxi } from './toxi.ts';

const firstOpens = new Set<string>();

export type Currency = 'SYP' | 'TRY' | 'USD';

export class Device {
  queued = 0;
  private constructor(
    readonly proxy: ProxyName,
    readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  static async open(browserOrContext: Browser | BrowserContext, proxy: ProxyName): Promise<Device> {
    const context =
      'newContext' in browserOrContext ? await browserOrContext.newContext() : browserOrContext;
    const page = context.pages()[0] ?? (await context.newPage());
    // A device's first open in a test starts on a healthy link, whatever an earlier (failed) spec
    // left behind; a reopen in the same test (browser restart offline) keeps the current link.
    const key = `${test.info().testId}:${proxy}`;
    if (!firstOpens.has(key)) {
      firstOpens.add(key);
      await toxi.clear(proxy);
      await toxi.restore(proxy);
    }
    await page.clock.install({ time: Date.now() });
    await page.goto(deviceUrl(proxy));
    return new Device(proxy, context, page);
  }

  async login(username = 'reception-a'): Promise<void> {
    await this.page.getByTestId('login-form').locator('select').selectOption(username);
    await this.page.getByTestId('login-form').getByRole('button').click();
    await expect(this.page.getByTestId('banner')).toHaveAttribute('data-state', 'online');
  }

  deviceId(): Promise<string> {
    return this.page.evaluate(() => localStorage.getItem('s1-device') ?? '');
  }

  /** Waits until the action is in the local queue (offline phases only). */
  private async queuedOne(offline: boolean): Promise<void> {
    this.queued += 1;
    if (offline)
      await expect(this.page.getByTestId('pending-count')).toHaveText(String(this.queued));
  }

  async walkIn(n: number, offline = true, practitioner = 0): Promise<void> {
    const form = this.page.getByTestId('walkin-form');
    await form.locator('select').selectOption({ index: practitioner });
    await form.locator('input[name=label]').fill(`مراجع ${String(n)}`);
    await form.getByRole('button').click();
    await this.queuedOne(offline);
  }

  /** Clicks a status button on this device's n-th ticket row. */
  async setStatus(nth: number, status: 'called' | 'done', offline = true): Promise<void> {
    const id = await this.deviceId();
    const row = this.page
      .getByTestId('ticket-row')
      .filter({ hasText: `(${id})` })
      .nth(nth);
    await row.getByTestId(`status-${status}`).click();
    await this.queuedOne(offline);
  }

  async openSession(): Promise<void> {
    await this.page.getByTestId('open-session').click();
    await expect(this.page.getByTestId('cash-form')).toBeVisible();
  }

  async sale(currency: Currency, amount: string, offline = true): Promise<void> {
    const form = this.page.getByTestId('cash-form');
    await form.locator('select[name=type]').selectOption('sale');
    await form.locator('select[name=currency]').selectOption(currency);
    await form.locator('input[name=amount]').fill(amount);
    await form.getByRole('button').click();
    await this.queuedOne(offline);
  }

  /** Refunds `amount` of the first SYP sale in the refund list. */
  async refund(amount: string, offline = true): Promise<void> {
    const form = this.page.getByTestId('cash-form');
    await form.locator('select[name=type]').selectOption('refund');
    const saleId = await form
      .locator('select[name=refundOf] option')
      .evaluateAll(
        (options) =>
          (options as HTMLOptionElement[]).find((o) => o.text.includes('ل.س'))?.value ?? '',
      );
    await form.locator('select[name=refundOf]').selectOption(saleId);
    await form.locator('input[name=amount]').fill(amount);
    await form.getByRole('button').click();
    await this.queuedOne(offline);
  }

  async book(hhmm: string, offline = true, practitioner = 0): Promise<void> {
    const form = this.page.getByTestId('booking-form');
    await form.locator('select').selectOption({ index: practitioner });
    await form.locator('input[name=start]').fill(hhmm);
    await form.getByRole('button').click();
    await this.queuedOne(offline);
  }

  async pending(): Promise<number> {
    return Number(await this.page.getByTestId('pending-count').textContent());
  }

  state(): Promise<string | null> {
    return this.page.getByTestId('banner').getAttribute('data-state');
  }

  async offlineSeconds(): Promise<number> {
    const text = (await this.page.getByTestId('offline-for').textContent()) ?? '0:00:00';
    const [h = 0, m = 0, s = 0] = text.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }

  events(kind: 'remap' | 'conflict' | 'refused'): Promise<number> {
    return this.page.locator(`[data-testid=events] li[data-kind=${kind}]`).count();
  }

  async advance(ms: number): Promise<void> {
    await this.page.clock.fastForward(ms);
  }

  /** Lets background sync run until the queue is empty and the banner says online. */
  async waitSynced(timeoutMs = 120_000): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.advance(4_000);
          return `${String(await this.state())}:${String(await this.pending())}`;
        },
        { timeout: timeoutMs, intervals: [500] },
      )
      .toBe('online:0');
    this.queued = 0;
  }
}
