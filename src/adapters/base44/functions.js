// Same invokeFunction(name, payload) the services already call.
import { importCsv } from "@/app/functions/importCsv";
import { loadDemoData } from "@/app/functions/loadDemoData";
import { manageHousehold } from "@/app/functions/manageHousehold";
import { recordGoalContribution } from "@/app/functions/recordGoalContribution";

const HANDLERS = {
  importCsv,
  loadDemoData,
  manageHousehold,
  recordGoalContribution,
};

export async function invokeFunction(name, payload) {
  const fn = HANDLERS[name];
  if (!fn) {
    if (name === "runDailyCoaching") {
      return { ok: true, skipped: true, reason: "cron_not_configured" };
    }
    throw new Error(`Unknown function: ${name}`);
  }
  return fn(payload || {});
}
