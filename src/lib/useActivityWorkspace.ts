import { useCallback, useEffect, useState } from 'react';
import { cancelCounselingQuestionReminders, emptyActivity, type ActivityWorkspace } from './activityWorkspace';
import { untilKoreaMidnight } from './koreaDate';

function loadActivity(key: string, initial: () => ActivityWorkspace): ActivityWorkspace {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<ActivityWorkspace> | null;
    if (!parsed) return initial();
    return {
      ...emptyActivity(), ...parsed,
      threadDetails: parsed?.threadDetails ?? {},
      reminders: Array.isArray(parsed?.reminders) ? cancelCounselingQuestionReminders(parsed.reminders) : [],
    };
  } catch {
    return initial();
  }
}

export function useActivityWorkspace(scope: string, initial = emptyActivity) {
  const key = `togro.activity.${scope}`;
  const [local, setLocal] = useState(() => ({ key, value: loadActivity(key, initial) }));
  const [storageError, setStorageError] = useState(false);
  const value = local.key === key ? local.value : loadActivity(key, initial);

  const update = useCallback((apply: (previous: ActivityWorkspace) => ActivityWorkspace) => {
    setLocal((previous) => {
      const base = previous.key === key ? previous.value : loadActivity(key, initial);
      const next = apply(base);
      return base === next && previous.key === key ? previous : { key, value: next };
    });
  }, [key, initial]);

  useEffect(() => {
    if (local.key !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(local.value));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, local]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return;
      const incoming = loadActivity(key, initial);
      setLocal((previous) => previous.key === key && JSON.stringify(previous.value) === JSON.stringify(incoming)
        ? previous : { key, value: incoming });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key, initial]);

  return { activity: value, updateActivity: update, storageError };
}

export function useKoreaClock(nextReminderAt?: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const current = Date.now();
    const reminderDelay = nextReminderAt && nextReminderAt > now ? Math.max(0, nextReminderAt - current) : Infinity;
    const timer = window.setTimeout(refresh, Math.min(reminderDelay, untilKoreaMidnight(current)) + 30);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [now, nextReminderAt]);
  return now;
}
