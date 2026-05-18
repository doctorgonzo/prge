// src/lib/budget.ts
// Daily cost cap + token spend tracker. Mirrors the agentSpam pattern.
// Persists to a JSON file on disk; resets each calendar day.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PRGE_STATE_DIR } from "./state-dir";

const STATE_FILE = join(PRGE_STATE_DIR, "budget.json");

// Default daily cap if env not set. Keep it low — single-user demo.
const DEFAULT_DAILY_CAP_USD = 0.25;

// Haiku 4.5 pricing per 1M tokens (as of 2026-05).
// Adjust if model changes.
const PRICE = {
  inputPerM: 1.00,           // standard input
  cachedInputPerM: 0.10,     // cache read (90% off)
  cacheWritePerM: 1.25,      // cache write (25% surcharge)
  outputPerM: 5.00,          // output
};

interface BudgetState {
  date: string;       // YYYY-MM-DD
  spentUsd: number;
  callCount: number;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCapUsd(): number {
  const env = Number(process.env.DAILY_CAP_USD);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_DAILY_CAP_USD;
}

async function readState(): Promise<BudgetState> {
  try {
    const text = await readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(text) as BudgetState;
    if (parsed.date !== todayKey()) {
      // new day, reset
      return { date: todayKey(), spentUsd: 0, callCount: 0 };
    }
    return parsed;
  } catch {
    return { date: todayKey(), spentUsd: 0, callCount: 0 };
  }
}

async function writeState(state: BudgetState): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function costForUsage(usage: Usage): number {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const standardInput = Math.max(0, usage.input_tokens - cacheRead - cacheWrite);
  return (
    (standardInput / 1_000_000) * PRICE.inputPerM +
    (cacheRead / 1_000_000) * PRICE.cachedInputPerM +
    (cacheWrite / 1_000_000) * PRICE.cacheWritePerM +
    (usage.output_tokens / 1_000_000) * PRICE.outputPerM
  );
}

export interface BudgetStatus {
  allowed: boolean;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  callCountToday: number;
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const state = await readState();
  const cap = getCapUsd();
  return {
    allowed: state.spentUsd < cap,
    spentUsd: state.spentUsd,
    capUsd: cap,
    remainingUsd: Math.max(0, cap - state.spentUsd),
    callCountToday: state.callCount,
  };
}

export async function recordCost(usage: Usage): Promise<BudgetStatus> {
  const cost = costForUsage(usage);
  const state = await readState();
  state.spentUsd += cost;
  state.callCount += 1;
  await writeState(state);
  const cap = getCapUsd();
  return {
    allowed: state.spentUsd < cap,
    spentUsd: state.spentUsd,
    capUsd: cap,
    remainingUsd: Math.max(0, cap - state.spentUsd),
    callCountToday: state.callCount,
  };
}
