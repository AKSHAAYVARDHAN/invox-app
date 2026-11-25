import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type {
  TrendIngestionItem,
  TrendIngestionRun,
  TrendIngestionStage,
} from '../../types';
import {
  TRENDZ_DOMAINS,
  formatTrendzDomainName,
  type TrendzDomainSlug,
} from '../../utils/trendzDomains';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';
import {
  type EditorialApprovalEdits,
  type PipelineProvidersInfo,
  approveAndPublishTrendItem,
  fetchPipelineProvidersInfo,
  fetchTrendIngestionItems,
  fetchTrendIngestionRuns,
  rejectTrendIngestionItem,
  retryTrendIngestionItem,
  triggerManualIngestionRun,
  triggerSingleUrlIngestion,
} from '../../services/trendzPipelineService';

interface TrendzPipelinePanelProps {
  onStatusMessage?: (msg: string) => void;
}

type StageFilter = 'PENDING_REVIEW' | 'FAILED' | 'PUBLISHED' | 'REJECTED' | 'ALL';

const STAGE_BADGE_STYLES: Record<TrendIngestionStage, string> = {
  DISCOVERED: 'text-zinc-300 border-zinc-700 bg-zinc-900',
  VALIDATING: 'text-sky-300 border-sky-800 bg-sky-950/40',
  VALIDATED: 'text-sky-300 border-sky-700 bg-sky-950/50',
  PROCESSING: 'text-amber-300 border-amber-800 bg-amber-950/40',
  PENDING_REVIEW: 'text-amber-300 border-amber-700 bg-amber-950/60',
  APPROVED: 'text-emerald-300 border-emerald-700 bg-emerald-950/50',
  PUBLISHED: 'text-emerald-400 border-emerald-700 bg-emerald-950/60',
  REJECTED: 'text-zinc-500 border-zinc-800 bg-zinc-950',
  FAILED: 'text-rose-400 border-rose-800 bg-rose-950/50',
};

