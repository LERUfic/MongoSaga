const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. We need to extract the "Main interface Shell" and make it the root return value.
// The current structure is:
// return (
//   <div className="flex h-screen w-screen overflow-hidden font-sans"...>
//     {!isConnected ? (
//       <div ...> ... connection modal ... </div>
//     ) : (
//       <div className="flex flex-col w-full h-full"> ... main shell ... </div>
//     )}
//   </div>
// );

const returnStartIndex = code.indexOf('return (\n    <div className="flex h-screen');
const modalStartIndex = code.indexOf('{/* 1. Connection screen if not connected */}');
const shellStartIndex = code.indexOf('{/* 2. Main interface Shell when connected */}');
// find the end of the shell div
const shellWrapperIndex = code.indexOf('<div className="flex flex-col w-full h-full">', shellStartIndex);

// We want to replace everything between `<div className="flex h-screen ...>` and `<header`
// with just the header directly, removing the `!isConnected ?` entirely.
const headerIndex = code.indexOf('{/* Main Top Header */}');

if (returnStartIndex > -1 && modalStartIndex > -1 && headerIndex > -1) {
  const prefix = code.slice(0, modalStartIndex);
  const suffix = code.slice(headerIndex);
  
  code = prefix + `
      <div className="flex flex-col w-full h-full">
        ` + suffix;
        
  // remove the closing `)}` right before `</div>\n  );\n}`
  code = code.replace(/\s*\)\}\n\s*<\/div>\n\s*\);\n\}\s*$/, '\n    </div>\n  );\n}\n');
}

// 2. Inject Connection Manager into the Sidebar
const sidebarStart = code.indexOf('{/* Left Sidebar */}');
const searchFilterStart = code.indexOf('{/* Search filter */}');

if (sidebarStart > -1 && searchFilterStart > -1) {
  const sidebarPrefix = code.slice(0, searchFilterStart);
  const sidebarSuffix = code.slice(searchFilterStart);
  
  const connectionManagerUI = `
              {/* Connection Manager */}
              <div className="p-4 border-b flex flex-col gap-3 shrink-0" style={{ borderBottomColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                {error && (
                  <div className="p-2 rounded border border-red-500/30 bg-red-950/20 text-red-400 text-xs flex items-start gap-2 mb-1">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span className="break-all">{error}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Connection URI</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="mongodb://..."
                      value={connectionUri}
                      onChange={(e) => setConnectionUri(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs rounded border transition-colors outline-none focus:border-emerald-500/50"
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
                      className="primary px-3 py-1.5 text-xs font-semibold rounded flex items-center justify-center"
                      style={{ minWidth: '70px' }}
                    >
                      {isLoading ? <RefreshCw size={12} className="animate-spin" /> : 'Connect'}
                    </button>
                  </div>
                </div>
                
                {/* Saved connections small list */}
                {savedConnections.length > 0 && !isConnected && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">History</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                      {savedConnections.map((uri, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 text-xs border rounded cursor-pointer transition-all hover:border-emerald-500/50 group" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <span className="truncate opacity-80 group-hover:opacity-100" onClick={() => { setConnectionUri(uri); handleConnect(uri); }}>
                            {uri.replace(/\\/\\/([^:]+):[^@]+@/, '//***:***@')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = savedConnections.filter(s => s !== uri);
                              setSavedConnections(updated);
                              localStorage.setItem('noble_mongo_saved_connections', JSON.stringify(updated));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isConnected && (
                <>
`;

  code = sidebarPrefix + connectionManagerUI + sidebarSuffix;
  
  // Close the `isConnected && (` fragment at the end of the sidebar
  const mainContentStart = code.indexOf('{/* Main Content Area */}');
  if (mainContentStart > -1) {
    // Find the `</aside>` right before `mainContentStart`
    const asideEnd = code.lastIndexOf('</aside>', mainContentStart);
    if (asideEnd > -1) {
      code = code.slice(0, asideEnd) + `                </>\n              )}\n            ` + code.slice(asideEnd);
    }
  }
}

// 3. Wrap Main Content Area in `{isConnected ? (...) : (<EmptyState/>)}`
const mainAreaStart = code.indexOf('{/* Main Content Area */}');
if (mainAreaStart > -1) {
  const mainElementStart = code.indexOf('<main ', mainAreaStart);
  
  // Inject Empty State
  const emptyState = `
            <main className="flex-1 flex flex-col overflow-hidden relative" style={{ backgroundColor: 'var(--bg-main)' }}>
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center h-full w-full opacity-60">
                  <div className="p-4 bg-emerald-500/5 rounded-full mb-4">
                    <Database size={48} className="text-emerald-500/50" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">No Active Connection</h2>
                  <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>
                    Enter your MongoDB connection URI in the left sidebar to connect and start browsing your data.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col h-full w-full">
`;
  
  // We need to replace `<main className="...">` with our wrapper.
  // Then we need to find the closing `</main>` and close our wrapper.
  const mainElementEnd = code.indexOf('>', mainElementStart) + 1;
  code = code.slice(0, mainElementStart) + emptyState + code.slice(mainElementEnd);
  
  // Close wrapper before `</main>`
  const mainClosing = code.lastIndexOf('</main>');
  if (mainClosing > -1) {
    code = code.slice(0, mainClosing) + `                </div>\n              )}\n            </main>` + code.slice(mainClosing + 7);
  }
}

// 4. Update Header Disconnect Button visibility
const disconnectBtnIndex = code.indexOf('onClick={handleDisconnect}');
if (disconnectBtnIndex > -1) {
  // Wrap the disconnect button in `{isConnected && ( ... )}`
  const btnStart = code.lastIndexOf('<button', disconnectBtnIndex);
  const dividerIndex = code.indexOf('<div className="w-px h-5 bg-border/50"', btnStart);
  
  if (btnStart > -1 && dividerIndex > -1) {
    code = code.slice(0, btnStart) + `{isConnected && (\n                ` + code.slice(btnStart, dividerIndex) + `              )}\n              ` + code.slice(dividerIndex);
  }
}


fs.writeFileSync('src/app/page.tsx', code);
console.log("Refactoring complete");
