"use client";

import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import {
  Database,
  Table as TableIcon,
  Search,
  Play,
  Server,
  HardDrive,
  Layers,
  LogOut,
  Compass,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Code,
  List,
  Columns,
  Sparkles,
  BarChart3,
  BookOpen,
  ArrowRight,
  History,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Sun,
  Power,
  Moon,
  Trash2,
  X,
  Download,
  GripVertical
} from 'lucide-react';

import JsonTree from '@/components/JsonTree';
import SchemaAnalyzer from '@/components/SchemaAnalyzer';
import ExplainPlan from '@/components/ExplainPlan';

// Helper to flatten object keys for table headers
function flattenObject(obj: any, parentKey = '', res: any = {}): any {
  if (obj === null || obj === undefined) return res;

  // Handle special MongoDB EJSON types (ObjectId, Date, etc.) as values
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0].startsWith('$')) {
      res[parentKey] = obj;
      return res;
    }
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const propName = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], propName, res);
      } else {
        res[propName] = obj[key];
      }
    }
  }
  return res;
}

// Convert bytes to readable sizes
function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function MongoExplorer() {
  // Connection states
  const [connectionUri, setConnectionUri] = useState('');
  const [savedConnections, setSavedConnections] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [mongoVersion, setMongoVersion] = useState('Unknown');
  const [databases, setDatabases] = useState<any[]>([]);
  
  // Navigation states
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({});
  const [renderLimit, setRenderLimit] = useState(100);

  // Progressive rendering for massive collection lists
  useEffect(() => {
    if (collections.length > renderLimit) {
      const timer = setTimeout(() => {
        setRenderLimit(prev => prev + 250);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [collections.length, renderLimit]);
  const [sidebarFilter, setSidebarFilter] = useState('');

  const [activeTab, setActiveTab] = useState<'documents' | 'schema' | 'indexes' | 'explain' | 'aggregate'>('documents');
  const [docViewMode, setDocViewMode] = useState<'tree' | 'table' | 'json'>('tree');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document query states
  const [queryFilter, setQueryFilter] = useState('{}');
  const [querySort, setQuerySort] = useState('{}');
  const [queryProject, setQueryProject] = useState('{}');
  const [queryLimit, setQueryLimit] = useState(20);
  const [querySkip, setQuerySkip] = useState(0);
  const [showQueryOptions, setShowQueryOptions] = useState(false);

  // Results states
  const [documents, setDocuments] = useState<any[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [explainData, setExplainData] = useState<any>(null);
  const [collectionIndexes, setCollectionIndexes] = useState<any[]>([]);
  
  // Aggregation states
  const [aggPipeline, setAggPipeline] = useState('[\n  { "$match": {} }\n]');
  const [aggResults, setAggResults] = useState<any[]>([]);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState<string | null>(null);

  


  // Sidebar Resizing
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const sidebarWidthRef = useRef(288);
  const isResizingRef = useRef(false);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      // Subtract 56px to account for the far-left icon navigation bar
      const newWidth = Math.min(Math.max(e.clientX - 56, 200), 800);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = 'default';
        localStorage.setItem('noble_sidebar_width', sidebarWidthRef.current.toString());
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, []);

// UI States
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [connectionHost, setConnectionHost] = useState('');

  // Export States
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'query' | 'full'>('query');
  const [exportLoading, setExportLoading] = useState(false);

  // Load saved settings from local storage
  useEffect(() => {
    

      
      const savedWidth = localStorage.getItem('noble_sidebar_width');
      // eslint-disable-next-line
      if (savedWidth) setSidebarWidth(parseInt(savedWidth, 10));
const saved = localStorage.getItem('noble_mongo_saved_connections');
    if (saved) {
      try {
        setSavedConnections(JSON.parse(saved));
      } catch {
        // Ignore parsing errors
      }
    }
  }, []);

  // Connect to database
  const handleConnect = async (uriToConnect: string = connectionUri) => {
    if (!uriToConnect) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: uriToConnect }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');

      // Success
      setIsConnected(true);
      setMongoVersion(data.version);
      setDatabases(data.databases);
      
      // Parse host name for header display
      try {
        const urlMatch = uriToConnect.match(/@([^/]+)/);
        if (urlMatch) {
          setConnectionHost(urlMatch[1].split(',')[0]);
        } else {
          setConnectionHost(uriToConnect.replace('mongodb://', '').replace('mongodb+srv://', '').split('/')[0]);
        }
      } catch {
        setConnectionHost('Remote Server');
      }

      // Save connection string if new
      const updated = Array.from(new Set([uriToConnect, ...savedConnections])).slice(0, 10);
      setSavedConnections(updated);
      localStorage.setItem('noble_mongo_saved_connections', JSON.stringify(updated));

      // Reset workspace
      setSelectedDb(null);
      setSelectedCollection(null);
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = () => {
    setIsConnected(false);
    setSelectedDb(null);
    setSelectedCollection(null);
    setDatabases([]);
    setCollections([]);
    setDocuments([]);
  };

  // Select database & load collections
  const selectDatabase = async (dbName: string) => {
    // Expand ONLY the selected db so previous ones naturally collapse
    setExpandedDbs({ [dbName]: true });
    
    setSelectedDb(dbName);
    setSelectedCollection(null);
    setDocuments([]);
    setCollections([]);
    setRenderLimit(100);
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections?db=${encodeURIComponent(dbName)}`, {
        headers: { 'x-mongodb-uri': connectionUri }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch collections');
      setCollections(data.collections);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Select collection
  const selectCollection = (colName: string) => {
    setSelectedCollection(colName);
    setQueryFilter('{}');
    setQuerySort('{}');
    setQueryProject('{}');
    setQuerySkip(0);
    setQueryLimit(20);
    setDocuments([]);
    setTotalDocs(0);
    setActiveTab('documents');
    setExplainData(null);
    setAggResults([]);
    setAggError(null);
    setAggPipeline('[\n  { "$match": {} }\n]');

    // Execute first load
    setTimeout(() => {
      executeQuery(dbNameForCol, colName, '{}', '{}', '{}', 20, 0);
      fetchIndexes(dbNameForCol, colName);
    }, 50);
  };

  const dbNameForCol = selectedDb || '';

  // Execute find query
  const executeQuery = async (
    db: string = dbNameForCol,
    collection: string = selectedCollection || '',
    filterStr = queryFilter,
    sortStr = querySort,
    projectStr = queryProject,
    limit = queryLimit,
    skip = querySkip
  ) => {
    if (!db || !collection) return;
    setIsLoading(true);
    setError(null);
    try {
      // Validate JSON formats briefly client side
      const parseJSONInput = (str: string) => {
        const trimmed = str.trim();
        if (!trimmed || trimmed === '{}') return {};
        try {
          return JSON.parse(trimmed);
        } catch {
          try {
            const parsed = new Function(`return (${trimmed})`)();
            if (typeof parsed === 'object' && parsed !== null) {
              return parsed;
            }
            throw new Error();
          } catch {
            throw new SyntaxError('Invalid format. Input must be valid JSON or Javascript object, e.g. { status: "active" } or { status: \'active\' }');
          }
        }
      };

      const filter = parseJSONInput(filterStr);
      const sort = parseJSONInput(sortStr);
      const projection = parseJSONInput(projectStr);

      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mongodb-uri': connectionUri
        },
        body: JSON.stringify({
          db,
          collection,
          filter,
          sort,
          projection,
          limit,
          skip
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch query results');

      setDocuments(data.documents);
      setTotalDocs(data.totalCount);
    } catch (err: any) {
      setError(err.message || 'Error executing query');
    } finally {
      setIsLoading(false);
    }
  };

  // Run explain plan
  const executeExplain = async () => {
    if (!selectedDb || !selectedCollection) return;
    setIsLoading(true);
    setError(null);
    try {
      const trimmedFilter = queryFilter.trim();
      let filter = {};
      if (trimmedFilter && trimmedFilter !== '{}') {
        try {
          filter = JSON.parse(trimmedFilter);
        } catch {
          try {
            filter = new Function(`return (${trimmedFilter})`)();
            if (typeof filter !== 'object' || filter === null) throw new Error();
          } catch {
            throw new SyntaxError('Invalid format. Input must be valid JSON or Javascript object.');
          }
        }
      }

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mongodb-uri': connectionUri
        },
        body: JSON.stringify({
          db: selectedDb,
          collection: selectedCollection,
          filter
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate explain plan');
      setExplainData(data.explainPlan);
      setActiveTab('explain');
    } catch (err: any) {
      setError(err.message || 'Error generating explain');
    } finally {
      setIsLoading(false);
    }
  };

  // Run indexes fetch
  const fetchIndexes = async (db: string, collection: string) => {
    setIsLoadingIndexes(true);
    try {
      const res = await fetch(`/api/indexes?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}`, {
        headers: { 'x-mongodb-uri': connectionUri }
      });
      const data = await res.json();
      if (res.ok) {
        setCollectionIndexes(data.indexes || []);
      }
    } catch {
      // Catch silently
    } finally {
      setIsLoadingIndexes(false);
    }
  };

  // Run aggregation pipeline
  const runAggregation = async () => {
    if (!selectedDb || !selectedCollection) return;
    setAggLoading(true);
    setAggError(null);
    try {
      let pipeline;
      try {
        pipeline = JSON.parse(aggPipeline.trim());
      } catch {
        try {
          pipeline = new Function(`return (${aggPipeline.trim()})`)();
          if (!Array.isArray(pipeline)) throw new Error();
        } catch {
          throw new SyntaxError('Invalid aggregation pipeline. Must be a valid JSON array or Javascript array of stages.');
        }
      }
      const res = await fetch('/api/aggregate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mongodb-uri': connectionUri
        },
        body: JSON.stringify({
          db: selectedDb,
          collection: selectedCollection,
          pipeline
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aggregation failed');
      setAggResults(data.documents || []);
    } catch (err: any) {
      setAggError(err.message || 'Error running aggregation');
    } finally {
      setAggLoading(false);
    }
  };

  // Export Data
  const handleExportData = async () => {
    if (!selectedDb || !selectedCollection) return;
    setExportLoading(true);
    setError(null);
    try {
      const parseJSONInput = (str: string) => {
        const trimmed = str.trim();
        if (!trimmed || trimmed === '{}') return {};
        try { return JSON.parse(trimmed); } catch {
          try {
            const parsed = new Function(`return (${trimmed})`)();
            if (typeof parsed === 'object' && parsed !== null) return parsed;
            throw new Error();
          } catch {
            throw new SyntaxError('Invalid format.');
          }
        }
      };

      const payload: any = { db: selectedDb, collection: selectedCollection, scope: exportScope };

      if (exportScope === 'query') {
        payload.filter = parseJSONInput(queryFilter);
        payload.sort = parseJSONInput(querySort);
        payload.projection = parseJSONInput(queryProject);
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mongodb-uri': connectionUri },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to export data');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCollection}_export_${exportScope === 'query' ? 'filtered' : 'full'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (err: any) {
      setError(err.message || 'Error exporting data');
      setShowExportModal(false);
    } finally {
      setExportLoading(false);
    }
  };

  // Copy URI to clipboard helper
  const handleCopyUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopySuccess(uri);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // Flattened headers for Table view
  const tableHeaders = React.useMemo(() => {
    if (documents.length === 0) return [];
    const keys = new Set<string>();
    documents.slice(0, 10).forEach(doc => {
      const flat = flattenObject(doc);
      Object.keys(flat).forEach(k => keys.add(k));
    });
    // Ensure _id is first
    const list = Array.from(keys);
    const idIdx = list.indexOf('_id');
    if (idIdx > -1) {
      list.splice(idIdx, 1);
      list.unshift('_id');
    }
    return list;
  }, [documents]);

  // Filters databases/collections based on search input
  const filteredDatabases = databases.filter(db => {
    const dbMatch = db.name.toLowerCase().includes(sidebarFilter.toLowerCase());
    if (dbMatch) return true;
    
    // Check if any collection matches inside this database
    if (selectedDb === db.name) {
      return collections.some(col => col.name.toLowerCase().includes(sidebarFilter.toLowerCase()));
    }
    return false;
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans" style={{ fontFamily: 'var(--font-sans)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      
      
      <div className="flex flex-col w-full h-full">
        {/* Main Top Header */}
          <header className="flex items-center justify-between h-14 border-b px-4 shrink-0 glass-panel" style={{ backgroundColor: 'var(--bg-sidebar)', borderBottomColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Database size={16} className="text-emerald-500" style={{ color: 'var(--accent-mongo)' }} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">MongoSaga</span>
                  <span className="font-mono border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 rounded" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    READ-ONLY
                  </span>
                </div>
                <span className="font-mono truncate" style={{ fontSize: '10px', maxWidth: '280px', color: 'var(--text-muted)' }}>
                  Connected to: {connectionHost}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Server size={13} className="text-cyan-400" />
                MongoDB Version: <span className="font-mono text-cyan-400 font-semibold">{mongoVersion}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20 transition-all shadow-sm focus:outline-none active:scale-95"
                title="Sign Out of App"
              >
                <Power size={16} strokeWidth={2.5} />
                Sign Out
              </button>
            </div>
          </header>

          {/* Core Body: Sidebar + Viewport */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* Left Sidebar */}
            <aside className="border-r shrink-0 flex flex-col overflow-hidden relative group" style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px`, backgroundColor: 'var(--bg-sidebar)', borderRightColor: 'var(--border-color)' }}>
              
              
              
              
              {/* Connection Manager */}
              <div className="p-4 border-b flex flex-col gap-3 shrink-0" style={{ borderBottomColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                {error && (
                  <div className="p-2 rounded border border-red-500/30 bg-red-950/20 text-red-400 text-xs flex items-start gap-2 mb-1">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span className="break-all">{error}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>Connection URI</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="mongodb://..."
                      value={connectionUri}
                      onChange={(e) => setConnectionUri(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md border transition-all outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 shadow-sm"
                      disabled={isLoading}
                      style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && connectionUri && !isLoading) {
                          handleConnect();
                        }
                      }}
                    />
                    <button
                      onClick={() => handleConnect()}
                      disabled={isLoading || !connectionUri}
                      className="primary px-4 py-2 text-sm font-medium rounded-md flex items-center justify-center shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                      style={{ minWidth: '85px' }}
                    >
                      {isLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Connect'}
                    </button>
                  </div>
                </div>
                
                {/* Saved connections small list */}
                {savedConnections.length > 0 && !isConnected && (
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>Saved History</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1 custom-scrollbar">
                      {savedConnections.map((uri, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between px-3 py-2 text-sm border rounded-md cursor-pointer transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 group shadow-sm" 
                          style={{ cursor: 'pointer', borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}
                          onClick={() => { setConnectionUri(uri); handleConnect(uri); }}
                        >
                          <span className="truncate opacity-90 group-hover:opacity-100 group-hover:text-emerald-600 transition-colors">
                            {uri.replace(new RegExp('//([^:]+):[^@]+@'), '//***:***@')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = savedConnections.filter(s => s !== uri);
                              setSavedConnections(updated);
                              localStorage.setItem('noble_mongo_saved_connections', JSON.stringify(updated));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-white hover:bg-red-500 rounded transition-all"
                            title="Remove connection"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isConnected && (
                <>
{/* Search filter */}
              <div className="p-3 border-b shrink-0 flex items-center gap-2" style={{ borderBottomColor: 'var(--border-color)' }}>
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search databases..."
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-md"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                  />
                </div>
              </div>

              {/* Databases Tree */}
              <div className="flex-grow overflow-y-auto p-2 flex flex-col gap-1">
                {isLoading && databases.length === 0 ? (
                  <div className="p-4 text-center text-xs flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <RefreshCw size={14} className="animate-spin text-emerald-500" style={{ color: 'var(--accent-mongo)' }} />
                    <span>Loading databases...</span>
                  </div>
                ) : filteredDatabases.length === 0 ? (
                  <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    No databases found
                  </div>
                ) : (
                  filteredDatabases.map((db) => {
                    const isExpanded = expandedDbs[db.name];
                    const isSelected = selectedDb === db.name;
                    return (
                      <div key={db.name} className="flex flex-col gap-0.5">
                        
                        {/* Database line */}
                        <div
                          className={`db-item ${
                            isSelected ? 'bg-emerald-500/5 border border-emerald-500/10' : 'border border-transparent'
                          }`}
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedDbs(prev => ({ ...prev, [db.name]: false }));
                            } else {
                              selectDatabase(db.name);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-secondary" />
                            ) : (
                              <ChevronRight size={14} className="text-secondary" />
                            )}
                          {isLoading && isSelected ? (
                            <RefreshCw size={14} className="animate-spin text-emerald-400" style={{ color: 'var(--accent-mongo)' }} />
                          ) : (
                              <Database size={14} className={isSelected ? 'text-emerald-400' : 'text-secondary'} style={{ color: isSelected ? 'var(--accent-mongo)' : 'var(--text-secondary)' }} />
                            )}
                            <span className={`text-xs font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-primary'}`} style={{ color: isSelected ? 'var(--accent-mongo)' : 'var(--text-primary)' }}>
                              {db.name}
                            </span>
                          </div>
                          {db.sizeOnDisk !== undefined && (
                            <span className="shrink-0 font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {formatBytes(db.sizeOnDisk, 0)}
                            </span>
                          )}
                        </div>

                        {/* Collections under database */}
                        {isExpanded && isSelected && (
                          <div className="pl-4 pr-1 py-1 flex flex-col gap-1 border-l ml-3.5 animate-slide-in" style={{ borderColor: 'var(--border-color)' }}>
                            {collections.length === 0 ? (
                              isLoading ? (
                                <div className="flex flex-col gap-1.5 py-1.5 pr-2">
                                  <div className="shimmer-loading h-7 w-full rounded" />
                                  <div className="shimmer-loading h-7 w-5/6 rounded" />
                                  <div className="shimmer-loading h-7 w-full rounded" />
                                  <div className="shimmer-loading h-7 w-3/4 rounded" />
                                </div>
                              ) : (
                                <div className="p-2 italic" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  No collections
                                </div>
                              )
                            ) : (
                              <>
                                {collections
                                  .filter(col => col.name.toLowerCase().includes(sidebarFilter.toLowerCase()))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .slice(0, renderLimit)
                                  .map((col) => {
                                  const isColSelected = selectedCollection === col.name;
                                  return (
                                    <div
                                      key={col.name}
                                      className={`collection-item ${
                                        isColSelected ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-secondary border border-transparent'
                                      }`}
                                      onClick={() => selectCollection(col.name)}
                                    >
                                      <div className="flex items-center min-w-0" style={{ gap: '8px' }}>
                                        <TableIcon size={12} className={isColSelected ? 'text-cyan-400' : 'text-muted'} style={{ color: isColSelected ? 'var(--accent-cyan)' : 'var(--text-muted)', minWidth: '12px', flexShrink: 0 }} />
                                        <span className="text-xs truncate font-mono">
                                          {col.name}
                                        </span>
                                      </div>
                                      {col.docCount !== undefined && col.docCount >= 0 && (
                                        <span className="shrink-0 font-mono opacity-80" style={{ fontSize: '9px', color: isColSelected ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                                          {col.docCount}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                                {collections.filter(col => col.name.toLowerCase().includes(sidebarFilter.toLowerCase())).length > renderLimit && (
                                  <div className="p-3 text-center text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <RefreshCw size={12} className="animate-spin opacity-50" /> Rendering huge list...
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Close the isConnected fragment */}
              </>
              )}
            </aside>

            {/* Drag Handle (Sibling) */}
            <div 
              className="cursor-col-resize shrink-0 flex items-center justify-center bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors z-50 relative group"
              style={{ width: '24px', marginLeft: '-12px', marginRight: '-12px' }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizingRef.current = true;
                document.body.style.cursor = 'col-resize';
              }}
            >
              <div className="w-[2px] h-full bg-slate-200 dark:bg-slate-700 group-hover:bg-emerald-400 transition-colors relative flex items-center justify-center pointer-events-none">
                <div className="absolute flex items-center justify-center w-4 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm opacity-100 transition-colors group-hover:border-emerald-500/50">
                  <GripVertical size={12} className="text-slate-400 group-hover:text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Right Main Viewport */}
            <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
              
              {/* Workspace Error Banner */}
              {error && (
                <div className="mx-6 mt-4 p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 text-xs flex items-center justify-between gap-2.5 shrink-0 animate-shake">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-mono text-xs bg-transparent border-none p-0" style={{ cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              )}
              
              {/* Dashboard when nothing is selected */}
              {!selectedDb ? (
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-fade-in">
                  
                  {/* Database Hub Welcome Header */}
                  <div className="p-6 rounded-2xl glass-panel relative overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
                    <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--accent-mongo)' }}>
                      <Sparkles size={13} /> Active Cluster Dashboard
                    </span>
                    <h2 className="text-2xl font-bold mb-1">Welcome to MongoSaga Explorer</h2>
                    <p className="text-sm max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                      Browse collections, analyze document schema, run aggregations, and optimize indexes. Select a database on the left sidebar to explore its contents.
                    </p>
                  </div>

                  {/* Databases Stats Summary Cards */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Databases in this Cluster ({databases.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {databases.map((db) => (
                        <div
                          key={db.name}
                          onClick={() => selectDatabase(db.name)}
                          className="glass-card p-4 flex flex-col gap-3 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold font-mono text-emerald-400" style={{ color: 'var(--accent-mongo)' }}>
                              {db.name}
                            </span>
                            <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Database size={14} className="text-emerald-500" style={{ color: 'var(--accent-mongo)' }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex flex-col">
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Data Size</span>
                              <span className="text-xs font-semibold font-mono">{formatBytes(db.sizeOnDisk || 0)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Collections</span>
                              <span className="text-xs font-semibold font-mono">
                                {db.collectionCount ?? 'Click to open'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : selectedDb && !selectedCollection ? (
                
                // Dashboard for specific Database
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-muted" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Database Overview
                      </span>
                      <h2 className="text-2xl font-bold font-mono text-emerald-400" style={{ color: 'var(--accent-mongo)' }}>
                        {selectedDb}
                      </h2>
                    </div>
                    <button
                      onClick={() => selectDatabase(selectedDb)}
                      className="secondary px-3 py-1.5 text-xs flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Reload Collections
                    </button>
                  </div>

                  {/* Collections List Grid */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <TableIcon size={14} /> Collections ({collections.length})
                    </h3>
                    {isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="shimmer-loading h-28 rounded-xl" />
                        <div className="shimmer-loading h-28 rounded-xl" />
                        <div className="shimmer-loading h-28 rounded-xl" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.map((col) => (
                        <div
                          key={col.name}
                          onClick={() => selectCollection(col.name)}
                          className="glass-card p-4 flex flex-col gap-2.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold font-mono text-cyan-400" style={{ color: 'var(--accent-cyan)' }}>
                              {col.name}
                            </span>
                            <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TableIcon size={13} className="text-cyan-400" style={{ color: 'var(--accent-cyan)' }} />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t text-left" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex flex-col">
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Documents</span>
                              <span className="text-xs font-semibold font-mono">{col.docCount}</span>
                            </div>
                            <div className="flex flex-col">
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Storage</span>
                              <span className="text-xs font-semibold font-mono">{formatBytes(col.storageSize || 0)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Indexes</span>
                              <span className="text-xs font-semibold font-mono">{formatBytes(col.indexSize || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              ) : (
                
                // 3. Collection Workspace
                <div className="flex-grow flex flex-col overflow-hidden">
                  
                  {/* Collection Header Panel */}
                  <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 glass-panel" style={{ borderBottomColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-cyan-500/10 border border-cyan-500/20 rounded">
                        <TableIcon size={14} className="text-cyan-400" style={{ color: 'var(--accent-cyan)' }} />
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{selectedDb}.</span>
                        <h2 className="text-sm font-semibold font-mono text-cyan-400" style={{ color: 'var(--accent-cyan)' }}>
                          {selectedCollection}
                        </h2>
                      </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 border-b border-transparent">
                      {(['documents', 'schema', 'indexes', 'explain', 'aggregate'] as const).map((tab) => {
                        const isTabActive = activeTab === tab;
                        let tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
                        if (tab === 'explain') tabLabel = 'Explain Plan';
                        if (tab === 'aggregate') tabLabel = 'Aggregation';

                        return (
                          <button
                            key={tab}
                            onClick={() => {
                              setActiveTab(tab);
                              if (tab === 'explain' && !explainData) {
                                executeExplain();
                              }
                            }}
                            className={`px-3 py-1.5 text-xs transition-all ${
                              isTabActive
                                ? 'bg-cyan-500/10 text-cyan-400 font-semibold border-b-2 border-cyan-400'
                                : 'text-secondary hover:bg-[rgba(255,255,255,0.02)]'
                            }`}
                          >
                            {tabLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Work Area based on Tab */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    
                    {/* A. Documents Tab */}
                    {activeTab === 'documents' && (
                      <div className="flex-grow flex flex-col overflow-hidden">
                        
                        {/* Compass-style Query Bar */}
                        <div className="p-3 border-b shrink-0 flex flex-col gap-2.5" style={{ borderBottomColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
                          <div className="flex items-center gap-2">
                            {/* Filter Input Group */}
                            <div className="flex-grow flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-input" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}>
                              <span className="font-semibold text-xs select-none font-mono" style={{ color: 'var(--text-muted)' }}>Filter</span>
                              <input
                                type="text"
                                value={queryFilter}
                                onChange={(e) => setQueryFilter(e.target.value)}
                                className="flex-1 font-mono text-xs p-0 border-none bg-transparent outline-none"
                                placeholder="{}"
                                style={{ padding: 0, border: 'none', boxShadow: 'none' }}
                              />
                            </div>

                            {/* Options toggle */}
                            <button
                              onClick={() => setShowQueryOptions(!showQueryOptions)}
                              className={`secondary px-3 py-1.5 text-xs flex items-center gap-1`}
                              style={{ height: '34px' }}
                            >
                              <span>Options</span>
                              {showQueryOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            {/* Reset button */}
                            <button
                              onClick={() => {
                                setQueryFilter('{}');
                                setQueryProject('{}');
                                setQuerySort('{}');
                                setQueryLimit(20);
                                setQuerySkip(0);
                              }}
                              className="secondary px-3 py-1.5 text-xs flex items-center justify-center"
                              style={{ height: '34px' }}
                              title="Reset Query"
                            >
                              Reset
                            </button>

                            {/* Explain Plan button */}
                            <button
                              onClick={executeExplain}
                              className="secondary px-3 py-1.5 text-xs flex items-center gap-1"
                              disabled={isLoading}
                              style={{ height: '34px' }}
                              title="Explain Query Plan"
                            >
                              <Compass size={12} />
                              <span>Explain</span>
                            </button>

                            {/* Run Query / Find */}
                            <button
                              onClick={() => {
                                setQuerySkip(0);
                                executeQuery(dbNameForCol, selectedCollection || '', queryFilter, querySort, queryProject, queryLimit, 0);
                              }}
                              className="primary px-4 py-1.5 text-xs flex items-center gap-1.5"
                              disabled={isLoading}
                              style={{ height: '34px' }}
                            >
                              <Play size={12} fill="currentColor" />
                              {isLoading ? 'Finding...' : 'Find'}
                            </button>
                          </div>

                          {/* Collapsible Options Panel */}
                          {showQueryOptions && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-lg border animate-slide-in" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                              
                              {/* Project Field */}
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-xs font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Project</span>
                                <input
                                  type="text"
                                  value={queryProject}
                                  onChange={(e) => setQueryProject(e.target.value)}
                                  className="w-full font-mono text-xs py-1 px-2"
                                  placeholder="{}"
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                />
                              </div>

                              {/* Sort Field */}
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-xs font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Sort</span>
                                <input
                                  type="text"
                                  value={querySort}
                                  onChange={(e) => setQuerySort(e.target.value)}
                                  className="w-full font-mono text-xs py-1 px-2"
                                  placeholder="{}"
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                />
                              </div>

                              {/* Limit Field */}
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-xs font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Limit</span>
                                <input
                                  type="number"
                                  value={queryLimit}
                                  onChange={(e) => setQueryLimit(Number(e.target.value))}
                                  className="w-full font-mono text-xs py-1 px-2"
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                />
                              </div>

                              {/* Skip Field */}
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-xs font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Skip</span>
                                <input
                                  type="number"
                                  value={querySkip}
                                  onChange={(e) => setQuerySkip(Number(e.target.value))}
                                  className="w-full font-mono text-xs py-1 px-2"
                                  style={{ padding: '6px 10px', fontSize: '11px' }}
                                />
                              </div>

                            </div>
                          )}
                        </div>

                        {/* Documents View Control Pane */}
                        <div className="px-4 py-3 border-b shrink-0 flex items-center justify-between" style={{ borderBottomColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
                          <div className="flex items-center gap-4">
                            {(['tree', 'table', 'json'] as const).map((mode) => {
                              const isModeActive = docViewMode === mode;
                              let viewIcon = <List size={16} />;
                              if (mode === 'table') viewIcon = <Columns size={16} />;
                              if (mode === 'json') viewIcon = <Code size={16} />;

                              return (
                                <button
                                  key={mode}
                                  onClick={() => setDocViewMode(mode)}
                                  className={`px-4 py-2 text-sm flex items-center gap-2 rounded-lg transition-all border outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cyan-500/50 active:scale-[0.98] ${
                                    isModeActive
                                      ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-bold shadow-sm dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400'
                                      : 'bg-white border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 shadow-sm dark:bg-[#1e293b] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                  }`}
                                >
                                  {viewIcon}
                                  {mode.charAt(0).toUpperCase() + mode.slice(1)} View
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setShowExportModal(true)}
                              className="ml-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-lg transition-all border outline-none bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 shadow-sm focus:ring-2 focus:ring-offset-1 focus:ring-slate-400/50 active:scale-[0.98] dark:bg-[#1e293b] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            >
                              <Download size={16} />
                              Export
                            </button>
                          </div>

                          <div className="flex items-center" style={{ gap: '20px' }}>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {totalDocs >= 0 ? (
                                <span>
                                  Showing <span className="font-mono text-cyan-400 font-semibold">{documents.length}</span> documents{' '}
                                  {totalDocs > 0 && (
                                    <>
                                      of <span className="font-mono text-cyan-400 font-semibold">{totalDocs}</span> matching filter
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span>Showing query results</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'var(--border-color)' }}>
                              <button
                                disabled={querySkip === 0 || isLoading}
                                onClick={() => {
                                  const nextSkip = Math.max(0, querySkip - queryLimit);
                                  setQuerySkip(nextSkip);
                                  executeQuery(dbNameForCol, selectedCollection || '', queryFilter, querySort, queryProject, queryLimit, nextSkip);
                                }}
                                className="secondary text-xs disabled:opacity-50"
                                style={{ padding: '6px 12px', borderRadius: '6px', fontWeight: '500' }}
                              >
                                ← Prev
                              </button>
                              <span className="text-xs font-mono font-medium mx-1" style={{ color: 'var(--text-muted)' }}>
                                Page {Math.floor(querySkip / queryLimit) + 1}
                              </span>
                              <button
                                disabled={documents.length < queryLimit || isLoading}
                                onClick={() => {
                                  const nextSkip = querySkip + queryLimit;
                                  setQuerySkip(nextSkip);
                                  executeQuery(dbNameForCol, selectedCollection || '', queryFilter, querySort, queryProject, queryLimit, nextSkip);
                                }}
                                className="secondary text-xs disabled:opacity-50"
                                style={{ padding: '6px 12px', borderRadius: '6px', fontWeight: '500' }}
                              >
                                Next →
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Documents Display */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative">
                          {isLoading ? (
                            <div className="flex-grow flex flex-col gap-3 p-4">
                              <div className="shimmer-loading h-16 rounded-xl" />
                              <div className="shimmer-loading h-16 rounded-xl" />
                              <div className="shimmer-loading h-16 rounded-xl" />
                            </div>
                          ) : documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center" style={{ color: 'var(--text-muted)', minHeight: '300px' }}>
                              <HelpCircle size={40} className="mb-2 opacity-50" />
                              <p className="text-sm font-medium">No documents matching this query</p>
                              <p className="text-xs mt-1">Try relaxing your query filter or loading more fields.</p>
                            </div>
                          ) : (
                            <div className="h-full">
                              
                              {/* 1. Tree View */}
                              {docViewMode === 'tree' && (
                                <div className="flex flex-col gap-3">
                                  {documents.map((doc, idx) => (
                                    <div
                                      key={idx}
                                      className="p-4 rounded-xl border transition-all font-mono text-xs" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                    >
                                      <JsonTree data={doc} level={0} />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 2. JSON View */}
                              {docViewMode === 'json' && (
                                <div className="p-4 rounded-xl border font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed" style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border-color)' }}>
                                  {JSON.stringify(documents, null, 2)}
                                </div>
                              )}

                              {/* 3. Table View */}
                              {docViewMode === 'table' && (
                                <div className="data-table-container max-h-full">
                                  <table className="data-table">
                                    <thead>
                                      <tr style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                                        {tableHeaders.map((header) => (
                                          <th key={header} className="p-3 font-mono font-semibold truncate" style={{ color: 'var(--text-secondary)', maxWidth: '200px' }}>
                                            {header}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {documents.map((doc, docIdx) => {
                                        const flat = flattenObject(doc);
                                        return (
                                          <tr key={docIdx} className="font-mono">
                                            {tableHeaders.map((header) => {
                                              const val = flat[header];
                                              let displayVal = '';

                                              if (val === null || val === undefined) {
                                                displayVal = '-';
                                              } else if (typeof val === 'object') {
                                                // Handle EJSON special display
                                                if (val.$oid) displayVal = `ObjectId("${val.$oid}")`;
                                                else if (val.$date) displayVal = `ISODate("${typeof val.$date === 'object' ? val.$date.$numberLong : val.$date}")`;
                                                else displayVal = JSON.stringify(val);
                                              } else {
                                                displayVal = String(val);
                                              }

                                              return (
                                                <td key={header} className="p-3 truncate" style={{ maxWidth: '200px' }} title={displayVal}>
                                                  {displayVal}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* B. Schema Analysis Tab */}
                    {activeTab === 'schema' && (
                      <div className="flex-1 overflow-hidden">
                        <SchemaAnalyzer documents={documents} />
                      </div>
                    )}

                    {/* C. Indexes Tab */}
                    {activeTab === 'indexes' && (
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        <div>
                          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                            <Layers size={16} className="text-emerald-500" />
                            Collection Indexes
                          </h3>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Indexes improve query speeds but add storage and index maintenance overhead.
                          </p>
                        </div>

                        {isLoadingIndexes ? (
                          <div className="flex flex-col gap-3 p-4">
                            <div className="shimmer-loading h-12 rounded-xl" />
                            <div className="shimmer-loading h-12 rounded-xl" />
                          </div>
                        ) : collectionIndexes.length === 0 ? (
                          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                            No index details found or unauthorized to fetch index details.
                          </div>
                        ) : (
                          <div className="data-table-container">
                            <table className="data-table">
                              <thead>
                                <tr style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                                  <th className="p-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Index Name</th>
                                  <th className="p-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Fields</th>
                                  <th className="p-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Properties</th>
                                </tr>
                              </thead>
                              <tbody>
                                {collectionIndexes.map((idxInfo, i) => {
                                  const name = idxInfo.name;
                                  const key = idxInfo.key || {};
                                  const unique = idxInfo.unique ? 'Unique' : 'Standard';

                                  return (
                                    <tr key={i}>
                                      <td className="p-3 font-mono font-medium" style={{ color: 'var(--accent-mongo)' }}>{name}</td>
                                      <td className="p-3 font-mono">
                                        {Object.entries(key).map(([field, val]) => `${field}: ${val}`).join(', ')}
                                      </td>
                                      <td className="p-3 font-mono">
                                        <span className={`px-2 py-1 rounded ${idxInfo.unique ? 'badge-unique' : 'badge-standard'}`} style={{ fontSize: '10px' }}>
                                          {unique}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* D. Explain Plan Tab */}
                    {activeTab === 'explain' && (
                      <div className="flex-1 overflow-hidden">
                        <ExplainPlan explainData={explainData} />
                      </div>
                    )}

                    {/* E. Aggregation Tab */}
                    {activeTab === 'aggregate' && (
                      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-4">
                        
                        {/* Editor Block */}
                        <div className="flex-1 flex flex-col gap-3 min-w-0">
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                              <Sparkles size={16} className="text-emerald-500" />
                              Aggregation Pipeline Builder
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Build pipelines using arrays of stages. Writes ($out, $merge) are blocked.
                            </p>
                          </div>

                          <div className="flex-1 flex flex-col border rounded-xl overflow-hidden p-3 relative" style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border-color)' }}>
                            <textarea
                              value={aggPipeline}
                              onChange={(e) => setAggPipeline(e.target.value)}
                              className="flex-1 font-mono text-xs resize-none bg-transparent border-none outline-none leading-relaxed"
                              style={{ width: '100%' }}
                            />
                            
                            {/* Warn security */}
                            <div className="mt-2 p-2 border border-red-500/20 bg-red-950/10 rounded-lg text-red-400 flex items-center gap-1.5 shrink-0" style={{ fontSize: '10px' }}>
                              <AlertCircle size={12} />
                              Strict Security: Outward/Merge writes strictly rejected at API level.
                            </div>
                          </div>

                          <button
                            onClick={runAggregation}
                            disabled={aggLoading || !aggPipeline}
                            className="primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 font-semibold shrink-0"
                          >
                            <Play size={13} fill="currentColor" />
                            {aggLoading ? 'Aggregating...' : 'Run Aggregation'}
                          </button>
                        </div>

                        {/* Results Block */}
                        <div className="flex-1 flex flex-col gap-3 min-w-0 border-t md:border-t-0 md:border-l md:pl-4" style={{ borderColor: 'var(--border-color)' }}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted" style={{ color: 'var(--text-secondary)' }}>
                            Pipeline Output Results ({aggResults.length})
                          </span>

                          <div className="flex-grow border rounded-xl overflow-y-auto p-4 md:max-h-full" style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border-color)', maxHeight: '500px' }}>
                            {aggLoading ? (
                              <div className="flex flex-col gap-3">
                                <div className="shimmer-loading h-12 rounded-xl" />
                                <div className="shimmer-loading h-12 rounded-xl" />
                              </div>
                            ) : aggError ? (
                              <div className="p-3 border border-red-500/20 bg-red-950/10 text-red-400 text-xs rounded-lg flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>{aggError}</span>
                              </div>
                            ) : aggResults.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-center text-muted" style={{ color: 'var(--text-muted)' }}>
                                <Code size={30} className="mb-2 opacity-50" />
                                <p className="text-xs">No aggregation outputs to show.</p>
                                <p style={{ fontSize: '10px', marginTop: '2px' }}>Define your pipeline and run it to preview results.</p>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3 font-mono text-xs">
                                {aggResults.map((doc, idx) => (
                                  <div key={idx} className="p-3 border rounded-xl" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                                    <JsonTree data={doc} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                </div>
              )}

            </main>

          </div>

        </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => !exportLoading && setShowExportModal(false)}>
          <div className="modal-content shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', maxWidth: '560px', width: '95%', borderRadius: '16px' }}>
            <div className="border-b flex items-center justify-between" style={{ padding: '24px 32px', borderBottomColor: 'var(--border-color)' }}>
              <div className="flex items-center" style={{ gap: '16px' }}>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center" style={{ width: '40px', height: '40px' }}>
                  <Download size={20} className="text-emerald-500" style={{ color: 'var(--accent-mongo)' }} />
                </div>
                <h3 className="font-bold text-lg text-primary m-0 p-0">Export Collection</h3>
              </div>
              <button onClick={() => !exportLoading && setShowExportModal(false)} className="hover:text-red-400 text-muted transition-colors bg-transparent border-none rounded-md hover:bg-red-500/10 flex items-center justify-center" style={{ width: '36px', height: '36px', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col" style={{ padding: '36px 32px', gap: '28px' }}>
              <div className="flex flex-col" style={{ gap: '16px' }}>
                <label className="font-bold uppercase tracking-widest text-secondary m-0 p-0" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Export Scope</label>
                
                <div 
                  className={`border rounded-xl cursor-pointer flex items-start transition-colors ${exportScope === 'query' ? 'bg-emerald-500/5 shadow-sm' : 'bg-transparent hover:bg-[var(--bg-card-hover)]'}`}
                  style={{ padding: '20px', gap: '16px', borderColor: exportScope === 'query' ? 'var(--accent-mongo)' : 'var(--border-color)', borderWidth: exportScope === 'query' ? '2px' : '1px' }}
                  onClick={() => setExportScope('query')}
                >
                  <div className={`mt-0.5 rounded-full border flex items-center justify-center shrink-0 ${exportScope === 'query' ? 'bg-emerald-500' : ''}`} style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', borderColor: exportScope === 'query' ? 'var(--accent-mongo)' : 'var(--border-color)', backgroundColor: exportScope === 'query' ? 'var(--accent-mongo)' : 'transparent' }}>
                    {exportScope === 'query' && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-base font-bold text-primary leading-none">Query Filtered Export</span>
                    <span className="text-sm text-muted leading-relaxed" style={{ color: 'var(--text-muted)' }}>Export only documents matching your current filter, projection, and sort rules. (Max 50,000 documents)</span>
                  </div>
                </div>

                <div 
                  className={`border rounded-xl cursor-pointer flex items-start transition-colors ${exportScope === 'full' ? 'bg-emerald-500/5 shadow-sm' : 'bg-transparent hover:bg-[var(--bg-card-hover)]'}`}
                  style={{ padding: '20px', gap: '16px', borderColor: exportScope === 'full' ? 'var(--accent-mongo)' : 'var(--border-color)', borderWidth: exportScope === 'full' ? '2px' : '1px' }}
                  onClick={() => setExportScope('full')}
                >
                  <div className={`mt-0.5 rounded-full border flex items-center justify-center shrink-0 ${exportScope === 'full' ? 'bg-emerald-500' : ''}`} style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', borderColor: exportScope === 'full' ? 'var(--accent-mongo)' : 'var(--border-color)', backgroundColor: exportScope === 'full' ? 'var(--accent-mongo)' : 'transparent' }}>
                    {exportScope === 'full' && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-base font-bold text-primary leading-none">Full Collection Export</span>
                    <span className="text-sm text-muted leading-relaxed" style={{ color: 'var(--text-muted)' }}>Export all documents from this collection. (Max 50,000 documents)</span>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-500/10 border rounded-xl flex items-start" style={{ padding: '20px', gap: '16px', borderColor: 'var(--border-color)' }}>
                <Compass size={20} className="text-cyan-500 mt-0.5 shrink-0" style={{ color: 'var(--accent-cyan)', minWidth: '20px' }} />
                <p className="text-sm text-primary leading-relaxed m-0 p-0">
                  Exported JSON uses standard <strong>Extended JSON (EJSON)</strong>. You can safely import this file directly into MongoDB Compass without losing BSON types like ObjectId or ISODate.
                </p>
              </div>
            </div>

            <div className="border-t flex items-center justify-end" style={{ padding: '20px 32px', borderTopColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)', gap: '16px' }}>
              <button 
                className="secondary" 
                style={{ padding: '12px 24px', fontWeight: '600', fontSize: '14px', borderRadius: '8px' }}
                onClick={() => setShowExportModal(false)}
                disabled={exportLoading}
              >
                Cancel
              </button>
              <button 
                className="primary flex items-center"
                style={{ padding: '12px 28px', gap: '8px', whiteSpace: 'nowrap', fontWeight: '600', fontSize: '14px', borderRadius: '8px' }}
                onClick={handleExportData}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <><RefreshCw size={18} className="animate-spin" /> Exporting...</>
                ) : (
                  <><Download size={18} /> Download EJSON</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
