"use client";

import React, { useMemo } from 'react';
import { ShieldAlert, BarChart3 } from 'lucide-react';

interface SchemaAnalyzerProps {
  documents: any[];
}

interface FieldTypeInfo {
  type: string;
  count: number;
}

interface FieldAnalysis {
  path: string;
  totalCount: number;
  types: { [type: string]: number };
}

export default function SchemaAnalyzer({ documents }: SchemaAnalyzerProps) {
  const analysis = useMemo(() => {
    if (!documents || documents.length === 0) return [];

    const fieldMap: { [path: string]: FieldAnalysis } = {};

    const getValType = (val: any): string => {
      if (val === null) return 'Null';
      if (Array.isArray(val)) return 'Array';
      if (typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 1) {
          if (keys[0] === '$oid') return 'ObjectId';
          if (keys[0] === '$date') return 'ISODate';
          if (keys[0] === '$numberLong') return 'Long';
          if (keys[0] === '$numberInt') return 'Int32';
          if (keys[0] === '$numberDouble') return 'Double';
          if (keys[0] === '$binary') return 'Binary';
          if (keys[0] === '$uuid') return 'UUID';
          if (keys[0] === '$regex') return 'Regex';
        }
        return 'Object';
      }
      return typeof val[0] === 'string'
        ? 'String'
        : typeof val === 'string'
        ? 'String'
        : typeof val === 'number'
        ? 'Number'
        : typeof val === 'boolean'
        ? 'Boolean'
        : 'Unknown';
    };

    const analyzeObj = (obj: any, currentPath = '') => {
      if (!obj || typeof obj !== 'object') return;

      // Check if this object is actually a special MongoDB type
      const keys = Object.keys(obj);
      if (keys.length === 1 && keys[0].startsWith('$')) {
        // It's a special type, count it as a value not a nested object
        const path = currentPath;
        const type = getValType(obj);
        if (!fieldMap[path]) {
          fieldMap[path] = { path, totalCount: 0, types: {} };
        }
        fieldMap[path].totalCount += 1;
        fieldMap[path].types[type] = (fieldMap[path].types[type] || 0) + 1;
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach((item) => {
          if (item && typeof item === 'object') {
            analyzeObj(item, currentPath);
          } else {
            const path = currentPath;
            const type = getValType(item);
            if (!fieldMap[path]) {
              fieldMap[path] = { path, totalCount: 0, types: {} };
            }
            fieldMap[path].totalCount += 1;
            fieldMap[path].types[type] = (fieldMap[path].types[type] || 0) + 1;
          }
        });
        return;
      }

      for (const key of Object.keys(obj)) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        const val = obj[key];
        const type = getValType(val);

        if (!fieldMap[path]) {
          fieldMap[path] = { path, totalCount: 0, types: {} };
        }
        fieldMap[path].totalCount += 1;
        fieldMap[path].types[type] = (fieldMap[path].types[type] || 0) + 1;

        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Verify if it's a mongo special type or a real nested object
          const subKeys = Object.keys(val);
          const isSpecial = subKeys.length === 1 && subKeys[0].startsWith('$');
          if (!isSpecial) {
            analyzeObj(val, path);
          }
        } else if (Array.isArray(val)) {
          analyzeObj(val, path);
        }
      }
    };

    documents.forEach((doc) => {
      analyzeObj(doc);
    });

    return Object.values(fieldMap).sort((a, b) => b.totalCount - a.totalCount);
  }, [documents]);

  if (!documents || documents.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center p-8 text-center"
        style={{ color: 'var(--text-muted)', minHeight: '200px' }}
      >
        <ShieldAlert size={36} className="mb-2" />
        <p>No documents found to analyze schema.</p>
        <p style={{ fontSize: '0.8rem' }}>Run a query to fetch documents first.</p>
      </div>
    );
  }

  const docCount = documents.length;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-3 mb-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BarChart3 size={18} className="text-emerald-500" style={{ color: 'var(--accent-mongo)' }} />
            Schema Analysis (Sample Size: {docCount} docs)
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            A map of field names, their types, and the percentage of documents that contain them.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {analysis.map((field) => {
          const frequencyPct = Math.round((field.totalCount / docCount) * 100);

          return (
            <div
              key={field.path}
              className="p-4 rounded-lg border"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <div
                className="flex items-center justify-between mb-2 flex-wrap gap-2"
                style={{ fontSize: '0.9rem' }}
              >
                <span className="font-mono text-emerald-400 font-medium" style={{ color: 'var(--accent-mongo)' }}>
                  {field.path}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Frequency:{' '}
                  <span className="text-primary font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {frequencyPct}%
                  </span>{' '}
                  ({field.totalCount}/{docCount} docs)
                </span>
              </div>

              {/* Progress Bar for Frequency */}
              <div
                className="w-full rounded-full h-2 mb-3 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-sidebar)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${frequencyPct}%`,
                    background: 'linear-gradient(90deg, var(--accent-mongo) 0%, var(--accent-cyan) 100%)',
                  }}
                />
              </div>

              {/* Type breakdown */}
              <div className="flex gap-4 flex-wrap items-center mt-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Types:
                </span>
                {Object.entries(field.types).map(([type, count]) => {
                  const typePct = Math.round((count / field.totalCount) * 100);
                  let badgeColor = '#60a5fa'; // String/default blue
                  if (type === 'ObjectId') badgeColor = '#a78bfa'; // Purple
                  if (type === 'ISODate') badgeColor = '#f472b6'; // Pink
                  if (type === 'Number' || type === 'Int32' || type === 'Long' || type === 'Double') badgeColor = '#fbbf24'; // Amber
                  if (type === 'Boolean') badgeColor = '#fb7185'; // Rose
                  if (type === 'Object' || type === 'Array') badgeColor = '#2dd4bf'; // Teal
                  if (type === 'Null') badgeColor = '#9ca3af'; // Gray

                  return (
                    <div key={type} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="px-2 py-0.5 rounded font-mono font-medium"
                        style={{
                          backgroundColor: `${badgeColor}15`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}30`,
                        }}
                      >
                        {type}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{typePct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
