import {
  faNetworkWired,
  faDatabase,
  faFlask,
  faCogs,
  faBurst,
  faFire,
  faTriangleExclamation,
  faCircleCheck,
  faCircleXmark,
  faShieldHalved,
  faCodePullRequest,
  faCopy,
  faCheck,
  faCode,
  faTerminal,
  faFileCode,
  faFolderTree,
  faMagnifyingGlass,
  faFilter,
  faRotate,
  faPlay,
  faCircleDot,
  faSliders,
  faBug,
  faArrowRight
} from "@fortawesome/free-solid-svg-icons";

import type { SymbolType } from "../types/impact";

export const ICONS = {
  controller: faNetworkWired,
  service: faCogs,
  repository: faDatabase,
  test: faFlask,
  model: faFileCode,
  function: faCode,
  code: faCode,
  blastTarget: faBurst,
  fire: faFire,
  danger: faTriangleExclamation,
  check: faCircleCheck,
  error: faCircleXmark,
  shield: faShieldHalved,
  pr: faCodePullRequest,
  copy: faCopy,
  copied: faCheck,
  terminal: faTerminal,
  tree: faFolderTree,
  search: faMagnifyingGlass,
  filter: faFilter,
  refresh: faRotate,
  simulate: faPlay,
  dot: faCircleDot,
  settings: faSliders,
  bug: faBug,
  arrowRight: faArrowRight
};

export function getSymbolIcon(type: SymbolType, isTarget: boolean = false) {
  if (isTarget) return ICONS.blastTarget;
  switch (type) {
    case "controller":
      return ICONS.controller;
    case "repository":
      return ICONS.repository;
    case "test":
      return ICONS.test;
    case "service":
      return ICONS.service;
    default:
      return ICONS.function;
  }
}

export function getSymbolColor(type: SymbolType, isTarget: boolean = false) {
  if (isTarget) return "text-rose-400 bg-rose-950/40 border-rose-500/50";
  switch (type) {
    case "controller":
      return "text-purple-400 bg-purple-950/40 border-purple-500/50";
    case "repository":
      return "text-amber-400 bg-amber-950/40 border-amber-500/50";
    case "test":
      return "text-emerald-400 bg-emerald-950/40 border-emerald-500/50";
    case "service":
      return "text-cyan-400 bg-cyan-950/40 border-cyan-500/50";
    default:
      return "text-slate-400 bg-slate-800/40 border-slate-700/50";
  }
}
