import { useCallback, useState } from 'react';
import type { ModelEntry } from '../types';

/** Selectable Claude models, cheapest/fastest last. */
export const CLAUDE_MODELS: ModelEntry[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const DEFAULT_MODEL = 'claude-sonnet-5';

export interface UseModelReturn {
  models: ModelEntry[];
  model: string;
  setModel: (m: string) => void;
  /** Applies a persisted last-used model from a settings message. */
  initFromLastChoice: (lastModel?: string) => void;
}

/**
 * Manages the currently selected Claude model.
 */
export function useModel(onChoiceChange?: (model: string) => void): UseModelReturn {
  const [model, setModelRaw] = useState(DEFAULT_MODEL);

  const initFromLastChoice = useCallback((lastModel?: string) => {
    const resolved =
      lastModel && CLAUDE_MODELS.some((entry) => entry.id === lastModel)
        ? lastModel
        : DEFAULT_MODEL;
    setModelRaw(resolved);
  }, []);

  const setModel = useCallback(
    (m: string) => {
      setModelRaw(m);
      onChoiceChange?.(m);
    },
    [onChoiceChange],
  );

  return { models: CLAUDE_MODELS, model, setModel, initFromLastChoice };
}
