"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface JsonTreeProps {
  data: any;
  label?: string;
  isLast?: boolean;
  level?: number;
  initExpanded?: boolean;
}

export default function JsonTree({
  data,
  label,
  isLast = true,
  level = 0,
  initExpanded = false,
}: JsonTreeProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(initExpanded || level < 1);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const getMongoSpecialType = (val: any): { type: string; value: string } | null => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const keys = Object.keys(val);
      if (keys.length === 1) {
        if (keys[0] === '$oid') {
          return { type: 'ObjectId', value: val['$oid'] };
        }
        if (keys[0] === '$date') {
          // If date is object (like {$date: {$numberLong: "..."}}) or string
          const dateVal = val['$date'];
          const dateStr = typeof dateVal === 'object' && dateVal?.['$numberLong']
            ? new Date(Number(dateVal['$numberLong'])).toISOString()
            : new Date(dateVal).toISOString();
          return { type: 'ISODate', value: dateStr };
        }
        if (keys[0] === '$numberLong') {
          return { type: 'Long', value: val['$numberLong'] };
        }
        if (keys[0] === '$numberInt') {
          return { type: 'Int32', value: val['$numberInt'] };
        }
        if (keys[0] === '$numberDouble') {
          return { type: 'Double', value: val['$numberDouble'] };
        }
        if (keys[0] === '$binary') {
          return { type: 'Binary', value: val['$binary']?.base64 || 'binary' };
        }
        if (keys[0] === '$uuid') {
          return { type: 'UUID', value: val['$uuid'] };
        }
        if (keys[0] === '$timestamp') {
          const t = val['$timestamp'];
          return { type: 'Timestamp', value: `t: ${t.t}, i: ${t.i}` };
        }
        if (keys[0] === '$regex') {
          return { type: 'Regex', value: `/${val['$regex']}/${val['$options'] || ''}` };
        }
      }
    }
    return null;
  };

  const specialType = getMongoSpecialType(data);

  // If it's a special MongoDB BSON type representation, render it inline
  if (specialType) {
    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        {label && <span className="json-tree-key">{label}: </span>}
        <span className="json-tree-value-type">
          {specialType.type}(
          <span className="json-tree-value-string">"{specialType.value}"</span>)
        </span>
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  // Handle primitive values
  if (data === null) {
    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        {label && <span className="json-tree-key">{label}: </span>}
        <span className="json-tree-value-null">null</span>
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        {label && <span className="json-tree-key">{label}: </span>}
        <span className="json-tree-value-boolean">{data ? 'true' : 'false'}</span>
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  if (typeof data === 'number') {
    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        {label && <span className="json-tree-key">{label}: </span>}
        <span className="json-tree-value-number">{data}</span>
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        {label && <span className="json-tree-key">{label}: </span>}
        <span className="json-tree-value-string">"{data}"</span>
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    const isEmpty = data.length === 0;

    if (isEmpty) {
      return (
        <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
          {label && <span className="json-tree-key">{label}: </span>}
          <span className="text-secondary">[]</span>
          {!isLast && <span className="text-secondary">,</span>}
        </div>
      );
    }

    return (
      <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        <div
          onClick={toggleExpand}
          className="flex items-center cursor-pointer py-0.5 rounded select-none hover-theme-highlight"
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-secondary mr-1" />
          ) : (
            <ChevronRight size={14} className="text-secondary mr-1" />
          )}
          {label && <span className="json-tree-key mr-1">{label}: </span>}
          <span className="text-secondary">
            {`Array [${data.length}]`}
            {!isExpanded && ' [...]'}
          </span>
        </div>

        {isExpanded && (
          <div className="border-l ml-2" style={{ borderColor: 'var(--border-color)' }}>
            {data.map((item, idx) => (
              <JsonTree
                key={idx}
                data={item}
                isLast={idx === data.length - 1}
                level={level + 1}
              />
            ))}
          </div>
        )}
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  // Handle standard objects
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    if (isEmpty) {
      return (
        <div className="json-tree-node" style={{ paddingLeft: `${level * 16}px` }}>
          {label && <span className="json-tree-key">{label}: </span>}
          <span className="text-secondary">{}</span>
          {!isLast && <span className="text-secondary">,</span>}
        </div>
      );
    }

    return (
      <div className="json-tree-node animate-fade-in" style={{ paddingLeft: `${level * 16}px` }}>
        <div
          onClick={toggleExpand}
          className="flex items-center cursor-pointer py-0.5 rounded select-none hover-theme-highlight"
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-secondary mr-1" />
          ) : (
            <ChevronRight size={14} className="text-secondary mr-1" />
          )}
          {label && <span className="json-tree-key mr-1">{label}: </span>}
          <span className="text-secondary">
            {`Object {${keys.length}}`}
            {!isExpanded && ' {...}'}
          </span>
        </div>

        {isExpanded && (
          <div className="border-l ml-2" style={{ borderColor: 'var(--border-color)' }}>
            {keys.map((key, idx) => (
              <JsonTree
                key={key}
                label={key}
                data={data[key]}
                isLast={idx === keys.length - 1}
                level={level + 1}
              />
            ))}
          </div>
        )}
        {!isLast && <span className="text-secondary">,</span>}
      </div>
    );
  }

  return null;
}
