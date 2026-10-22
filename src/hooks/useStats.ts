import { useMemo } from 'react';
import { useCertificationStore, useComplaintStore, useMerchantStore, useOperatorStore, useTrainingStore, useVerificationStore, useWarningStore } from '@/stores';
import { computeStats, type StatsFilter } from '@/utils/stats';

export function useStats(filter: StatsFilter) {
  const operators = useOperatorStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const apps = useVerificationStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const enrollments = useTrainingStore((s) => s.items);
  return useMemo(
    () => computeStats({ operators, merchants, apps, certs, complaints, warnings, enrollments }, filter),
    [operators, merchants, apps, certs, complaints, warnings, enrollments, filter],
  );
}
