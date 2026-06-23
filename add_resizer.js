const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Inject state
const uiStateIndex = code.indexOf('// UI States');
if (uiStateIndex > -1) {
  const insertState = `
  // Sidebar Resizing
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      setSidebarWidth(Math.min(Math.max(e.clientX, 220), 800));
    };
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = 'default';
        localStorage.setItem('noble_sidebar_width', sidebarWidth.toString());
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);

`;
  code = code.slice(0, uiStateIndex) + insertState + code.slice(uiStateIndex);
}

// 2. Inject Local Storage Load
const localStorageLoadIndex = code.indexOf("const saved = localStorage.getItem('noble_mongo_saved_connections');");
if (localStorageLoadIndex > -1) {
  const loadLogic = `
      const savedWidth = localStorage.getItem('noble_sidebar_width');
      if (savedWidth) setSidebarWidth(parseInt(savedWidth, 10));
      `;
  code = code.slice(0, localStorageLoadIndex) + loadLogic + code.slice(localStorageLoadIndex);
}

// 3. Update <aside> and inject handle
const asideIndex = code.indexOf('<aside className="w-72 border-r shrink-0 flex flex-col overflow-hidden"');
if (asideIndex > -1) {
  const replacement = `<aside className="border-r shrink-0 flex flex-col overflow-hidden relative group" style={{ width: \`\${sidebarWidth}px\`, backgroundColor: 'var(--bg-sidebar)', borderRightColor: 'var(--border-color)' }}>
              
              {/* Drag Handle */}
              <div 
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isResizingRef.current = true;
                  document.body.style.cursor = 'col-resize';
                }}
              />`;
              
  const asideEndIndex = code.indexOf('>', asideIndex) + 1;
  code = code.slice(0, asideIndex) + replacement + code.slice(asideEndIndex);
}

fs.writeFileSync('src/app/page.tsx', code);
console.log("Resizer injected.");
