/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { TOPIC_IDS } from './topics';

describe('topic registry', () => {
  it('lists the canonical topics plus sexual-wellbeing in order', () => {
    expect(TOPIC_IDS).toEqual([
      'contraception',
      'pregnancy',
      'sti',
      'menstrual-cycle',
      'general',
      'sexual-wellbeing',
    ]);
  });
});
