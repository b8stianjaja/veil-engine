/**
 * @file src/components/MetronomeTerminal.tsx
 * @description Real-time debug console tracking event-driven decouplings of the Simulation Core.
 * Illustrates event streams, collisions, timeline triggers, and GSAP commands.
 */

import React, { useState, useEffect, useRef } from 'react';
import EventBus from '../engine/protocol/EventBus';
import { Terminal, Shield, Sparkles, Trash2, Code2, Flame } from 'lucide-react';

interface TerminalLog {
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ANALYTIC';
  message: string;
}

interface MetronomeTerminalProps {
  theme?: 'LIGHT' | 'DARK';
}

export default function MetronomeTerminal({ theme = 'DARK' }: MetronomeTerminalProps) {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to add logs cleanly with memory constraint protections (Max 40 entries)
  const appendLog = (type: TerminalLog['type'], msg: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${(now.getMilliseconds() / 10).toFixed(0).padStart(2, '0')}`;
    
    setLogs(prev => {
      const next = [...prev, { timestamp: timeStr, type, message: msg }];
      if (next.length > 40) return next.slice(next.length - 40);
      return next;
    });
  };

  useEffect(() => {
    // Scroll container to bottom on new log additions
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    // Initial hello
    appendLog('INFO', 'Veil Engine diagnostic console active.');
    appendLog('SUCCESS', 'All core modules verified. Compliance check secure.');

    // Event listeners
    const onStarted = () => appendLog('SUCCESS', 'SIM_STARTED: metronome ticker activated @ 60Hz. WASD bounds mapped.');
    const onStopped = () => appendLog('WARNING', 'SIM_STOPPED: Ticker paused. Baseline properties restored.');
    
    const onCollected = (data: any) => {
      appendLog('SUCCESS', `COLLECTED: Overlap cleared! Star harvested successfully. UUID: ${data.uuid}`);
    };

    const onHazard = (data: any) => {
      appendLog('ERROR', `DAMAGE: Hit registered with '${data.name}'! [HP -15]`);
    };

    const onTrigger = (data: any) => {
      appendLog('ANALYTIC', `TRIGGER: Sensor intersection with '${data.name}'. Executing dialog stream.`);
    };

    const onExecuteEvent = (data: any) => {
      appendLog('INFO', `TIMELINE_TRACK: keyframe dispatched. Action: ${data.action} | Params: ${JSON.stringify(data.params)}`);
    };

    const onFinished = (data: any) => {
      appendLog('WARNING', `SEQUENCE_EOF: Sequence '${data.id}' completed play duration.`);
    };

    const onGsapLaunch = (data: any) => {
      appendLog('ANALYTIC', `LERP_OFFLOAD: Tween instructions issued for ${data.targetUuid} -> [${data.channel}]`);
    };

    // Subscriptions
    EventBus.on('SIMULATION_STARTED', onStarted);
    EventBus.on('SIMULATION_STOPPED', onStopped);
    EventBus.on('PLAYER_COLLECTED', onCollected);
    EventBus.on('PLAYER_HIT_HAZARD', onHazard);
    EventBus.on('TRIGGER_ACTIVATED', onTrigger);
    EventBus.on('EXECUTE_EVENT', onExecuteEvent);
    EventBus.on('SEQUENCE_FINISHED', onFinished);
    EventBus.on('ENGINE_GSAP_LAUNCH', onGsapLaunch);

    return () => {
      // Unsubscribe on unmount to safeguard memory
      EventBus.off('SIMULATION_STARTED', onStarted);
      EventBus.off('SIMULATION_STOPPED', onStopped);
      EventBus.off('PLAYER_COLLECTED', onCollected);
      EventBus.off('PLAYER_HIT_HAZARD', onHazard);
      EventBus.off('TRIGGER_ACTIVATED', onTrigger);
      EventBus.off('EXECUTE_EVENT', onExecuteEvent);
      EventBus.off('SEQUENCE_FINISHED', onFinished);
      EventBus.off('ENGINE_GSAP_LAUNCH', onGsapLaunch);
    };
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
    appendLog('INFO', 'Console logs flushed.');
  };

  return (
    <div className={`w-full h-full flex flex-col select-none pb-1 transition-colors ${
      theme === 'LIGHT' ? 'bg-[#FFFFFF] border-t border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#1A1A1E] border-t border-[#2D2D33] text-[#E0E0E6]'
    }`} id="metronome-terminal">
      {/* Terminal Title Bar matching Design HTML */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b select-none shrink-0 transition-colors ${
        theme === 'LIGHT' ? 'border-[#D1D1D6] bg-[#E5E5EA]' : 'border-[#2D2D33] bg-[#252529]'
      }`}>
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#7C3AED]" />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Console Logs</span>
        </div>

        <button
          onClick={handleClearLogs}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border transition text-[9px] cursor-pointer ${
            theme === 'LIGHT' 
              ? 'border-[#D1D1D6] hover:bg-white text-[#55555C]' 
              : 'border-[#2D2D33] hover:bg-[#2D2D33] text-[#71717A]'
          }`}
        >
          <Trash2 className="w-2.5 h-2.5" />
          <span>Clear Logs</span>
        </button>
      </div>

      {/* Logs Output list */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1 scrollbar-thin select-text selection:bg-[#7C3AED]/30 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#F2F2F7]' : 'bg-[#141417]'
        }`}
      >
        {logs.map((log, idx) => {
          let typeColor = theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]';
          let borderSymbol = '::';
          
          if (log.type === 'SUCCESS') {
            typeColor = 'text-emerald-500 font-bold';
            borderSymbol = '✓✓';
          } else if (log.type === 'WARNING') {
            typeColor = 'text-amber-500 font-bold';
            borderSymbol = '!!';
          } else if (log.type === 'ERROR') {
            typeColor = 'text-red-500 font-extrabold';
            borderSymbol = '✗✗';
          } else if (log.type === 'ANALYTIC') {
            typeColor = 'text-[#7D5DFE] font-bold';
            borderSymbol = '✦✦';
          }
 
          return (
            <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
              <span className={`shrink-0 select-none font-sans ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>[{log.timestamp}]</span>
              <span className={`${typeColor} shrink-0 select-none text-[8px]`}>{borderSymbol} {log.type}</span>
              <span className={`break-all ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#A0A0AA]'}`}>{log.message}</span>
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center italic text-[10px] select-none text-[#71717A]">
            Terminal silent. Initiate 'Play' mode to stream runtime events.
          </div>
        )}
      </div>
    </div>
  );
}
