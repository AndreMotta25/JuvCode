import { withLock } from "../ipc/utils/lock_utils";
import { readSettings, writeSettings } from "../main/settings";
import {
  SupabaseManagementAPI,
  SupabaseManagementAPIError,
} from "@dyad-sh/supabase-management-js";
import log from "electron-log";
import { IS_TEST_BUILD } from "../ipc/utils/test_utils";

const logger = log.scope("supabase_management_client_fixed");

/**
 * Checks if the Supabase access token is expired or about to expire
 * Returns true if token needs to be refreshed
 */
function isTokenExpired(expiresIn?: number): boolean {
  if (!expiresIn) return true;

  // Get when the token was saved (expiresIn is stored at the time of token receipt)
  const settings = readSettings();
  const tokenTimestamp = settings.supabase?.tokenTimestamp || 0;
  const currentTime = Math.floor(Date.now() / 1000);

  // Check if the token is expired or about to expire (within 5 minutes)
  return currentTime >= tokenTimestamp + expiresIn - 300;
}

/**
 * Refreshes the Supabase access token using the refresh token
 * Updates settings with new tokens and expiration time
 */
export async function refreshSupabaseToken(): Promise<void> {
  const settings = readSettings();
  const refreshToken = settings.supabase?.refreshToken?.value;

  if (!isTokenExpired(settings.supabase?.expiresIn)) {
    return;
  }

  if (!refreshToken) {
    throw new Error(
      "Supabase refresh token not found. Please authenticate first.",
    );
  }

  try {
    // Make request to Supabase refresh endpoint
    const response = await fetch(
      "https://supabase-oauth.dyad.sh/api/connect-supabase/refresh",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Supabase token refresh failed. Try going to Settings to disconnect Supabase and then reconnect to Supabase. Error status: ${response.statusText}`,
      );
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    } = await response.json();

    // Update settings with new tokens
    writeSettings({
      supabase: {
        accessToken: {
          value: accessToken,
        },
        refreshToken: {
          value: newRefreshToken,
        },
        expiresIn,
        tokenTimestamp: Math.floor(Date.now() / 1000), // Store current timestamp
      },
    });
  } catch (error) {
    logger.error("Error refreshing Supabase token:", error);
    throw error;
  }
}

// Function to get the Supabase Management API client
export async function getSupabaseClient(): Promise<SupabaseManagementAPI> {
  const settings = readSettings();

  // Check if Supabase token exists in settings
  const supabaseAccessToken = settings.supabase?.accessToken?.value;
  const expiresIn = settings.supabase?.expiresIn;

  if (!supabaseAccessToken) {
    throw new Error(
      "Supabase access token not found. Please authenticate first.",
    );
  }

  // Check if token needs refreshing
  if (isTokenExpired(expiresIn)) {
    await withLock("refresh-supabase-token", refreshSupabaseToken);
    // Get updated settings after refresh
    const updatedSettings = readSettings();
    const newAccessToken = updatedSettings.supabase?.accessToken?.value;

    if (!newAccessToken) {
      throw new Error("Failed to refresh Supabase access token");
    }

    return new SupabaseManagementAPI({
      accessToken: newAccessToken,
    });
  }

  return new SupabaseManagementAPI({
    accessToken: supabaseAccessToken,
  });
}

export async function getSupabaseProjectName(
  projectId: string,
): Promise<string> {
  if (IS_TEST_BUILD) {
    return "Fake Supabase Project";
  }

  const supabase = await getSupabaseClient();
  const projects = await supabase.getProjects();
  const project = projects?.find((p) => p.id === projectId);
  return project?.name || `<project not found for: ${projectId}>`;
}

/**
 * Fixed version of executeSupabaseSql that handles both 200 and 201 status codes
 */
export async function executeSupabaseSql({
  supabaseProjectId,
  query,
}: {
  supabaseProjectId: string;
  query: string;
}): Promise<string> {
  if (IS_TEST_BUILD) {
    return "{}";
  }

  const supabase = await getSupabaseClient();
  
  try {
    // Use the original runQuery method
    const result = await supabase.runQuery(supabaseProjectId, query);
    return JSON.stringify(result);
  } catch (error) {
    // Check if it's a SupabaseManagementAPIError with status 200
    if (error instanceof SupabaseManagementAPIError && error.response?.status === 200) {
      logger.warn("Supabase API returned 200 OK instead of 201 Created, treating as success");
      
      // Try to get the response body and parse it
      try {
        const responseText = await error.response.text();
        logger.info(`Response body for status 200: ${responseText.substring(0, 1000)}${responseText.length > 1000 ? '...' : ''}`);
        
        if (responseText && responseText.trim()) {
          // Try to parse as JSON first
          try {
            const parsedResponse = JSON.parse(responseText);
            return JSON.stringify(parsedResponse);
          } catch (jsonError) {
            logger.warn(`Response body is not valid JSON: ${jsonError}`);
            // Try to extract JSON-like content from the response
            const jsonMatch = responseText.match(/\{.*\}/);
            if (jsonMatch) {
              logger.info(`Extracted JSON from response: ${jsonMatch[0]}`);
              return jsonMatch[0];
            }
          }
        } else {
          logger.warn("Empty response body for status 200, returning empty object");
          // If response body is empty, return empty object
          return "{}";
        }
      } catch (parseError) {
        logger.error(`Failed to parse response body: ${parseError}`);
        // If parsing fails, try to extract any available data from error message
        try {
          if (error.message && error.message.includes("OK (200)")) {
            // Extract any JSON-like content from the error message
            const jsonMatch = error.message.match(/\{.*\}/);
            if (jsonMatch) {
              logger.info(`Extracted JSON from error message: ${jsonMatch[0]}`);
              return jsonMatch[0];
            }
          }
        } catch (extractError) {
          logger.error(`Failed to extract JSON from error message: ${extractError}`);
        }
        
        // If all parsing fails, return empty object as fallback
        logger.warn("All parsing attempts failed, returning empty object");
        return "{}";
      }
    }
    
    // For other errors, re-throw them with more context
    logger.error(`Supabase query failed for project ${supabaseProjectId}: ${error}`);
    throw error;
  }
}

export async function deleteSupabaseFunction({
  supabaseProjectId,
  functionName,
}: {
  supabaseProjectId: string;
  functionName: string;
}): Promise<void> {
  logger.info(
    `Deleting Supabase function: ${functionName} from project: ${supabaseProjectId}`,
  );
  const supabase = await getSupabaseClient();
  await supabase.deleteFunction(supabaseProjectId, functionName);
  logger.info(
    `Deleted Supabase function: ${functionName} from project: ${supabaseProjectId}`,
  );
}

export async function listSupabaseBranches({
  supabaseProjectId,
}: {
  supabaseProjectId: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    is_default: boolean;
    project_ref: string;
    parent_project_ref: string;
  }>
> {
  if (IS_TEST_BUILD) {
    return [
      {
        id: "default-branch-id",
        name: "Default Branch",
        is_default: true,
        project_ref: "fake-project-id",
        parent_project_ref: "fake-project-id",
      },

      {
        id: "test-branch-id",
        name: "Test Branch",
        is_default: false,
        project_ref: "test-branch-project-id",
        parent_project_ref: "fake-project-id",
      },
    ];
  }

  logger.info(`Listing Supabase branches for project: ${supabaseProjectId}`);
  const supabase = await getSupabaseClient();

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${supabaseProjectId}/branches`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${(supabase as any).options.accessToken}`,
      },
    },
  );

  if (response.status !== 200) {
    throw await createResponseError(response, "list branches");
  }

  logger.info(`Listed Supabase branches for project: ${supabaseProjectId}`);
  const jsonResponse = await response.json();
  return jsonResponse;
}

export async function deploySupabaseFunctions({
  supabaseProjectId,
  functionName,
  content,
}: {
  supabaseProjectId: string;
  functionName: string;
  content: string;
}): Promise<void> {
  logger.info(
    `Deploying Supabase function: ${functionName} to project: ${supabaseProjectId}`,
  );
  const supabase = await getSupabaseClient();
  const formData = new FormData();
  formData.append(
    "metadata",
    JSON.stringify({
      entrypoint_path: "index.ts",
      name: functionName,
      // See: https://github.com/dyad-sh/dyad/issues/1010
      verify_jwt: false,
    }),
  );
  formData.append("file", new Blob([content]), "index.ts");

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${supabaseProjectId}/functions/deploy?slug=${functionName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(supabase as any).options.accessToken}`,
      },
      body: formData,
    },
  );

  if (response.status !== 201) {
    throw await createResponseError(response, "create function");
  }

  logger.info(
    `Deployed Supabase function: ${functionName} to project: ${supabaseProjectId}`,
  );
  return response.json();
}

async function createResponseError(response: Response, action: string) {
  const errorBody = await safeParseErrorResponseBody(response);

  return new SupabaseManagementAPIError(
    `Failed to ${action}: ${response.statusText} (${response.status})${
      errorBody ? `: ${errorBody.message}` : ""
    }`,
    response,
  );
}

async function safeParseErrorResponseBody(
  response: Response,
): Promise<{ message: string } | undefined> {
  try {
    const body = await response.json();

    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return { message: body.message };
    }
  } catch {
    return;
  }
}