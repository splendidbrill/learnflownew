"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { 
  Loader2, 
  RefreshCw, 
  Download, 
  Maximize2, 
  X 
} from "lucide-react";

interface MermaidDiagramProps {
  code: string;
  title?: string;
  className?: string;
}

export default function MermaidDiagram({ 
  code, 
  title, 
  className = "" 
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code || !containerRef.current) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Dynamically import mermaid to avoid SSR issues
        const mermaid = (await import("mermaid")).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#7c3aed",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#a855f7",
            lineColor: "#a855f7",
            secondaryColor: "#1e1b4b",
            tertiaryColor: "#312e81",
            background: "#0f0f23",
            mainBkg: "#1e1b4b",
            nodeBorder: "#7c3aed",
            clusterBkg: "#1e1b4b",
            fontSize: "14px",
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
          },
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        
        const { svg } = await mermaid.render(id, code);
        setSvgContent(svg);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError("Failed to render diagram. The diagram syntax may be invalid.");
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [code]);

  const handleDownload = () => {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "diagram"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-xl p-4 ${className}`}>
        <p className="text-red-400 text-sm">{error}</p>
        <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-32">
          {code}
        </pre>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative bg-gradient-to-br from-slate-900/80 to-indigo-950/50 
                    border border-purple-500/20 rounded-xl overflow-hidden ${className}`}
      >
        {/* Header */}
        {title && (
          <div className="px-4 py-2 border-b border-purple-500/20 bg-purple-500/5">
            <h4 className="text-sm font-medium text-purple-300">{title}</h4>
          </div>
        )}

        {/* Diagram Container */}
        <div className="p-4 min-h-[200px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              <p className="text-xs text-slate-400">Rendering diagram...</p>
            </div>
          ) : (
            <div 
              ref={containerRef} 
              className="w-full overflow-auto [&>svg]:mx-auto [&>svg]:max-w-full"
            />
          )}
        </div>

        {/* Actions */}
        {!isLoading && svgContent && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 
                         text-slate-400 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 
                         text-slate-400 hover:text-white transition-colors"
              title="Download SVG"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 
                       hover:bg-slate-700 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="max-w-[90vw] max-h-[90vh] overflow-auto bg-slate-900 
                       rounded-2xl p-8 [&>svg]:max-w-full"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </motion.div>
      )}
    </>
  );
}
