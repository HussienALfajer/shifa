# UsageChart

Daily counts of the last 30 days as bars: sign-ins, members signed in, any count per day.

Coded from the sheet the owner approved on 2026-11-27 (Shifa Screens · Admin web, page "Proposals", `A02SheetUsageChart`, slice A-02-01), tested in Arabic RTL and English LTR, light and dark, both densities. No charting library.

## When to use
- A count per day over a month, read for its trend and its days without activity.
- Not for comparing categories or for money over time; the figures above it (total, average, highest day) and the switch between series belong to the screen.

## Look
Bars in the brand colour, today in gold, a day without activity a thin line in the strong border colour. Time runs from left to right in both directions, like the digits. A y-axis in quarters of whole numbers with grid lines; the daily average as a dashed gold line, named with its figure at the oldest days. Under the bars every seventh day and «اليوم»; a legend of the three marks. The plot is 200 px tall. With no day: the empty state «لا بيانات بعد»; while loading: a placeholder of the chart's height.

## Behaviour
Each bar opens the system's Tooltip on hover or keyboard focus: the figure with its unit, then the day («14 تسجيل دخول · 26/11»). One Tab stop, today first; Left and Right move to the day at that side, Home and End to the oldest day and today. Screen readers hear the chart's name and a summary (total, daily average, highest day); the axes, grid and legend are hidden from them.

## What you provide (design system)
`aria-label`, `days` (`date` as `YYYY-MM-DD`, `count`; oldest first), `unit` («{n} تسجيل دخول»), `lastIsToday`, `loading`.

In code: the same, with `unit` as a function of the count, and `labels` for other words (Arabic in RTL and English in LTR by default).

## Tokens
`shifa-color-brand-primary`, `-primary-hover`, `shifa-color-brand-accent`, `shifa-color-border-strong`, `shifa-color-border-default`, `shifa-color-text-muted`, `shifa-color-bg-surface`, `shifa-shape-radius-mark`, `shifa-text-size-caption`, `shifa-width-100`.
