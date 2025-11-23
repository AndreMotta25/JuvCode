import { useAtom } from "jotai";
import { useRef, useState } from "react";
import type { FileAttachment } from "@/ipc/ipc_types";
import { referenceStylesAttachmentsAtom } from "@/atoms/referenceAtoms";
import { sanitizeSvgFile } from "@/lib/sanitizeSvg";

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

export function useReferenceStyles() {
  const [attachments, setAttachments] = useAtom(referenceStylesAttachmentsAtom);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: File[]) => {
    const processed: FileAttachment[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.has(file.type)) continue;
      const f = file.type === "image/svg+xml" ? await sanitizeSvgFile(file) : file;
      processed.push({ file: f, type: "chat-context" });
    }
    if (processed.length > 0) setAttachments((prev) => [...prev, ...processed]);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await addFiles(files);
      e.target.value = "";
    }
  };

  const handleFileSelect = async (fileList: FileList) => {
    const files = Array.from(fileList);
    await addFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await addFiles(files);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  return {
    attachments,
    isDraggingOver,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeAttachment,
    clearAttachments,
  };
}
