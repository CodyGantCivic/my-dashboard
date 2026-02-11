import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  Calendar,
  ClipboardList,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
  X,
  Zap,
  Plug,
} from 'lucide-react';
import {
  SOURCE_URLS,
  SALESFORCE_SCRIPT,
  OUTLOOK_SCRIPT,
  CLOUDCOACH_SCRIPT,
} from '../../utils/extractionScripts';
import {
  parseSalesforceData,
  parseOutlookData,
  parseCloudCoachData,
  mergeImportedData,
} from '../../utils/importParser';
import type { TimeBlock } from '../../types/planner';

// ── Types ────────────────────────────────────────────────

type SourceStatus = 'idle' | 'opened' | 'extracting' | 'needs-login' | 'received' | 'error';

interface SourceState {
  status: SourceStatus;
  count: number;
  error?: string;
}

interface ImportWizardProps {
  onClose: () => void;
  onImport: (blocks: TimeBlock[]) => void;
}

const SOURCE_CONFIG = [
  {
    key: 'salesforce' as const,
    label: 'Salesforce Report',
    subtitle: 'Assignments & Launches',
    icon: Globe,
    color: '#5b8bd4',
    url: SOURCE_URLS.salesforce,
    script: SALESFORCE_SCRIPT,
    msgSource: 'wmp-salesforce',
  },
  {
    key: 'outlook' as const,
    label: 'Outlook Calendar',
    subtitle: 'Meetings & Launch Times',
    icon: Calendar,
    color: '#0078d4',
    url: SOURCE_URLS.outlook,
    script: OUTLOOK_SCRIPT,
    msgSource: 'wmp-outlook',
  },
  {
    key: 'cloudcoach' as const,
    label: 'Cloud Coach Tickets',
    subtitle: 'Revisions',
    icon: ClipboardList,
    color: '#6d5acd',
    url: SOURCE_URLS.cloudcoach,
    script: CLOUDCOACH_SCRIPT,
    msgSource: 'wmp-cloudcoach',
  },
];

// ── Extension communication helpers ─────────────────────

let requestCounter = 0;
const pendingRequests: Record<string, (response: any) => void> = {};

/** Send a message to the Chrome extension via the content bridge. */
function sendToExtension(action: string, payload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `req-${++requestCounter}`;
    const timeout = setTimeout(() => {
      delete pendingRequests[requestId];
      reject(new Error('Extension request timed out'));
    }, 300_000); // 5 min timeout (SF pages are slow + retry loops) for import

    pendingRequests[requestId] = (response: any) => {
      clearTimeout(timeout);
      delete pendingRequests[requestId];
      resolve(response);
    };

    window.postMessage(
      { type: 'WMP_REQUEST', action, requestId, payload },
      '*'
    );
  });
}

// ── Component ───────────────────────────────────────────

