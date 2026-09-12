'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
export default function SchoolPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const router = useRouter();
  useEffect(() => {
    const query = new URLSearchParams({ search: schoolId, view: 'report' });
    const record = new URLSearchParams(window.location.search).get('record');
    if (record) query.set('record', record);
    router.replace(`/dashboard?${query}#school-details`);
  }, [schoolId, router]);
  return <p className="p-6">Opening school report…</p>;
}
