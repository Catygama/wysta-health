import { type Page, expect } from '@playwright/test';

type TopicId =
  | 'contraception'
  | 'pregnancy'
  | 'sti'
  | 'menstrual-cycle'
  | 'general';

type RiskTarget = 'low' | 'urgent';

type CurrentMeta = {
  id: string;
  type: 'multiple-choice' | 'yes-no' | 'scale' | 'text';
  isRedFlag: boolean;
  options: string[] | null;
  step: number;
  total: number;
  isLast: boolean;
};

async function readMetaOnce(page: Page): Promise<CurrentMeta | null> {
  const json = await page
    .getByTestId('triage-current-meta')
    .textContent({ timeout: 5_000 })
    .catch(() => null);
  if (!json) return null;
  try {
    return JSON.parse(json) as CurrentMeta;
  } catch {
    return null;
  }
}

async function waitForMeta(
  page: Page,
  predicate: (meta: CurrentMeta) => boolean,
): Promise<CurrentMeta> {
  let last: CurrentMeta | null = null;
  await expect
    .poll(
      async () => {
        const meta = await readMetaOnce(page);
        if (meta && predicate(meta)) {
          last = meta;
          return true;
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return last!;
}

// A red-flag answer halts the triage on the urgency alert until it's dismissed.
async function dismissUrgencyAlert(page: Page) {
  await expect(page.getByTestId('urgency-alert')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('urgency-dismiss').click();
}

async function answerSingle(
  page: Page,
  meta: CurrentMeta,
  target: RiskTarget,
) {
  if (meta.type === 'yes-no') {
    const value = target === 'urgent' && meta.isRedFlag ? 'yes' : 'no';
    await page.getByTestId(`triage-option-${value}`).click();
    if (value === 'yes') await dismissUrgencyAlert(page);
    return;
  }
  if (meta.type === 'multiple-choice') {
    // Deterministic safe choice — first option.
    await page.getByTestId('triage-option-0').click();
    return;
  }
  if (meta.type === 'scale') {
    const value = target === 'urgent' ? '10' : '1';
    await page.getByTestId(`triage-scale-${value}`).click();
    if (value === '10' && meta.isRedFlag) await dismissUrgencyAlert(page);
    return;
  }
  if (meta.type === 'text') {
    await page.getByTestId('triage-text-input').fill('teste');
    await page.getByTestId('triage-text-submit').click();
    return;
  }
  throw new Error(`Unknown question type: ${meta.type}`);
}

export async function answerTriage(
  page: Page,
  opts: { topic: TopicId; target: RiskTarget },
) {
  await page.goto(`/triage?topic=${opts.topic}`);
  let meta = await waitForMeta(page, (m) => m.step === 0);
  while (true) {
    const previous = meta;
    await answerSingle(page, previous, opts.target);
    if (previous.isLast) return;
    meta = await waitForMeta(page, (m) => m.step === previous.step + 1);
  }
}
