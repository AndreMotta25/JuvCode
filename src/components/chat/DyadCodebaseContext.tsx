import React, { useState, useEffect, useMemo } from "react";
import { ChevronUp, ChevronDown, Code2, FileText, Copy, FolderOpen } from "lucide-react";
import { CustomTagState } from "./stateTypes";
import { Button } from "@/components/ui/button";
import { IpcClient } from "@/ipc/ipc_client";
import { useAtomValue } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useContextPaths } from "@/hooks/useContextPaths";

interface DyadCodebaseContextProps {
  children: React.ReactNode;
  node?: {
    properties?: {
      files?: string;
      state?: CustomTagState;
    };
  };
}

export const DyadCodebaseContext: React.FC<DyadCodebaseContextProps> = ({
  node,
}) => {
  const state = node?.properties?.state as CustomTagState;
  const inProgress = state === "pending";
  const [isExpanded, setIsExpanded] = useState(inProgress);
  const explicitFiles = node?.properties?.files?.split(",") || [];
  const appId = useAtomValue(selectedAppIdAtom);
  const { contextPaths, smartContextAutoIncludes, excludePaths, isLoading, error } = useContextPaths();
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Collapse when transitioning from in-progress to not-in-progress
  useEffect(() => {
    if (!inProgress && isExpanded) {
      setIsExpanded(false);
    }
  }, [inProgress]);

  const files = useMemo(() => explicitFiles.map((f) => f.trim()).filter(Boolean), [explicitFiles]);

  return (
    <div
      className={`relative bg-(--background-lightest) dark:bg-zinc-900 hover:bg-(--background-lighter) rounded-lg px-4 py-2 border my-2 cursor-pointer ${
        inProgress ? "border-blue-500" : "border-border"
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      aria-expanded={isExpanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      {/* Top-left label badge */}
      <div
        className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-blue-500 bg-white dark:bg-zinc-900"
        style={{ zIndex: 1 }}
      >
        <Code2 size={16} className="text-blue-500" />
        <span>Codebase Context</span>
      </div>

      {/* File count when collapsed */}
      {files.length > 0 && (
        <div className="absolute top-2 left-40 flex items-center">
          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-xs rounded text-gray-600 dark:text-gray-300">
            Using {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Indicator icon */}
      <div className="absolute top-2 right-2 p-1 text-gray-500">
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {/* Main content with smooth transition */
      }
      <div
        className="pt-6 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? "1000px" : "0px",
          opacity: isExpanded ? 1 : 0,
          marginBottom: isExpanded ? "0" : "-6px", // Compensate for padding
        }}
      >
        {/* File list when expanded */}
        {files.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2 mt-2">
              {files.slice(0, visibleCount).map((file, index) => {
                const filePath = file.trim();
                const fileName = filePath.replace(/\\/g, "/").split("/").pop() || filePath;

                return (
                  <div
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText
                        size={14}
                        className="text-gray-500 dark:text-gray-400 flex-shrink-0"
                      />
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {fileName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-5 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(filePath).then(() => {
                            setCopiedPath(filePath);
                            setTimeout(() => setCopiedPath(null), 1500);
                          });
                        }}
                        className="has-[>svg]:px-2"
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (appId) {
                            IpcClient.getInstance().showItemInFolder(filePath);
                          }
                        }}
                        className="has-[>svg]:px-2"
                      >
                        <FolderOpen size={14} />
                      </Button>
                      {copiedPath === filePath && (
                        <span className="text-xs text-green-600">Copied</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {files.length > visibleCount && (
                <div className="w-full mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleCount((c) => c + 50);
                    }}
                  >
                    Show more
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {files.length === 0 && (
          <div className="mb-3 space-y-3">
            {error && (
              <div className="text-sm text-red-600">Failed to load context</div>
            )}
            {isLoading && (
              <div className="text-sm text-muted-foreground">Loading context…</div>
            )}
            {!isLoading && (
              <div className="space-y-2">
                {contextPaths.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Included Paths</div>
                    <div className="space-y-1 mt-1">
                      {contextPaths.map((p, i) => (
                        <div key={`${p.globPath}-${i}`} className="flex items-center justify-between rounded-md border p-2">
                          <span className="font-mono text-xs truncate" title={p.globPath}>{p.globPath}</span>
                          <span className="text-xs text-muted-foreground">{p.files} files ~{p.tokens} tokens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {excludePaths.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Excluded Paths</div>
                    <div className="space-y-1 mt-1">
                      {excludePaths.map((p, i) => (
                        <div key={`${p.globPath}-${i}`} className="flex items-center justify-between rounded-md border p-2">
                          <span className="font-mono text-xs truncate" title={p.globPath}>{p.globPath}</span>
                          <span className="text-xs text-muted-foreground">{p.files} files ~{p.tokens} tokens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {smartContextAutoIncludes.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Auto-included (Smart)</div>
                    <div className="space-y-1 mt-1">
                      {smartContextAutoIncludes.map((p, i) => (
                        <div key={`${p.globPath}-${i}`} className="flex items-center justify-between rounded-md border p-2">
                          <span className="font-mono text-xs truncate" title={p.globPath}>{p.globPath}</span>
                          <span className="text-xs text-muted-foreground">{p.files} files ~{p.tokens} tokens</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {contextPaths.length === 0 && smartContextAutoIncludes.length === 0 && (
                  <div className="text-sm text-muted-foreground">No explicit file list available. Showing current context patterns.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
