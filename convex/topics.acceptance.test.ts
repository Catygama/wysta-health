/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');

describe('topic taxonomy acceptance', () => {
  // triage.getByTopic validates its `topic` arg against the topic union and
  // returns .unique() (null on empty DB). If the validator accepts the new id,
  // this resolves to null; if not, the arg validator throws.
  it('accepts sexual-wellbeing on a topic-validated query', async () => {
    const t = convexTest(schema, modules);
    const res = await t.query(api.triage.getByTopic, {
      topic: 'sexual-wellbeing' as any,
    });
    expect(res).toBeNull();
  });

  it('rejects an unknown topic', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.triage.getByTopic, { topic: 'not-a-topic' as any })
    ).rejects.toThrow();
  });
});
