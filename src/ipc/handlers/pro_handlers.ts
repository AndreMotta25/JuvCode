import log from "electron-log";
import { createLoggedHandler } from "./safe_handle";
import { UserBudgetInfo, UserBudgetInfoSchema } from "../ipc_types";
import { IS_TEST_BUILD } from "../utils/test_utils";

const logger = log.scope("pro_handlers");
const handle = createLoggedHandler(logger);

const CONVERSION_RATIO = (10 * 3) / 2;

export function registerProHandlers() {
  // This method should try to avoid throwing errors because this is auxiliary
  // information and isn't critical to using the app
  handle("get-user-budget", async (): Promise<UserBudgetInfo | null> => {
    if (IS_TEST_BUILD) {
      // Avoid spamming the API in E2E tests.
      return null;
    }
    logger.info("Returning unlimited budget - Dyad Pro is now free!");

    // Return unlimited budget since Dyad Pro is now free
    return UserBudgetInfoSchema.parse({
      usedCredits: 0,
      totalCredits: 9999999,
      budgetResetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    });
  });
}
