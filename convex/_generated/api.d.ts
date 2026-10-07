/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_admin from "../ai/admin.js";
import type * as ai_assistant from "../ai/assistant.js";
import type * as ai_chatSummary from "../ai/chatSummary.js";
import type * as ai_configs from "../ai/configs.js";
import type * as ai_defaults from "../ai/defaults.js";
import type * as ai_invocations from "../ai/invocations.js";
import type * as ai_llm from "../ai/llm.js";
import type * as ai_pricing from "../ai/pricing.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_registry from "../ai/registry.js";
import type * as ai_runAgent from "../ai/runAgent.js";
import type * as ai_settings from "../ai/settings.js";
import type * as ai_setup from "../ai/setup.js";
import type * as ai_template from "../ai/template.js";
import type * as ai_types from "../ai/types.js";
import type * as ai_userSummary from "../ai/userSummary.js";
import type * as auth from "../auth.js";
import type * as conversations from "../conversations.js";
import type * as education from "../education.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authProbe from "../lib/authProbe.js";
import type * as lib_risk from "../lib/risk.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as lib_topics from "../lib/topics.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as seed from "../seed.js";
import type * as testing from "../testing.js";
import type * as triage from "../triage.js";
import type * as users from "../users.js";
import type * as webPush from "../webPush.js";
import type * as wellbeing from "../wellbeing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/admin": typeof ai_admin;
  "ai/assistant": typeof ai_assistant;
  "ai/chatSummary": typeof ai_chatSummary;
  "ai/configs": typeof ai_configs;
  "ai/defaults": typeof ai_defaults;
  "ai/invocations": typeof ai_invocations;
  "ai/llm": typeof ai_llm;
  "ai/pricing": typeof ai_pricing;
  "ai/prompts": typeof ai_prompts;
  "ai/registry": typeof ai_registry;
  "ai/runAgent": typeof ai_runAgent;
  "ai/settings": typeof ai_settings;
  "ai/setup": typeof ai_setup;
  "ai/template": typeof ai_template;
  "ai/types": typeof ai_types;
  "ai/userSummary": typeof ai_userSummary;
  auth: typeof auth;
  conversations: typeof conversations;
  education: typeof education;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/authProbe": typeof lib_authProbe;
  "lib/risk": typeof lib_risk;
  "lib/seedData": typeof lib_seedData;
  "lib/topics": typeof lib_topics;
  messages: typeof messages;
  notifications: typeof notifications;
  seed: typeof seed;
  testing: typeof testing;
  triage: typeof triage;
  users: typeof users;
  webPush: typeof webPush;
  wellbeing: typeof wellbeing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
