import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeSupabaseSql } from "../supabase_admin/supabase_management_client_fixed";
import { SupabaseManagementAPIError } from "@dyad-sh/supabase-management-js";

// Mock a response with status 200 to simulate the error scenario
function createMockErrorWithStatus200(): SupabaseManagementAPIError {
  const mockResponse = {
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve('{"data": "test"}'),
  } as any;

  return new SupabaseManagementAPIError(
    "Failed to run query: OK (200)",
    mockResponse
  );
}

describe("executeSupabaseSql Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle status 200 errors gracefully", async () => {
    // Mock the getSupabaseClient to throw our test error
    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(createMockErrorWithStatus200()),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe('{"data": "test"}');
  });

  it("should handle empty response body gracefully", async () => {
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe("{}");
  });

  it("should handle JSON parsing errors gracefully", async () => {
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve("invalid json"),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe("{}");
  });
});

describe("executeSupabaseSql Additional Tests", () => {
  it("should handle valid JSON response body with large content", async () => {
    const largeJson = {
      tables: Array(100).fill({ name: "test_table", columns: [] }),
      functions: Array(50).fill({ name: "test_function", args: [] })
    };
    
    const largeJsonString = JSON.stringify(largeJson);
    
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(largeJsonString),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe(largeJsonString);
  });

  it("should handle response with JSON embedded in text", async () => {
    const responseText = 'Some prefix text {"tables": [], "functions": []} some suffix text';
    
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(responseText),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe('{"tables": [], "functions": []}');
  });

  it("should handle response with multiple JSON objects", async () => {
    const responseText = '{"tables": []} {"functions": []}';
    
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(responseText),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    // Should extract the first JSON object found
    expect(result).toBe('{"tables": []}');
  });

  it("should handle response with malformed JSON but extractable content", async () => {
    const responseText = 'Some text before {"tables": [], "functions": [], "invalid": json} text after';
    
    const mockResponse = {
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(responseText),
    } as any;

    const error = new SupabaseManagementAPIError(
      "Failed to run query: OK (200)",
      mockResponse
    );

    vi.mock("../supabase_admin/supabase_management_client_fixed", async () => {
      const actual = await vi.importActual("../supabase_admin/supabase_management_client_fixed");
      return {
        ...actual,
        getSupabaseClient: vi.fn().mockResolvedValue({
          runQuery: vi.fn().mockRejectedValue(error),
        }),
      };
    });

    const result = await executeSupabaseSql({
      supabaseProjectId: "test-project",
      query: "SELECT 1",
    });

    expect(result).toBe('{"tables": [], "functions": [], "invalid": json}');
  });
});