import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Terminal, 
  Activity, 
  Shield, 
  Cpu, 
  Search, 
  Plus, 
  ChevronRight, 
  Clock, 
  Database,
  AlertCircle,
  CheckCircle2,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Types ---
interface Agent {
  id: string;
  namespace: string;
  slug: string;
  created_at: string;
}

interface LogEntry {
  id: string;
  namespace: string;
  event_type: string;
  payload: any;
  severity: string;
  timestamp: string;
}

// --- Gemini Config ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected">("disconnected");
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // --- WebSocket Setup ---
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "LOG") {
        setLogs((prev) => [message.data, ...prev].slice(0, 100));
      }
    };

    return () => ws.close();
  }, []);

  // --- Effects ---
  useEffect(() => {
    if (activeAgent) {
      fetchLogs(activeAgent.namespace);
    }
  }, [activeAgent]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- Actions ---
  const fetchLogs = async (namespace: string) => {
    try {
      const res = await fetch(`/api/logs/${namespace}`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    }
  };

  const registerAgent = async () => {
    if (!slugInput) return;
    setError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slugInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveAgent(data);
        setSlugInput("");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to register agent");
    }
  };

  const executePrompt = async () => {
    if (!activeAgent || !promptInput || isExecuting) return;
    setIsExecuting(true);
    setError(null);

    const executionId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // 1. Log Execution Start
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace: activeAgent.namespace,
          event_type: "execution.start",
          payload: { prompt: promptInput, execution_id: executionId },
          severity: "info"
        }),
      });

      // 2. Call Gemini
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptInput,
      });
      
      const resultText = response.text || "No response";
      const latency = Date.now() - startTime;

      // 3. Log Execution Success
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace: activeAgent.namespace,
          event_type: "execution.success",
          payload: { 
            output: resultText, 
            latency_ms: latency,
            execution_id: executionId 
          },
          severity: "info"
        }),
      });

      setPromptInput("");
    } catch (err: any) {
      setError(err.message);
      // Log Error
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namespace: activeAgent.namespace,
          event_type: "execution.error",
          payload: { error: err.message, execution_id: executionId },
          severity: "error"
        }),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-900/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-white tracking-tight text-lg">AgentDomain</span>
            <div className="h-4 w-[1px] bg-zinc-800 mx-2" />
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50">
              <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">{wsStatus}</span>
            </div>
          </div>
          
          {activeAgent && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Active Namespace</p>
                <p className="text-sm font-mono text-emerald-400">{activeAgent.namespace}</p>
              </div>
              <button 
                onClick={() => setActiveAgent(null)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          
          {!activeAgent ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <Plus className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-white">Register Namespace</h2>
              </div>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
                Create a deterministic identity for your AI agent. This namespace will serve as your logging partition and routing key.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors pr-20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-mono text-sm">.agent</span>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs px-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                )}
                <button 
                  onClick={registerAgent}
                  disabled={!slugInput}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                >
                  Provision Instance
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm space-y-6"
            >
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-white">Agent Execution</h2>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <textarea 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Enter prompt for agent..."
                    rows={4}
                    className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                  />
                </div>
                <button 
                  onClick={executePrompt}
                  disabled={!promptInput || isExecuting}
                  className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isExecuting ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 fill-current" />
                  )}
                  {isExecuting ? "Executing..." : "Run Command"}
                </button>
              </div>

              <div className="pt-6 border-t border-zinc-800/50">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-4">
                  <span>Agent Metadata</span>
                  <Database className="w-3 h-3" />
                </div>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">ID</span>
                    <span className="text-zinc-400 truncate ml-4">{activeAgent.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Created</span>
                    <span className="text-zinc-400">{new Date(activeAgent.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Region</span>
                    <span className="text-zinc-400">EU-WEST-2</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="bg-zinc-900/20 border border-zinc-800/30 rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-4">System Status</h3>
            <div className="space-y-4">
              <StatusItem label="Registry API" status="online" />
              <StatusItem label="Log Ingestion" status="online" />
              <StatusItem label="Execution Workers" status="online" />
              <StatusItem label="Blockchain Anchor" status="idle" />
            </div>
          </div>
        </div>

        {/* Right Column: Logs */}
        <div className="lg:col-span-8">
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl flex flex-col h-[calc(100vh-180px)] backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-white">Event Stream</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-black/40 border border-zinc-800 rounded text-[10px] font-mono text-zinc-500">
                  {logs.length} EVENTS
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs custom-scrollbar">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>Waiting for events...</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors ${
                        log.severity === 'error' 
                          ? 'bg-red-500/5 border-red-500/20' 
                          : 'bg-zinc-800/30 border-zinc-800/50 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            log.severity === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {log.event_type}
                          </span>
                          <span className="text-zinc-600 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <span className="text-zinc-700 text-[9px]">{log.id.split('-')[0]}</span>
                      </div>
                      
                      <div className="text-zinc-400 break-words leading-relaxed">
                        {log.event_type === 'execution.start' && (
                          <span>Input: <span className="text-zinc-300">"{log.payload.prompt}"</span></span>
                        )}
                        {log.event_type === 'execution.success' && (
                          <div className="space-y-1">
                            <p>Output: <span className="text-zinc-300">{log.payload.output}</span></p>
                            <p className="text-emerald-500/70 text-[10px]">Latency: {log.payload.latency_ms}ms</p>
                          </div>
                        )}
                        {log.event_type === 'execution.error' && (
                          <span className="text-red-400">Error: {log.payload.error}</span>
                        )}
                        {!['execution.start', 'execution.success', 'execution.error'].includes(log.event_type) && (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(log.payload, null, 2)}</pre>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}

function StatusItem({ label, status }: { label: string, status: 'online' | 'offline' | 'idle' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${
          status === 'online' ? 'text-emerald-500' : status === 'idle' ? 'text-zinc-600' : 'text-red-500'
        }`}>
          {status}
        </span>
        <div className={`w-1 h-1 rounded-full ${
          status === 'online' ? 'bg-emerald-500' : status === 'idle' ? 'bg-zinc-600' : 'bg-red-500'
        }`} />
      </div>
    </div>
  );
}
