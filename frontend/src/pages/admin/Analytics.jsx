import { useMemo, useState } from 'react';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { useBusinessStore } from '../../store/businessStore';
import { useFakeLoading } from '../../hooks/useFakeLoading';
import { dailySeries, hourlySeries, serviceSplit, resourcePerformance, todayMetrics } from '../../lib/analytics';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Table from '../../components/ui/Table';
import LockedFeature from '../../components/ui/LockedFeature';
import EmptyState from '../../components/ui/EmptyState';
import MetricTile from '../../components/admin/MetricTile';
import { BarChartBox, LineChartBox, DonutChart } from '../../components/admin/Charts';
import { SkeletonCard } from '../../components/ui/Skeleton';

const LOCK = { feature: 'advancedAnalytics', title: 'Advanced analytics', description: 'Waits by hour, no-show trends, and performance per counter are on the Business plan.' };

export default function Analytics() {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const history = useBusinessStore((s) => s.analytics[business.id]);
  const loading = useFakeLoading(450);
  const [range, setRange] = useState('14');
  const days = Number(range);
  const daily = useMemo(() => dailySeries(tokens, history, days), [tokens, history, days]);
  const hourly = useMemo(() => hourlySeries(history), [history]);
  const split = useMemo(() => serviceSplit(business, tokens, days), [business, tokens, days]);
  const perf = useMemo(() => resourcePerformance(business, tokens, days), [business, tokens, days]);
  const m = todayMetrics(tokens, history);
  const total = daily.reduce((s, d) => s + d.volume, 0);

  if (loading) return <div className="space-y-4"><SkeletonCard lines={2} /><SkeletonCard lines={6} /></div>;
  if (!total && !tokens.length) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <EmptyState title="No data yet" description="Charts fill in once customers start joining your queue." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle="Sample history plus today's live tokens" secondary={<Select aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)} options={[{ value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }]} />} />
      <div className="ql-card flex flex-wrap gap-1 p-1">
        <MetricTile label="Customers in range" value={total.toLocaleString('en-IN')} />
        <MetricTile label="Waiting now" value={m.waiting} />
        <MetricTile label="Average wait today" value={`${m.wait.value} min`} change={m.wait.change} goodWhenDown />
        <MetricTile label="No-shows today" value={m.noShows.value} change={m.noShows.change} goodWhenDown />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Customers per hour"><BarChartBox data={hourly} dataKey="customers" name="Customers" /></Card>
        <Card title="Daily volume"><LineChartBox data={daily} lines={[{ key: 'volume', name: 'Tokens' }]} /></Card>
        <Card title="Service split">{split.length ? <DonutChart data={split} /> : <EmptyState compact title="No tokens in this range" />}</Card>
        <Card title="Average wait by hour">
          <LockedFeature {...LOCK} preview={<div className="h-40 rounded-lg bg-gradient-to-r from-teal/20 to-teal/5" />}>
            <LineChartBox data={hourly} lines={[{ key: 'wait', name: 'Wait (min)', color: '#2563EB' }]} unit="m" />
          </LockedFeature>
        </Card>
        <Card title="No-show trend" className="lg:col-span-2">
          <LockedFeature {...LOCK} compact>
            <LineChartBox data={daily} lines={[{ key: 'noShows', name: 'No-shows', color: '#E51C00' }]} height={200} />
          </LockedFeature>
        </Card>
      </div>
      <Card title={`${business.labels.resource} performance`} padded={false}>
        <LockedFeature {...LOCK} className="m-4">
          <Table
            caption={`${business.labels.resource} performance`}
            rows={perf}
            columns={[
              { key: 'name', header: business.labels.resource, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'served', header: 'Served' },
              { key: 'avgWait', header: 'Average wait', render: (r) => `${r.avgWait} min` },
              { key: 'avgServe', header: 'Average service', render: (r) => `${r.avgServe} min` },
              { key: 'noShows', header: 'No-shows' },
              { key: 'rating', header: 'Rating' },
            ]}
            empty={<EmptyState compact title="No data" />}
          />
        </LockedFeature>
      </Card>
    </div>
  );
}
