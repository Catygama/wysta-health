import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loginAs } from '../../helpers/auth';
import { sendMessage } from '../../helpers/conversation';
import { convexClient, seedConversation, seedUser } from '../../helpers/convex';
import { api } from '../../../convex/_generated/api';

const ANSWER = 'Se te esqueceste de uma pílula, toma-a assim que te lembrares.';

// A stand-in for the OpenAI Responses API, so the whole agent chain (draft,
// validators, judge) runs without a real key. The draft takes a moment, so
// the "A preparar a resposta…" placeholder is visible first.
function startFakeOpenAi(): Promise<{ server: Server; url: string; questions: string[] }> {
  const questions: string[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const body = JSON.parse(raw || '{}');
      const schema = body.text?.format?.schema;
      let text: string;
      if (schema?.properties?.action) {
        text = JSON.stringify({ action: 'send', finalAnswer: ANSWER });
      } else if (schema?.properties?.decision) {
        text = JSON.stringify({ decision: 'approve', reason: 'ok' });
      } else {
        questions.push(JSON.stringify(body.input));
        await new Promise((r) => setTimeout(r, 2500));
        text = ANSWER;
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'resp_e2e',
          created_at: Math.floor(Date.now() / 1000),
          model: body.model,
          output: [
            {
              type: 'message',
              role: 'assistant',
              id: 'msg_e2e',
              content: [{ type: 'output_text', text, annotations: [] }],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
        })
      );
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, questions })
    )
  );
}

test('switching to the AI answers the message the nurse has not answered yet', async ({ page }, testInfo) => {
  const fake = await startFakeOpenAi();
  try {
    for (const purpose of ['chat', 'chat-validator-safety', 'chat-validator-clinical', 'chat-judge'] as const) {
      await convexClient.mutation(api.testing.seedAiConfig, {
        purpose,
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        endpoint: fake.url,
        apiKey: 'sk-e2e-fake',
      });
      await convexClient.mutation(api.testing.seedAiPrompt, {
        purpose,
        systemPrompt: 'E2E',
        userTemplate: '{{query}}',
      });
    }
    // A patient of her own, with a conversation waiting for a nurse.
    const email = `pendente-ia-${testInfo.project.name}-${Date.now()}@e2e.local`;
    await seedUser({ email, password: 'e2e-test-pw', role: 'patient', profile: { displayName: 'Pendente' } });
    const { conversationId } = await seedConversation({
      patientEmail: email,
      topic: 'contraception',
      title: 'Pergunta pendente',
      status: 'waiting',
    });

    await loginAs(page, email);
    await page.goto(`/(patient)/conversations/${conversationId}`);
    await sendMessage(page, 'Esqueci-me da pílula ontem, o que faço?');
    await page.getByTestId('conversation-switch-to-ai').click();

    // No new message typed: the AI picks up the pending one by itself.
    const thread = page.getByTestId('messages-list-chat');
    await expect(thread.getByText('A preparar a resposta…')).toBeVisible({ timeout: 15_000 });
    await expect(thread.getByText(ANSWER)).toBeVisible({ timeout: 20_000 });
    await expect(thread.getByText('A preparar a resposta…')).toHaveCount(0);
    expect(fake.questions).toHaveLength(1);
    expect(fake.questions[0]).toContain('Esqueci-me da pílula ontem, o que faço?');
  } finally {
    fake.server.close();
  }
});