export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onImport }) => {
  const [extensionReady, setExtensionReady] = useState(false);
  const [autoImporting, setAutoImporting] = useState(false);
  const [sources, setSources] = useState<Record<string, SourceState>>({
    salesforce: { status: 'idle', count: 0 },
    outlook: { status: 'idle', count: 0 },
    cloudcoach: { status: 'idle', count: 0 },
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const rawData = useRef<{
    salesforce: any[] | null;
    outlook: string[] | null;
    cloudcoach: any[] | null;
  }>({ salesforce: null, outlook: null, cloudcoach: null });

  // ── Detect extension + listen for messages ─────────
  useEffect(() => {
    // 1. Synchronous check: the content bridge sets a DOM attribute
    if (document.documentElement.getAttribute('data-wmp-extension')) {
      setExtensionReady(true);
    }

    const handler = (event: MessageEvent) => {
      const { data } = event;
      if (!data || typeof data !== 'object') return;

      // Extension ready signal (sent by content bridge on load OR in response to ping)
      if (data.type === 'WMP_EXTENSION_READY') {
        setExtensionReady(true);
        return;
      }

      // Extension response
      if (data.type === 'WMP_RESPONSE' && data.requestId) {
        const cb = pendingRequests[data.requestId];
        if (cb) cb(data.response);
        return;
      }

      // Manual mode: postMessage from console scripts
      if (data.source === 'wmp-salesforce' && Array.isArray(data.data)) {
        rawData.current.salesforce = data.data;
        setSources((prev) => ({
          ...prev,
          salesforce: { status: 'received', count: data.data.length },
        }));
      }
      if (data.source === 'wmp-outlook' && Array.isArray(data.data)) {
        rawData.current.outlook = data.data;
        setSources((prev) => ({
          ...prev,
          outlook: { status: 'received', count: data.data.length },
        }));
      }
      if (data.source === 'wmp-cloudcoach' && Array.isArray(data.data)) {
        rawData.current.cloudcoach = data.data;
        setSources((prev) => ({
          ...prev,
          cloudcoach: { status: 'received', count: data.data.length },
        }));
      }
    };

    window.addEventListener('message', handler);

    // 2. Also ping via postMessage as a fallback
    window.postMessage({ type: 'WMP_PING' }, '*');

    // 3. Delayed retry — covers the case where extension background just injected the bridge
    const retryTimer = setTimeout(() => {
      if (document.documentElement.getAttribute('data-wmp-extension')) {
        setExtensionReady(true);
      } else {
        window.postMessage({ type: 'WMP_PING' }, '*');
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(retryTimer);
    };
  }, []);

  // ── Auto-import via extension ──────────────────────
  const handleAutoImport = useCallback(async () => {
    setAutoImporting(true);
    setStatusMessage('Opening source pages and extracting data...');

    // Mark all sources as extracting
    setSources({
      salesforce: { status: 'extracting', count: 0 },
      outlook: { status: 'extracting', count: 0 },
      cloudcoach: { status: 'extracting', count: 0 },
    });

    try {
      const response = await sendToExtension('wmp-import-all', {
        options: { sources: ['salesforce', 'outlook', 'cloudcoach'] },
      });

      if (!response.success) {
        setStatusMessage('Import failed: ' + (response.error || 'Unknown error'));
        setAutoImporting(false);
        return;
      }

      const { results } = response;

      // Process each source result
      for (const key of ['salesforce', 'outlook', 'cloudcoach'] as const) {
        const r = results[key];
        if (!r) {
          setSources((prev) => ({
            ...prev,
            [key]: { status: 'error', count: 0, error: 'No response' },
          }));
          continue;
        }

        if (r.status === 'needs-login') {
          setSources((prev) => ({
            ...prev,
            [key]: { status: 'needs-login', count: 0 },
          }));
          continue;
        }

        if (r.status === 'error') {
          const diagInfo = r.diag ? ' | Diag: ' + JSON.stringify(r.diag).slice(0, 200) : '';
          setSources((prev) => ({
            ...prev,
            [key]: { status: 'error', count: 0, error: (r.error || 'Unknown error') + diagInfo },
          }));
          continue;
        }

        // Success
        (rawData.current as any)[key] = r.data;
        setSources((prev) => ({
          ...prev,
          [key]: { status: 'received', count: r.data?.length || 0 },
        }));
      }

      const receivedSources = ['salesforce', 'outlook', 'cloudcoach'].filter(
        (k) => results[k]?.status === 'success'
      );
      setStatusMessage(`Imported data from ${receivedSources.length} of 3 sources`);
      setAutoImporting(false);

      // Auto-apply if we got data
      if (receivedSources.length > 0) {
        applyImportedData();
      }
    } catch (err: any) {
      setStatusMessage('Extension error: ' + err.message);
      setAutoImporting(false);
      // Fall back to showing manual mode
      setSources({
        salesforce: { status: 'idle', count: 0 },
        outlook: { status: 'idle', count: 0 },
        cloudcoach: { status: 'idle', count: 0 },
      });
    }
  }, []);

  // ── Manual mode: open pages ────────────────────────
  const handleOpen = useCallback((key: string, url: string) => {
    window.open(url, `wmp-${key}`);
    setSources((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: 'opened' },
    }));
  }, []);

  const handleCopyScript = useCallback(async (key: string, script: string) => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = script;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // ── Apply imported data ────────────────────────────
  const applyImportedData = useCallback(() => {
    setApplying(true);
    try {
      const sfBlocks = rawData.current.salesforce
        ? parseSalesforceData(rawData.current.salesforce)
        : [];
      const calBlocks = rawData.current.outlook
        ? parseOutlookData(rawData.current.outlook)
        : [];
      const ccBlocks = rawData.current.cloudcoach
        ? parseCloudCoachData(rawData.current.cloudcoach)
        : [];

      const merged = mergeImportedData(sfBlocks, calBlocks, ccBlocks);
      onImport(merged);
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      setApplying(false);
    }
  }, [onImport, onClose]);

  // ── Derived state ──────────────────────────────────
  const receivedCount = Object.values(sources).filter((s) => s.status === 'received').length;
  const canApply = receivedCount > 0 && !applying;

  // ── Status badge ───────────────────────────────────
  const statusBadge = (status: SourceStatus, count: number, error?: string) => {
    const styles: Record<SourceStatus, { bg: string; fg: string; label: string }> = {
      idle: { bg: '#f1f5f9', fg: '#64748b', label: 'Ready' },
      opened: { bg: '#fef3c7', fg: '#92400e', label: 'Waiting' },
      extracting: { bg: '#dbeafe', fg: '#1e40af', label: 'Extracting' },
      'needs-login': { bg: '#fef3c7', fg: '#92400e', label: 'Needs Login' },
      received: { bg: '#dcfce7', fg: '#166534', label: `${count} items` },
      error: { bg: '#fee2e2', fg: '#991b1b', label: 'Error' },
    };
    const s = styles[status];
    const spinning = status === 'extracting' || status === 'opened';
    return (
      <span
        style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: s.bg,
          color: s.fg,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title={error || ''}
      >
        {spinning && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
        {status === 'received' && <Check size={10} />}
        {status === 'error' && <AlertCircle size={10} />}
        {s.label}
      </span>
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>
            Import from Sources
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            {extensionReady
              ? 'Extension detected — click to auto-import from all sources'
              : 'Install the extension for one-click import, or use manual mode below'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Extension status badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '10px',
              backgroundColor: extensionReady ? '#dcfce7' : '#fef3c7',
              color: extensionReady ? '#166534' : '#92400e',
            }}
          >
            <Plug size={10} />
            {extensionReady ? 'Extension Active' : 'No Extension'}
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Auto-import button (when extension is active) */}
      {extensionReady && (
        <button
          onClick={handleAutoImport}
          disabled={autoImporting}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: autoImporting ? '#93c5fd' : '#3b82f6',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: autoImporting ? 'default' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: '16px',
          }}
        >
          {autoImporting ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Importing... (log in if prompted)
            </>
          ) : (
            <>
              <Zap size={16} />
              Auto-Import All Sources
            </>
          )}
        </button>
      )}

      {/* Source Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {SOURCE_CONFIG.map((src) => {
          const state = sources[src.key];
          const Icon = src.icon;
          const isCopied = copiedKey === src.key;

          return (
            <div
              key={src.key}
              style={{
                padding: '14px',
                borderRadius: '8px',
                border: `1px solid ${state.status === 'received' ? '#bbf7d0' : state.status === 'needs-login' ? '#fde68a' : '#e2e8f0'}`,
                backgroundColor:
                  state.status === 'received'
                    ? '#f0fdf4'
                    : state.status === 'needs-login'
                      ? '#fffbeb'
                      : '#fafafa',
                transition: 'all 0.2s',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: `${src.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={14} style={{ color: src.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                    {src.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{src.subtitle}</div>
                </div>
                {statusBadge(state.status, state.count, state.error)}
              </div>

              {/* Action buttons — always show for manual fallback */}
              {!extensionReady && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button
                    onClick={() => handleOpen(src.key, src.url)}
                    disabled={state.status === 'received'}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: '1px solid #d1d5db',
                      backgroundColor: state.status === 'received' ? '#f1f5f9' : '#ffffff',
                      color: state.status === 'received' ? '#94a3b8' : '#374151',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: state.status === 'received' ? 'default' : 'pointer',
                    }}
                  >
                    <ExternalLink size={11} />
                    Open
                  </button>
                  <button
                    onClick={() => handleCopyScript(src.key, src.script)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: '1px solid #d1d5db',
                      backgroundColor: isCopied ? '#dcfce7' : '#ffffff',
                      color: isCopied ? '#166534' : '#374151',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isCopied ? <Check size={11} /> : <Copy size={11} />}
                    {isCopied ? 'Copied!' : 'Copy Script'}
                  </button>
                </div>
              )}

              {/* Login prompt */}
              {state.status === 'needs-login' && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '10px',
                    color: '#92400e',
                    lineHeight: '1.4',
                  }}
                >
                  Log into this page in the opened tab, then try again
                </div>
              )}

              {/* Manual instructions */}
              {!extensionReady && state.status === 'opened' && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '10px',
                    color: '#92400e',
                    lineHeight: '1.4',
                  }}
                >
                  1. Log in if needed → 2. Press F12 → Console → 3. Paste script & Enter
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {statusMessage ||
              (receivedCount === 0
                ? extensionReady
                  ? 'Click "Auto-Import" to fetch data from all sources'
                  : 'Open pages and run extraction scripts to import data'
                : `${receivedCount} of 3 sources connected`)}
          </span>
          {!extensionReady && (
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              For auto-import, load the extension from /extension folder (chrome://extensions → Load unpacked)
            </span>
          )}
        </div>
        {/* Manual apply button — only when extension isn't auto-applying */}
        {(!extensionReady || receivedCount > 0) && !autoImporting && (
          <button
            onClick={applyImportedData}
            disabled={!canApply}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: canApply ? '#3b82f6' : '#e2e8f0',
              color: canApply ? '#ffffff' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              cursor: canApply ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            {applying ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Applying...
              </>
            ) : (
              <>
                <Check size={14} />
                Apply to Planner
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
