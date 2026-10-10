import { type Page, expect } from '@playwright/test';

type TopicId =
  | 'contraception'
  | 'pregnancy'
  | 'sti'
  | 'menstrual-cycle'
  | 'general';

type RiskTarget = 'low' | 'urgent';
// Path chosen on Home; decides the conversation kind the triage creates.
type Mode = 'professional' | 'ai';

type CurrentMeta = {
  id: string;
  type: 'multiple-choice' | 'yes-no' | 'scale' | 'text';
  alert: { level: string; minScale?: number; equals?: string[] } | null;
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

// Taps a triage option and waits for what it leads to: the next question, the
// alert, or leaving the triage. The chosen option stays on screen for a moment
// (CHOICE_HOLD_MS in app/triage.tsx) and taps meanwhile are ignored, so a
// second click straight away would land on the same question.
export async function chooseTriageOption(page: Page, testId: string) {
  const progress = page.getByText(/^Pergunta \d+ de \d+$/);
  const before = await progress.textContent();
  await page.getByTestId(testId).click();
  await expect
    .poll(async () => {
      if (!/\/triage/.test(page.url())) return 'left';
      if (await page.getByTestId('triage-alert').count()) return 'alert';
      return (await progress.textContent().catch(() => null)) ?? 'gone';
    })
    .not.toBe(before);
}

// An emergency, urgent or time-sensitive answer halts the triage on the alert
// until it's dismissed; priority-level answers show nothing.
async function dismissTriageAlert(page: Page) {
  await expect(page.getByTestId('triage-alert')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('triage-alert-dismiss').click();
}

const showsAlert = (meta: CurrentMeta) => !!meta.alert && meta.alert.level !== 'priority';

async function answerSingle(
  page: Page,
  meta: CurrentMeta,
  target: RiskTarget,
) {
  if (meta.type === 'yes-no') {
    const value = target === 'urgent' && meta.alert ? 'yes' : 'no';
    await chooseTriageOption(page, `triage-option-${value}`);
    if (value === 'yes' && showsAlert(meta)) await dismissTriageAlert(page);
    return;
  }
  if (meta.type === 'multiple-choice') {
    // Deterministic safe choice — first option.
    await chooseTriageOption(page, 'triage-option-0');
    return;
  }
  if (meta.type === 'scale') {
    const value = target === 'urgent' ? '10' : '1';
    await chooseTriageOption(page, `triage-scale-${value}`);
    if (value === '10' && showsAlert(meta)) await dismissTriageAlert(page);
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
  opts: { topic: TopicId; target: RiskTarget; mode?: Mode },
) {
  await page.goto(`/triage?topic=${opts.topic}&mode=${opts.mode ?? 'professional'}`);
  let meta = await waitForMeta(page, (m) => m.step === 0);
  while (true) {
    const previous = meta;
    await answerSingle(page, previous, opts.target);
    if (previous.isLast) return;
    meta = await waitForMeta(page, (m) => m.step === previous.step + 1);
  }
}
