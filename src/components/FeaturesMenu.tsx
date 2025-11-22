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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Info } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function FeaturesMenu() {
  const { settings, updateSettings } = useSettings();

  const toggleAdaptiveContext = () => {
    updateSettings({
      adaptiveContextEnabled: !settings?.adaptiveContextEnabled,
    });
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="has-[>svg]:px-1.5 flex items-center gap-1.5 h-8 border-primary/50 hover:bg-primary/10 font-medium shadow-sm shadow-primary/10 transition-all hover:shadow-md hover:shadow-primary/15"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium text-xs-sm">Features</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Configurar funcionalidades</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 border-primary/20">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">Features</span>
            </h4>
            <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="adaptive-context">Adaptive Context</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-72">
                  Quando habilitado, usa contexto mínimo para reduzir tokens; desabilitado, inclui toda a base.
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              id="adaptive-context"
              checked={Boolean(settings?.adaptiveContextEnabled)}
              onCheckedChange={toggleAdaptiveContext}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

