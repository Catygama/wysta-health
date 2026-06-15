// Canonical source of conversation topic ids. Mirrors the AI registry pattern
// (convex/ai/registry.ts): one place defines the topic literals + validator;
// every convex file imports from here instead of re-declaring the union. The
// app layers UI metadata (label/icon/colour) on top in constants/topics.ts.
//
// To add a topic: add it to TOPIC_IDS AND to topicValidator below, then add a
// UI entry in constants/topics.ts + colour pair in lib/unistyles.ts.
import { v } from 'convex/values';

export const TOPIC_IDS = [
  'contraception',
  'pregnancy',
  'sti',
  'menstrual-cycle',
  'general',
  'sexual-wellbeing',
] as const;

export type TopicId = (typeof TOPIC_IDS)[number];

// Kept in lockstep with TOPIC_IDS. Written out explicitly (not spread) so
// Convex keeps precise arg-type inference — but it lives in one file now.
export const topicValidator = v.union(
  v.literal('contraception'),
  v.literal('pregnancy'),
  v.literal('sti'),
  v.literal('menstrual-cycle'),
  v.literal('general'),
  v.literal('sexual-wellbeing')
);