function formatIsoShort(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildInitialEdits(item: TrendIngestionItem): EditorialApprovalEdits {
  return {
    title: item.aiDraft?.title || item.source.rawTitle || '',
    summary: item.aiDraft?.summary || item.source.sanitizedExcerpt.slice(0, 360) || '',
    fullContent: item.aiDraft?.fullContent || item.source.sanitizedExcerpt || '',
    whyItMatters: item.aiDraft?.whyItMatters || '',
    keyTakeaways: item.aiDraft?.keyTakeaways || [],
    domainSlug: item.aiDraft?.domainSlug || item.domainSlug,
    category: item.aiDraft?.category || formatTrendzDomainName(item.domainSlug),
    tags: item.aiDraft?.tags || [item.domainSlug],
    mediaUrl: item.media?.url || '',
    mediaAttribution: item.media?.attribution || '',
  };
}

export const TrendzPipelinePanel: React.FC<TrendzPipelinePanelProps> = ({ onStatusMessage }) => {
  const { currentUser } = useAuth();

  const [providersInfo, setProvidersInfo] = useState<PipelineProvidersInfo | null>(null);
  const [runs, setRuns] = useState<TrendIngestionRun[]>([]);
  const [items, setItems] = useState<TrendIngestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ingestion runner controls
  const [selectedDomains, setSelectedDomains] = useState<TrendzDomainSlug[]>(['technology', 'science']);
  const [windowHours, setWindowHours] = useState<number>(48);
  const [maxItemsPerDomain, setMaxItemsPerDomain] = useState<number>(2);
  const [runningIngestion, setRunningIngestion] = useState(false);

  // Single-URL submission
  const [singleUrl, setSingleUrl] = useState('');
  const [singleUrlDomain, setSingleUrlDomain] = useState<TrendzDomainSlug>('technology');
  const [processingSingleUrl, setProcessingSingleUrl] = useState(false);

  // Queue filter & selected item editor
  const [stageFilter, setStageFilter] = useState<StageFilter>('PENDING_REVIEW');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditorialApprovalEdits | null>(null);
  const [takeawaysText, setTakeawaysText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, recentRuns, allItems] = await Promise.all([
        fetchPipelineProvidersInfo(),
        fetchTrendIngestionRuns(20),
        fetchTrendIngestionItems({ stage: 'ALL', maxResults: 80 }),
      ]);
      setProvidersInfo(info);
      setRuns(recentRuns);
      setItems(allItems);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Trendz intelligence pipeline state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredItems = useMemo(() => {
    if (stageFilter === 'ALL') return items;
    return items.filter((item) => item.stage === stageFilter);
  }, [items, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = {
      PENDING_REVIEW: 0,
      FAILED: 0,
      PUBLISHED: 0,
      REJECTED: 0,
      ALL: items.length,
    };
    for (const item of items) {
      if (item.stage === 'PENDING_REVIEW') counts.PENDING_REVIEW++;
      else if (item.stage === 'FAILED') counts.FAILED++;
      else if (item.stage === 'PUBLISHED') counts.PUBLISHED++;
      else if (item.stage === 'REJECTED') counts.REJECTED++;
    }
    return counts;
  }, [items]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  useEffect(() => {
    if (selectedItem) {
      const initial = buildInitialEdits(selectedItem);
      setEdits(initial);
      setTakeawaysText(initial.keyTakeaways.join('\n'));
      setTagsText(initial.tags.join(', '));
      setRejectionReason(selectedItem.rejectionReason || '');
    } else {
      setEdits(null);
      setTakeawaysText('');
      setTagsText('');
      setRejectionReason('');
    }
  }, [selectedItem]);

  const toggleDomain = (slug: TrendzDomainSlug) => {
    setSelectedDomains((prev) =>
      prev.includes(slug)
        ? prev.length > 1
          ? prev.filter((d) => d !== slug)
          : prev
        : [...prev, slug]
    );
  };

  const handleStartIngestion = async () => {
    if (runningIngestion || selectedDomains.length === 0) return;
    setRunningIngestion(true);
    setError(null);
    onStatusMessage?.(
      `Running Trendz source discovery & Gemini synthesis across ${selectedDomains.length} domain(s)...`
    );
    try {
      const result = await triggerManualIngestionRun({
        domains: selectedDomains,
        windowHours,
        maxItemsPerDomain,
      });
      await loadAll();
      setStageFilter(result.run.counts.pendingReview > 0 ? 'PENDING_REVIEW' : 'ALL');
      if (result.items.length > 0) {
        setSelectedItemId(result.items[0].id);
      }
      onStatusMessage?.(
        `Run ${result.run.id} finished (${result.run.status}): ${result.run.counts.discovered} discovered, ${result.run.counts.pendingReview} pending review, ${result.run.counts.duplicatesMerged} deduplicated, ${result.run.counts.failed} failed.`
      );
    } catch (err: any) {
      const msg = err?.message || 'Manual ingestion run failed.';
      setError(msg);
      onStatusMessage?.(`Pipeline error: ${msg}`);
    } finally {
      setRunningIngestion(false);
    }
  };

  const handleProcessSingleUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleUrl.trim() || processingSingleUrl) return;
    setProcessingSingleUrl(true);
    setError(null);
    onStatusMessage?.('Validating URL and running grounded Gemini synthesis...');
    try {
      const result = await triggerSingleUrlIngestion({
        url: singleUrl.trim(),
        domainSlug: singleUrlDomain,
      });
      setSingleUrl('');
      await loadAll();
      if (result.items.length > 0) {
        setStageFilter(result.items[0].stage === 'FAILED' ? 'FAILED' : 'PENDING_REVIEW');
        setSelectedItemId(result.items[0].id);
      }
      onStatusMessage?.(
        `Single-URL job finished: ${result.run.counts.pendingReview} pending review, ${result.run.counts.duplicatesMerged} duplicate, ${result.run.counts.failed} failed.`
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to process URL.';
      setError(msg);
      onStatusMessage?.(`URL ingestion error: ${msg}`);
    } finally {
      setProcessingSingleUrl(false);
    }
  };

  const handleApproveAndPublish = async () => {
    if (!selectedItem || !edits || !currentUser || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const cleanedEdits: EditorialApprovalEdits = {
        ...edits,
        keyTakeaways: takeawaysText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 10),
        tags: tagsText
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10),
      };

      const { trendId, alreadyPublished } = await approveAndPublishTrendItem({
        item: selectedItem,
        edits: cleanedEdits,
        reviewerUid: currentUser.uid,
        reviewerEmail: currentUser.email || undefined,
      });

      await loadAll();
      onStatusMessage?.(
        alreadyPublished
          ? `Trend ${trendId} was already published (idempotent link updated).`
          : `Approved & published Trend '${cleanedEdits.title}' to live /trendz/${trendId}.`
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to publish trend.';
      setError(msg);
      onStatusMessage?.(`Publish error: ${msg}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectItem = async () => {
    if (!selectedItem || !currentUser || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await rejectTrendIngestionItem({
        item: selectedItem,
        reason: rejectionReason || 'Rejected during editorial review.',
        reviewerUid: currentUser.uid,
        reviewerEmail: currentUser.email || undefined,
      });
      await loadAll();
      onStatusMessage?.(`Rejected item ${selectedItem.id}; excluded from live Trendz feed.`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to reject item.';
      setError(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRetryItem = async (item: TrendIngestionItem) => {
    if (actionBusy) return;
    setActionBusy(true);
    setError(null);
    onStatusMessage?.(`Retrying failed item ${item.id}...`);
    try {
      const updated = await retryTrendIngestionItem(item);
      await loadAll();
      setSelectedItemId(updated.id);
      onStatusMessage?.(`Retry finished for ${item.id}: stage is now ${updated.stage}.`);
    } catch (err: any) {
      const msg = err?.message || 'Retry failed.';
      setError(msg);
      onStatusMessage?.(`Retry error: ${msg}`);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Trendz Pipeline</h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300">
              SOURCE-GROUNDED AI
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Discover verified developments, inspect source evidence, edit AI briefings, and control live publishing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="px-4 py-2 text-xs font-mono uppercase rounded-none border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'REFRESHING...' : '// REFRESH_QUEUE'}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between gap-3">
          <span>// ERROR: {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-200 hover:text-white uppercase text-[10px] px-2 py-0.5 border border-rose-800"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Provider Status & Runtime Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(providersInfo?.providers || []).map((provider) => (
          <div
            key={provider.id}
            className="p-4 bg-[#0c0c0e] border border-zinc-800 rounded-none flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-white uppercase">
                {provider.name}
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${
                  provider.configured
                    ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40'
                    : 'text-amber-300 border-amber-800 bg-amber-950/30'
                }`}
              >
                {provider.configured ? 'READY' : 'NEEDS_ENV'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{provider.description}</p>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-900">
              <span>TYPE: {provider.type.toUpperCase()}</span>
              <span>
                {provider.requiredEnvVars.length > 0
                  ? `ENV: ${provider.requiredEnvVars.join(', ')}`
                  : 'ZERO_KEY_REQUIRED'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Controlled Ingestion Controls */}
      <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              // MANUAL_DISCOVERY_RUN
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Items enter PENDING_REVIEW after validation & Gemini synthesis. Nothing publishes without approval.
            </p>
          </div>
          {providersInfo && (
            <div className="text-[11px] font-mono text-zinc-500">
              MODELS: {providersInfo.models.join(' → ')}
            </div>
          )}
        </div>

        {/* Domain Multi-Select */}
        <div>
          <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
            Target Domains ({selectedDomains.length} selected)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TRENDZ_DOMAINS.map((domain) => {
              const active = selectedDomains.includes(domain.slug);
              return (
                <button
                  key={domain.slug}
                  type="button"
                  onClick={() => toggleDomain(domain.slug)}
                  className={`px-2.5 py-1.5 text-xs font-mono border rounded-none transition-colors ${
                    active
                      ? 'bg-white text-black border-white font-bold'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {domain.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Window & Max Items + Trigger Button */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
              Discovery Window
            </label>
            <select
              value={windowHours}
              onChange={(e) => setWindowHours(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-600"
            >
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={72}>Last 72 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
              Max Items / Domain
            </label>
            <select
              value={maxItemsPerDomain}
              onChange={(e) => setMaxItemsPerDomain(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 px-3 py-2 rounded-none focus:outline-none focus:border-zinc-600"
            >
              <option value={1}>1 item</option>
              <option value={2}>2 items</option>
              <option value={3}>3 items</option>
              <option value={5}>5 items</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleStartIngestion()}
            disabled={runningIngestion || Boolean(providersInfo?.lock)}
            className="px-5 py-2 text-xs font-mono font-bold uppercase rounded-none bg-white text-black hover:bg-zinc-200 border border-white transition-colors disabled:bg-zinc-800 disabled:border-zinc-700 disabled:text-zinc-500"
          >
            {runningIngestion
              ? 'RUNNING PIPELINE...'
              : providersInfo?.lock
                ? 'PIPELINE LOCKED'
                : 'START INGESTION RUN'}
          </button>
        </div>

        {/* Single-URL Curated Ingestion */}
        <form
          onSubmit={(e) => void handleProcessSingleUrl(e)}
          className="pt-4 border-t border-zinc-800 flex flex-col md:flex-row gap-2.5"
        >
          <input
            type="url"
            value={singleUrl}
            onChange={(e) => setSingleUrl(e.target.value)}
            placeholder="https://example.com/verified-article (Process single source URL into review queue)"
            className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <select
            value={singleUrlDomain}
            onChange={(e) => setSingleUrlDomain(e.target.value as TrendzDomainSlug)}
            className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            {TRENDZ_DOMAINS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={processingSingleUrl || !singleUrl.trim()}
            className="px-4 py-2 text-xs font-mono uppercase border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 disabled:opacity-40 transition-colors"
          >
            {processingSingleUrl ? 'VALIDATING...' : 'PROCESS URL'}
          </button>
        </form>
      </div>

      {/* Editorial Review Queue + Inspector Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Queue List */}
        <div className="xl:col-span-5 bg-[#0c0c0e] border border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                // EDITORIAL_QUEUE
              </h2>
              <span className="text-xs font-mono text-zinc-500">{filteredItems.length} items</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(['PENDING_REVIEW', 'FAILED', 'PUBLISHED', 'REJECTED', 'ALL'] as StageFilter[]).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStageFilter(tab)}
                    className={`px-2 py-1 text-[10px] font-mono uppercase border transition-colors ${
                      stageFilter === tab
                        ? 'bg-zinc-800 text-white border-zinc-600 font-bold'
                        : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    {tab.replace('_', ' ')} ({stageCounts[tab]})
                  </button>
                )
              )}
            </div>
          </div>

          <div className="divide-y divide-zinc-800/80 max-h-[680px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-xs font-mono text-zinc-500">LOADING QUEUE...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-6 text-xs font-mono text-zinc-500">
                No items in {stageFilter.replace('_', ' ')}. Trigger a discovery run or submit a verified article URL above.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const insufficient = item.aiDraft?.evidenceStatus === 'insufficient';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? 'bg-zinc-900/90 border-l-2 border-l-white' : 'hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${STAGE_BADGE_STYLES[item.stage]}`}
                      >
                        {item.stage}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        {formatTrendzDomainName(item.domainSlug)}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-zinc-100 line-clamp-2">
                      {item.aiDraft?.title || item.source.rawTitle}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-500">
                      <span>{item.source.name}</span>
                      <span>PUB: {formatIsoShort(item.source.publishedAtIso)}</span>
                      {item.corroboratingSources.length > 0 && (
                        <span className="text-sky-400">
                          +{item.corroboratingSources.length} CORROB
                        </span>
                      )}
                      {insufficient && (
                        <span className="text-amber-400 font-semibold">⚠ THIN EVIDENCE</span>
                      )}
                    </div>

                    {item.stage === 'FAILED' && item.failureReason && (
                      <div className="mt-1.5 text-[11px] font-mono text-rose-400 line-clamp-2">
                        {item.failureReason}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Source Provenance Inspector & Editorial Approval Editor */}
        <div className="xl:col-span-7 bg-[#0c0c0e] border border-zinc-800 p-5">
          {!selectedItem || !edits ? (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6">
              <span className="text-xs font-mono uppercase text-zinc-500 tracking-wider">
                // SELECT_ITEM_TO_INSPECT
              </span>
              <p className="text-xs text-zinc-500 mt-2 max-w-sm">
                Choose a discovered item from the editorial queue to verify original source evidence, edit AI-generated fields, and approve or reject publication.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Inspector Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                    ITEM_ID: {selectedItem.id} · RUN: {selectedItem.runId}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${STAGE_BADGE_STYLES[selectedItem.stage]}`}
                    >
                      {selectedItem.stage}
                    </span>
                    {selectedItem.aiDraft?.aiModel && (
                      <span className="text-[10px] font-mono text-zinc-400">
                        MODEL: {selectedItem.aiDraft.aiModel}
                      </span>
                    )}
                    {selectedItem.publishedTrendId && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        LIVE: /trendz/{selectedItem.publishedTrendId}
                      </span>
                    )}
                  </div>
                </div>

                {selectedItem.stage === 'FAILED' && (
                  <button
                    type="button"
                    onClick={() => void handleRetryItem(selectedItem)}
                    disabled={actionBusy}
                    className="px-3.5 py-1.5 text-xs font-mono uppercase bg-white text-black hover:bg-zinc-200 font-bold disabled:opacity-50"
                  >
                    {actionBusy ? 'RETRYING...' : `RETRY (${selectedItem.retryCount}/5)`}
                  </button>
                )}
              </div>

              {/* Grounding / Evidence Warnings */}
              {selectedItem.aiDraft &&
                (selectedItem.aiDraft.evidenceStatus === 'insufficient' ||
                  selectedItem.aiDraft.unsupportedClaimWarnings.length > 0) && (
                  <div className="p-3.5 bg-amber-950/30 border border-amber-800 text-xs font-mono text-amber-200 space-y-1.5">
                    <div className="font-bold uppercase">
                      ⚠ GROUNDING REVIEW NOTICE ({selectedItem.aiDraft.evidenceStatus.toUpperCase()})
                    </div>
                    {selectedItem.aiDraft.needsReviewReason && (
                      <p className="text-amber-300">{selectedItem.aiDraft.needsReviewReason}</p>
                    )}
                    {selectedItem.aiDraft.unsupportedClaimWarnings.map((warn, idx) => (
                      <div key={idx} className="text-amber-300/90">
                        • {warn}
                      </div>
                    ))}
                  </div>
                )}

              {/* Original Source Provenance (Immutable) */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 uppercase font-bold">// VERIFIED_SOURCE_PROVENANCE</span>
                  <span className="text-[10px] text-zinc-500 uppercase">
                    TIER: {selectedItem.source.credibilityTier} · HTTP {selectedItem.source.httpStatus || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-500">PUBLISHER: </span>
                    <span className="text-zinc-200">{selectedItem.source.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">PUBLISHED_AT: </span>
                    <span className="text-zinc-200">{formatIsoShort(selectedItem.source.publishedAtIso)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">RETRIEVED_AT: </span>
                    <span className="text-zinc-200">{formatIsoShort(selectedItem.source.retrievedAtIso)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">URL_HASH: </span>
                    <span className="text-zinc-400">{selectedItem.source.urlHash.slice(0, 16)}…</span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-zinc-500">ORIGINAL_URL: </span>
                  {(() => {
                    const safeUrl = sanitizeExternalUrl(selectedItem.source.canonicalUrl);
                    return safeUrl ? (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 underline hover:text-sky-300 break-all"
                      >
                        {safeUrl}
                      </a>
                    ) : (
                      <span className="text-rose-400">INVALID URL</span>
                    );
                  })()}
                </div>

                {selectedItem.corroboratingSources.length > 0 && (
                  <div className="pt-2 border-t border-zinc-900">
                    <span className="text-zinc-500 block mb-1">
                      CORROBORATING SOURCES ({selectedItem.corroboratingSources.length}):
                    </span>
                    <ul className="space-y-1">
                      {selectedItem.corroboratingSources.map((src) => {
                        const safe = sanitizeExternalUrl(src.url);
                        return (
                          <li key={src.urlHash} className="text-[11px] text-zinc-300">
                            • {src.name} —{' '}
                            {safe ? (
                              <a
                                href={safe}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 underline"
                              >
                                {src.title || safe}
                              </a>
                            ) : (
                              src.title || src.url
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-900">
                  <span className="text-zinc-500 block mb-1">EXTRACTED SOURCE EXCERPT:</span>
                  <p className="text-zinc-400 font-sans text-xs leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {selectedItem.source.sanitizedExcerpt || 'No excerpt captured.'}
                  </p>
                </div>
              </div>

              {/* Editable AI-Generated Briefing Fields */}
              <div className="space-y-3.5">
                <div className="text-xs font-mono font-bold text-zinc-300 uppercase">
                  // EDITORIAL_DRAFT_FIELDS
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                    Headline (Title)
                  </label>
                  <input
                    type="text"
                    value={edits.title}
                    onChange={(e) => setEdits({ ...edits, title: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                      Canonical Domain
                    </label>
                    <select
                      value={edits.domainSlug}
                      onChange={(e) =>
                        setEdits({ ...edits, domainSlug: e.target.value as TrendzDomainSlug })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
                    >
                      {TRENDZ_DOMAINS.map((d) => (
                        <option key={d.slug} value={d.slug}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                      Category Label
                    </label>
                    <input
                      type="text"
                      value={edits.category}
                      onChange={(e) => setEdits({ ...edits, category: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                    Executive Summary
                  </label>
                  <textarea
                    rows={3}
                    value={edits.summary}
                    onChange={(e) => setEdits({ ...edits, summary: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                    Full Briefing (Reported Facts + AI Analysis)
                  </label>
                  <textarea
                    rows={6}
                    value={edits.fullContent}
                    onChange={(e) => setEdits({ ...edits, fullContent: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                    Why It Matters
                  </label>
                  <textarea
                    rows={2}
                    value={edits.whyItMatters}
                    onChange={(e) => setEdits({ ...edits, whyItMatters: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                      Key Takeaways (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={takeawaysText}
                      onChange={(e) => setTakeawaysText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase text-zinc-500 block mb-1">
                        Media URL ({selectedItem.media.origin})
                      </label>
                      <input
                        type="url"
                        value={edits.mediaUrl}
                        onChange={(e) => setEdits({ ...edits, mediaUrl: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editorial Approval / Rejection Controls */}
              {selectedItem.stage === 'PENDING_REVIEW' && (
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleApproveAndPublish()}
                      disabled={actionBusy}
                      className="px-5 py-2.5 text-xs font-mono font-bold uppercase bg-white text-black hover:bg-zinc-200 border border-white transition-colors disabled:opacity-50"
                    >
                      {actionBusy ? 'PUBLISHING...' : 'APPROVE & PUBLISH TO TRENDZ'}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Optional rejection reason (e.g., thin source, off-topic, duplicate)..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRejectItem()}
                      disabled={actionBusy}
                      className="px-4 py-2 text-xs font-mono uppercase border border-rose-800 text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 transition-colors disabled:opacity-50"
                    >
                      REJECT ITEM
                    </button>
                  </div>
                </div>
              )}

              {/* Stage Audit History */}
              <div className="pt-3 border-t border-zinc-900">
                <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-2">
                  // STAGE_AUDIT_TRAIL
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(selectedItem.stageHistory || []).map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 text-[11px] font-mono text-zinc-400"
                    >
                      <span>
                        <strong className="text-zinc-200">{entry.stage}</strong>
                        {entry.note ? ` — ${entry.note}` : ''}
                      </span>
                      <span className="text-zinc-600 shrink-0">{formatIsoShort(entry.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Runs Log */}
      <div className="bg-[#0c0c0e] border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            // INGESTION_RUN_LOGS
          </h2>
          <span className="text-xs font-mono text-zinc-500">{runs.length} recent runs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] text-zinc-500 uppercase">
                <th className="py-2.5 px-4">Run ID</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Domains</th>
                <th className="py-2.5 px-4">Disc / Val / Review / Fail</th>
                <th className="py-2.5 px-4">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-5 px-4 text-zinc-500">
                    No ingestion runs recorded yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-4 text-zinc-200">{run.id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] uppercase px-1.5 py-0.5 border ${
                          run.status === 'completed'
                            ? 'text-emerald-400 border-emerald-800'
                            : run.status === 'partial_failure'
                              ? 'text-amber-300 border-amber-800'
                              : run.status === 'failed'
                                ? 'text-rose-400 border-rose-800'
                                : 'text-sky-300 border-sky-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{run.domains.join(', ')}</td>
                    <td className="py-3 px-4 text-zinc-300">
                      {run.counts.discovered} / {run.counts.validated} / {run.counts.pendingReview} /{' '}
                      <span className={run.counts.failed > 0 ? 'text-rose-400' : 'text-zinc-500'}>
                        {run.counts.failed}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500">{formatIsoShort(run.startedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrendzPipelinePanel;
