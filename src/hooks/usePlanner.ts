import { useMemo, useCallback } from 'react';
import type { TimeBlock, WeeklyPlan, CapacitySummary, Weekday } from '../types/planner';
import { useLocalStorage } from './useLocalStorage';
import { calculateCapacity, generateId, snapToHalfHour } from '../utils/plannerLogic';
import { startOfWeek, format } from 'date-fns';

const STORAGE_KEY = 'wmp-planner';

/** Build a fresh empty plan for the current week. */
function emptyPlan(): WeeklyPlan {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return {
    id: `plan-${format(monday, 'yyyy')}-w${format(monday, 'II')}`,
    weekStart: format(monday, 'yyyy-MM-dd'),
    blocks: [],
  };
}

export function usePlanner() {
  const [plan, setPlan] = useLocalStorage<WeeklyPlan>(STORAGE_KEY, emptyPlan());

  const capacity: CapacitySummary = useMemo(
    () => calculateCapacity(plan.blocks),
    [plan.blocks]
  );

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<TimeBlock>) => {
      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
      }));
    },
    [setPlan]
  );

  const moveBlock = useCallback(
    (blockId: string, day: Weekday, startHour: number) => {
      const snapped = snapToHalfHour(startHour);
      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === blockId ? { ...b, day, startHour: snapped } : b
        ),
      }));
    },
    [setPlan]
  );

  const addBlock = useCallback(
    (block: Omit<TimeBlock, 'id'>) => {
      const newBlock: TimeBlock = { ...block, id: generateId() };
      setPlan((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
    },
    [setPlan]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      setPlan((prev) => ({
        ...prev,
        blocks: prev.blocks.filter((b) => b.id !== blockId),
      }));
    },
    [setPlan]
  );

  const resetPlan = useCallback(() => {
    setPlan(emptyPlan());
  }, [setPlan]);

  const importBlocks = useCallback(
    (blocks: TimeBlock[]) => {
      setPlan((prev) => ({
        ...prev,
        blocks,
      }));
    },
    [setPlan]
  );

  return {
    plan,
    capacity,
    updateBlock,
    moveBlock,
    addBlock,
    removeBlock,
    resetPlan,
    importBlocks,
  };
}
