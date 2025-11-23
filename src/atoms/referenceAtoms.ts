import { atom } from "jotai";
import type { FileAttachment } from "@/ipc/ipc_types";

export const referenceStylesAttachmentsAtom = atom<FileAttachment[]>([]);
