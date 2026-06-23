"use client";

import React from 'react';
import { Compass, AlertTriangle, CheckCircle, Info, Clock, RefreshCw } from 'lucide-react';
import JsonTree from './JsonTree';

interface ExplainPlanProps {
  explainData: any;
}

export default function ExplainPlan({ explainData }: ExplainPlanProps) {
  if (!explainData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--text-muted)', minHeight: '200px' }}>
        <Compass size={36} className="mb-2" />
        <p>No query execution plan available.</p>
        <p style={{ fontSize: '0.8rem' }}>Run a query and check Explain Plan to view details.</p>
      </div>
    );
  }

  // Find execution details in the explain output
  const queryPlanner = explainData.queryPlanner || {};
  const executionStats = explainData.executionStats || {};
  const winningPlan = queryPlanner.winningPlan || {};
  
  // Recursively look for stages in winning plan
  const findStages = (plan: any, list: string[] = []): string[] => {
    if (!plan) return list;
    if (plan.stage) {
      list.push(plan.stage);
    }
    if (plan.inputStage) {
      findStages(plan.inputStage, list);
    }
    if (plan.inputStages && Array.isArray(plan.inputStages)) {
      plan.inputStages.forEach((subPlan: any) => findStages(subPlan, list));
    }
    return list;
  };

  const stages = findStages(winningPlan);
  const isTableScan = stages.includes('COLLSCAN');
  const isIndexScan = stages.includes('IXSCAN');

  const executionTime = executionStats.executionTimeMillis !== undefined
    ? `${executionStats.executionTimeMillis} ms`
    : 'Unknown';
  const docsReturned = executionStats.nReturned ?? 'N/A';
  const docsExamined = executionStats.totalDocsExamined ?? 'N/A';
  const keysExamined = executionStats.totalKeysExamined ?? 'N/A';

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3 mb-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Compass size={18} className="text-cyan-500" style={{ color: 'var(--accent-cyan)' }} />
            Query Explain Plan
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Insights into how MongoDB executed your query and which indexes were utilized.
          </p>
        </div>
      </div>

      {/* Security/Performance Assessment Banner */}
      {isTableScan && (
        <div className="p-4 rounded-lg border border-[#f59e0b30] bg-[#f59e0b08] flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-warning)' }} size={18} />
          <div>
            <h4 className="font-semibold text-amber-400" style={{ color: 'var(--accent-warning)', fontSize: '0.9rem' }}>
              Collection Scan (COLLSCAN) Detected
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              This query did a full database table scan because it couldn't use an index. For larger datasets, this will be slow and consume high CPU. Consider creating an index on the fields in your filter.
            </p>
          </div>
        </div>
      )}

      {isIndexScan && (
        <div className="p-4 rounded-lg border border-[#10b98130] bg-[#10b98108] flex items-start gap-3">
          <CheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-mongo)' }} size={18} />
          <div>
            <h4 className="font-semibold text-emerald-400" style={{ color: 'var(--accent-mongo)', fontSize: '0.9rem' }}>
              Index Scan (IXSCAN) Utilized
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Excellent! The query optimizer matched your search filter with an active index. This ensures high-performance retrieval and minimal CPU consumption.
            </p>
          </div>
        </div>
      )}

      {!isTableScan && !isIndexScan && (
        <div className="p-4 rounded-lg border flex items-start gap-3" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
          <Info className="text-cyan-500 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-cyan)' }} size={18} />
          <div>
            <h4 className="font-semibold text-cyan-400" style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
              Custom Execution Path
            </h4>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              The query was executed using stages: {stages.join(' → ') || 'None'}.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Clock size={12} /> Execution Time
          </span>
          <span className="text-md font-semibold font-mono text-cyan-400" style={{ color: 'var(--accent-cyan)' }}>
            {executionTime}
          </span>
        </div>

        <div className="p-3 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Docs Returned</span>
          <span className="text-md font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
            {docsReturned}
          </span>
        </div>

        <div className="p-3 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Docs Examined</span>
          <span className="text-md font-semibold font-mono" style={{ color: docsExamined > docsReturned ? 'var(--accent-warning)' : 'var(--text-primary)' }}>
            {docsExamined}
          </span>
        </div>

        <div className="p-3 rounded-lg border flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Keys Examined</span>
          <span className="text-md font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
            {keysExamined}
          </span>
        </div>
      </div>

      {/* Explain Raw Details */}
      <div className="flex flex-col gap-2 mt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Winning Execution Plan Steps
        </h4>
        <div className="p-3 rounded-lg border font-mono text-xs flex flex-col gap-1" style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border-color)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Namespace:</span> {queryPlanner.namespace || 'N/A'}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Query Stage Order:</span>{' '}
            <span className="font-semibold text-emerald-400" style={{ color: 'var(--accent-mongo)' }}>
              {stages.join(' → ') || 'No stages'}
            </span>
          </div>
          {winningPlan.indexName && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Index Name:</span> {winningPlan.indexName}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Raw Explain JSON Output
        </h4>
        <div className="p-4 rounded-lg border overflow-x-auto max-h-[300px]" style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border-color)' }}>
          <JsonTree data={explainData} initExpanded={false} />
        </div>
      </div>
    </div>
  );
}
