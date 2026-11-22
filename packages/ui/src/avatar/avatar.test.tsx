// Avatar and avatar group (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64): a
// person's picture, and when there is none (or it fails) the first letters of the first and last
// names on a colour from the avatar palette, chosen by a stable hash of the name. «ال» before a
// family name is skipped; a Latin name gives two capitals, isolated; one name gives one letter.
// The full name (or the picture's text) is the accessible name. A group shows the overflow count.
import { describe, expect, it } from 'vitest';
import { people } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Avatar, AvatarGroup, avatarInitials } from './avatar.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const CREW = people(6, { seed: 31 });
const nameAt = (i: number) => CREW[i]?.name ?? '';
// A synthetic name whose family name does not already start with «ال» (owner, 2026-11-22: the
// first version took one that did, and expected the letter the rule skips).
const PLAIN = CREW.find((p) => !(p.name.split(' ')[1] ?? '').startsWith('ال'))?.name ?? '';
const [given = '', family = ''] = PLAIN.split(' ');
/** A synthetic family name with «ال» before it. */
const WITH_AL = `${given} ال${family}`;
const PIXEL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="gray"/></svg>',
  );

const avatarEl = () => document.querySelector('[data-slot="avatar"]');
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 2000, message });

describe('avatarInitials', () => {
  it('takes the first letters of the first and last names', () => {
    expect(avatarInitials(`${given} ${family}`)).toBe(`${given.charAt(0)} ${family.charAt(0)}`);
  });
  it('skips «ال» before a name', () => {
    expect(avatarInitials(WITH_AL)).toBe(`${given.charAt(0)} ${family.charAt(0)}`);
  });
  it('ignores a title such as «د.» and extra spaces', () => {
    expect(avatarInitials(`  د. ${given}   ${family} `)).toBe(
      `${given.charAt(0)} ${family.charAt(0)}`,
    );
  });
  it('gives two capitals for a Latin name, one letter for one name', () => {
    expect(avatarInitials('rami saleh')).toBe('RS');
    expect(avatarInitials(given)).toBe(given.charAt(0));
  });
});

describe.each(DIRS)('Avatar in %s', (dir) => {
  it('without a picture: initials, named by the full name', async () => {
    const screen = await renderDir(<Avatar name={nameAt(1)} />, { dir });
    const avatar = screen.getByRole('img', { name: nameAt(1) }).element();
    expect(avatar.textContent.replace(/\s/g, '')).toBe(
      avatarInitials(nameAt(1)).replace(/\s/g, ''),
    );
    await screen.unmount();
  });

  it('a Latin name is isolated', async () => {
    const screen = await renderDir(<Avatar name="Rami Saleh" />, { dir });
    expect(avatarEl()?.querySelector('bdi')?.textContent).toBe('RS');
    await screen.unmount();
  });

  it('the same name always takes the same colour, from the avatar palette', async () => {
    const screen = await renderDir(
      <>
        <Avatar name={nameAt(2)} />
        <Avatar name={nameAt(2)} />
      </>,
      { dir },
    );
    const [a, b] = [...document.querySelectorAll('[data-slot="avatar"]')].map(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(a).toBe(b);
    const hue = document.querySelector<HTMLElement>('[data-slot="avatar"]')?.dataset['hue'];
    expect(['green', 'gold', 'blue', 'violet', 'cyan', 'sand']).toContain(hue);
    await screen.unmount();
  });

  it('names spread over more than one colour', async () => {
    const screen = await renderDir(
      <>
        {CREW.map((p) => (
          <Avatar key={p.id} name={p.name} />
        ))}
      </>,
      { dir },
    );
    const hues = new Set(
      [...document.querySelectorAll<HTMLElement>('[data-slot="avatar"]')].map(
        (el) => el.dataset['hue'],
      ),
    );
    expect(hues.size).toBeGreaterThan(1);
    await screen.unmount();
  });

  it('shows the picture once it loads, named by its text', async () => {
    const screen = await renderDir(<Avatar name={nameAt(3)} src={PIXEL} />, { dir });
    await poll(() => avatarEl()?.querySelector('img') !== null, 'the picture').toBe(true);
    expect(screen.getByRole('img', { name: nameAt(3) }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('a broken picture falls back to the initials', async () => {
    const screen = await renderDir(<Avatar name={nameAt(4)} src="/no-such-picture.png" />, {
      dir,
    });
    await poll(
      () => avatarEl()?.textContent.replace(/\s/g, ''),
      'initials after the failed load',
    ).toBe(avatarInitials(nameAt(4)).replace(/\s/g, ''));
    expect(avatarEl()?.querySelector('img')).toBeNull();
    await screen.unmount();
  });

  it('has five sizes from the tokens', async () => {
    const screen = await renderDir(
      <>
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
          <Avatar key={size} name={nameAt(0)} size={size} />
        ))}
      </>,
      { dir },
    );
    const widths = [...document.querySelectorAll('[data-slot="avatar"]')].map(
      (el) => el.getBoundingClientRect().width,
    );
    expect(widths).toEqual([24, 32, 40, 56, 80]);
    await screen.unmount();
  });

  it('a group shows the first ones and names the rest', async () => {
    const screen = await renderDir(
      <AvatarGroup label="الأطباء المناوبون" people={CREW} max={3} />,
      { dir },
    );
    const group = screen.getByRole('group', { name: 'الأطباء المناوبون' }).element();
    expect(group.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
    const more = screen.getByRole('img', { name: 'و3 آخرون' }).element();
    expect(more.textContent).toBe('+3');
    // The group overlaps toward the logical end: the second avatar sits after the first.
    const [first, second] = [...group.querySelectorAll('[data-slot="avatar"]')].map((el) =>
      el.getBoundingClientRect(),
    );
    if (first === undefined || second === undefined) throw new Error('two avatars');
    if (dir === 'rtl') expect(second.left).toBeLessThan(first.left);
    else expect(second.left).toBeGreaterThan(first.left);
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <>
          {CREW.map((p) => (
            <Avatar key={p.id} name={p.name} />
          ))}
          <Avatar name="Rami Saleh" size="lg" />
          <AvatarGroup label="الأطباء المناوبون" people={CREW} max={3} />
        </>,
        { dir, theme },
      );
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
