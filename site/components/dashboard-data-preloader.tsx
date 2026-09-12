'use client';

import { useEffect } from 'react';

import { prefetchDashboard } from '@/lib/psip-api';

export function DashboardDataPreloader() {
  useEffect(() => {
    void prefetchDashboard();
  }, []);

  return null;
}
