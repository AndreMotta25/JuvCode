import { atom } from "jotai";

// Atom para controlar se o terminal está visível
export const isTerminalVisibleAtom = atom(false);

// Atom para controlar a altura do terminal
export const terminalHeightAtom = atom(200);