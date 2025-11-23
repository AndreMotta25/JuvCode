import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Palette, Info } from "lucide-react";
import { useReferenceStyles } from "@/hooks/useReferenceStyles";
import { AttachmentsList } from "@/components/chat/AttachmentsList";

export function ReferenceStylesMenu() {
  const {
    attachments,
    isDraggingOver,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeAttachment,
    clearAttachments,
  } = useReferenceStyles();

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label="Reference Styles"
              variant="outline"
              size="sm"
              className="px-2 h-8 border-primary/50 hover:bg-primary/10 shadow-sm shadow-primary/10 transition-all hover:shadow-md hover:shadow-primary/15"
            >
              <Palette className="h-4 w-4 text-primary" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Enviar imagens de referência</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-96 border-primary/20">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-primary font-medium">Reference Styles</span>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            png, jpg/jpeg, webp, svg. Usado automaticamente como contexto do chat para criação de layout.
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-lg border border-dashed p-4 text-center ${
              isDraggingOver ? "bg-blue-100/30 dark:bg-blue-900/30" : ""
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" size="sm" onClick={handleAttachmentClick}>
              Selecionar imagens
            </Button>
            <div className="mt-2 text-xs text-muted-foreground">Arraste e solte aqui</div>
          </div>
          <AttachmentsList attachments={attachments} onRemove={removeAttachment} />
          {attachments.length > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAttachments}>
                Limpar referências
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
