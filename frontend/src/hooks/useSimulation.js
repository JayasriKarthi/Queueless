import { useEffect } from 'react';
import { simulateTick } from '../lib/fakeBackend';

const LEADER_KEY = 'ql-sim-leader';
const tabId = Math.random().toString(36).slice(2);

// Only one open tab drives the simulation, so customers are not added twice.
function isLeader() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEADER_KEY) || 'null');
    const now = Date.now();
    if (!raw || raw.id === tabId || now - raw.ts > 8000) {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, ts: now }));
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function useSimulation() {
  useEffect(() => {
    let timer;
    const heartbeat = setInterval(isLeader, 3000);
    const schedule = () => {
      timer = setTimeout(() => {
        if (isLeader()) simulateTick();
        schedule();
      }, 20000 + Math.random() * 20000);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
    };
  }, []);
}
