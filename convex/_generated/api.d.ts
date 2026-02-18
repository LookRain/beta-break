/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as counter from "../counter.js";
import type * as http from "../http.js";
import type * as profiles from "../profiles.js";
import type * as savedItems from "../savedItems.js";
import type * as trainingItems from "../trainingItems.js";
import type * as trainingLogs from "../trainingLogs.js";
import type * as trainingSchedule from "../trainingSchedule.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  counter: typeof counter;
  http: typeof http;
  profiles: typeof profiles;
  savedItems: typeof savedItems;
  trainingItems: typeof trainingItems;
  trainingLogs: typeof trainingLogs;
  trainingSchedule: typeof trainingSchedule;
  users: typeof users;
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
