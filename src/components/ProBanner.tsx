import { KeyRound } from "lucide-react";

import { useSettings } from "@/hooks/useSettings";
import { useUserBudgetInfo } from "@/hooks/useUserBudgetInfo";
import { Button } from "./ui/button";

export function ProBanner() {
  const { settings } = useSettings();
  const { userBudget } = useUserBudgetInfo();

  // Always show the manage button since Dyad Pro is now free
  return (
    <div className="mt-6 max-w-2xl mx-auto">
      <ManageDyadProButton />
    </div>
  );
}

export function ManageDyadProButton() {
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full mt-4 bg-(--background-lighter) text-primary"
    >
      <KeyRound aria-hidden="true" />
      JuvCode Pro (Gratuito)
    </Button>
  );
}

export function SetupDyadProButton() {
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full mt-4 bg-(--background-lighter) text-primary"
    >
      <KeyRound aria-hidden="true" />
      JuvCode Pro Ativado
    </Button>
  );
}

export function AiAccessBanner() {
  return (
    <div className="w-full py-2 sm:py-2.5 md:py-3 rounded-lg bg-gradient-to-br from-white via-indigo-50 to-sky-100 dark:from-indigo-700 dark:via-indigo-700 dark:to-indigo-900 flex items-center justify-center relative overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm">
      <div
        className="absolute inset-0 z-0 bg-gradient-to-tr from-white/60 via-transparent to-transparent pointer-events-none dark:from-white/10"
        aria-hidden="true"
      />
      <div className="relative z-10 text-center flex flex-col items-center gap-0.5 sm:gap-1 md:gap-1.5 px-4 md:px-6 pr-6 md:pr-8">
        <div className="text-xl font-semibold tracking-tight text-indigo-900 dark:text-indigo-100">
          JuvCode Pro Gratuito Ativado
        </div>
        <div className="text-sm sm:text-base mt-1 text-indigo-700 dark:text-indigo-200/80">
          Acesso completo a todos os recursos Pro
        </div>
      </div>
    </div>
  );
}

export function SmartContextBanner() {
  return (
    <div className="w-full py-2 sm:py-2.5 md:py-3 rounded-lg bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-700 dark:via-emerald-700 dark:to-emerald-900 flex items-center justify-center relative overflow-hidden ring-1 ring-inset ring-emerald-900/10 dark:ring-white/10 shadow-sm">
      <div
        className="absolute inset-0 z-0 bg-gradient-to-tr from-white/60 via-transparent to-transparent pointer-events-none dark:from-white/10"
        aria-hidden="true"
      />
      <div className="relative z-10 px-4 md:px-6 pr-6 md:pr-8">
        <div className="text-center">
          <div className="text-xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-100">
            Recursos Pro Ilimitados
          </div>
          <div className="text-sm sm:text-base mt-1 text-emerald-700 dark:text-emerald-200/80">
            Turbo Edits, Smart Context e Busca na Web
          </div>
        </div>
      </div>
    </div>
  );
}

export function TurboBanner() {
  return (
    <div className="w-full py-2 sm:py-2.5 md:py-3 rounded-lg bg-gradient-to-br from-rose-50 via-rose-100 to-rose-200 dark:from-rose-800 dark:via-fuchsia-800 dark:to-rose-800 flex items-center justify-center relative overflow-hidden ring-1 ring-inset ring-rose-900/10 dark:ring-white/5 shadow-sm">
      <div
        className="absolute inset-0 z-0 bg-gradient-to-tr from-white/60 via-transparent to-transparent pointer-events-none dark:from-white/10"
        aria-hidden="true"
      />
      <div className="relative z-10 px-4 md:px-6 pr-6 md:pr-8">
        <div className="text-center">
          <div className="text-xl font-semibold tracking-tight text-rose-900 dark:text-rose-100">
            Gerar código 4–10x mais rápido
          </div>
          <div className="text-sm sm:text-base mt-1 text-rose-700 dark:text-rose-200/80">
            Com Turbo Models & Turbo Edits
          </div>
        </div>
      </div>
    </div>
  );
}
