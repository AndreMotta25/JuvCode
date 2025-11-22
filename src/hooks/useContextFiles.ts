import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { IpcClient } from "@/ipc/ipc_client";

export function useContextFiles() {
  const appId = useAtomValue(selectedAppIdAtom);

  const { data, isLoading, error, refetch } = useQuery<{ files: string[] }, Error>({
    queryKey: ["context-files", appId],
    queryFn: async () => {
      if (!appId) return { files: [] };
      const ipc = IpcClient.getInstance();
      return ipc.getChatContextFiles({ appId });
    },
    enabled: !!appId,
  });

  return {
    files: data?.files || [],
    isLoading,
    error,
    refetch,
  };
}
