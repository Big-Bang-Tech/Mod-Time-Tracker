import React, { useState, useEffect, useMemo } from 'react';
import { Project, DailyLog, ActivityLog } from '../types';
import { getIntelligentInsights } from '../services/geminiService';

interface ReportsProps {
  projects: Project[];
  historicalLogs: DailyLog[];
  onManualCommit: () => void;
}

const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const formatHHMMSS = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${ss}`;
};

const formatHM = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const formatDecimalHours = (sec: number) => {
  const v = Math.max(0, sec) / 3600;
  return v.toFixed(2);
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const Reports: React.FC<ReportsProps> = ({ projects, historicalLogs, onManualCommit }) => {
  const [insight, setInsight] = useState('ANALIZANDO PATRONES OPERATIVOS...');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyDecimal = async (logId: string, sec: number) => {
    const value = formatDecimalHours(sec);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(logId);
      setTimeout(() => setCopiedId(prev => (prev === logId ? null : prev)), 1500);
    } catch (_) {
      // Fallback silencioso si el navegador bloquea el portapapeles
    }
  };

  // ----- Insights de Gemini (mantenido del Reports anterior)
  useEffect(() => {
    const fetchInsight = async () => {
      const logsToAnalyze: ActivityLog[] = historicalLogs.length > 0
        ? historicalLogs.map(l => ({
            id: l.id,
            projectName: l.projectName,
            startTime: '-',
            endTime: '-',
            duration: (l.durationSeconds / 60).toFixed(0) + 'm',
            status: l.status,
            color: 'vibrant-blue'
          }))
        : [];
      if (logsToAnalyze.length > 0) {
        const text = await getIntelligentInsights(logsToAnalyze);
        setInsight(text);
      } else {
        setInsight('SIN REGISTROS DETECTADOS. INICIE EL SEGUIMIENTO PARA COMENZAR EL ANÁLISIS.');
      }
    };
    fetchInsight();
  }, [historicalLogs]);

  const todaySec = useMemo(
    () => projects.reduce((acc, p) => acc + (p.currentDaySeconds || 0), 0),
    [projects]
  );

  // ----- Indexación: segundos por día
  const secondsByDate = useMemo(() => {
    const m = new Map<string, number>();
    historicalLogs.forEach(l => {
      const d = startOfDay(new Date(l.date));
      const k = d.toDateString();
      m.set(k, (m.get(k) ?? 0) + l.durationSeconds);
    });
    return m;
  }, [historicalLogs]);

  // ----- KPIs con comparativa
  const today = useMemo(() => startOfDay(new Date()), []);
  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);

  const sumDays = (from: Date, to: Date) => {
    let total = 0;
    const cur = new Date(from);
    while (cur <= to) {
      total += secondsByDate.get(cur.toDateString()) ?? 0;
      cur.setDate(cur.getDate() + 1);
    }
    return total;
  };

  const weekStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [today]);
  const prevWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekStart]);
  const prevWeekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 1);
    return d;
  }, [weekStart]);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const prevMonthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() - 1, 1),
    [today]
  );
  const prevMonthEnd = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - 1);
    return d;
  }, [monthStart]);

  const yesterdaySec = secondsByDate.get(yesterday.toDateString()) ?? 0;
  const thisWeekSec = todaySec + sumDays(weekStart, yesterday);
  const prevWeekSec = sumDays(prevWeekStart, prevWeekEnd);
  const thisMonthSec = todaySec + sumDays(monthStart, yesterday);
  const prevMonthSec = sumDays(prevMonthStart, prevMonthEnd);
  const totalAllTimeSec = useMemo(
    () => todaySec + historicalLogs.reduce((s, l) => s + l.durationSeconds, 0),
    [historicalLogs, todaySec]
  );

  const trendPct = (current: number, prev: number): number | null => {
    if (prev === 0) return current > 0 ? null : 0;
    return ((current - prev) / prev) * 100;
  };

  const kpis = [
    { label: 'Hoy', value: todaySec, prev: yesterdaySec, prevLabel: 'vs ayer', icon: 'today' },
    { label: 'Esta semana', value: thisWeekSec, prev: prevWeekSec, prevLabel: 'vs semana ant.', icon: 'date_range' },
    { label: 'Este mes', value: thisMonthSec, prev: prevMonthSec, prevLabel: 'vs mes ant.', icon: 'calendar_month' },
    { label: 'Acumulado', value: totalAllTimeSec, prev: -1, prevLabel: 'todo el histórico', icon: 'all_inclusive' }
  ];

  // ----- Heatmap calendario (últimos 91 días = 13 semanas)
  const heatmapData = useMemo(() => {
    const days = 91;
    const cells: Array<{ date: Date; seconds: number } | null> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const sec = i === 0
        ? todaySec + (secondsByDate.get(d.toDateString()) ?? 0)
        : (secondsByDate.get(d.toDateString()) ?? 0);
      cells.push({ date: d, seconds: sec });
    }
    // Agrupar por semana (columna), con padding inicial según día de la semana
    const weeks: Array<Array<{ date: Date; seconds: number } | null>> = [];
    let week: Array<{ date: Date; seconds: number } | null> = [];
    cells.forEach((c, i) => {
      if (i === 0 && c) {
        const dow = c.date.getDay();
        for (let j = 0; j < dow; j++) week.push(null);
      }
      week.push(c);
      if (c && c.date.getDay() === 6) {
        weeks.push(week);
        week = [];
      }
    });
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    const maxSec = Math.max(...cells.filter(Boolean).map(c => c!.seconds), 1);
    return { weeks, maxSec };
  }, [secondsByDate, todaySec, today]);

  const heatmapLevel = (sec: number, max: number) => {
    if (sec <= 0) return 0;
    const ratio = sec / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  const heatmapColors = [
    'bg-mod-fg/[0.06]',
    'bg-mod-blue/25',
    'bg-mod-blue/50',
    'bg-mod-blue/75',
    'bg-mod-blue'
  ];

  // ----- Línea de tendencia (últimos 30 días) + media móvil 7 días
  const trendData = useMemo(() => {
    const days = 30;
    const arr: Array<{ date: Date; seconds: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const sec = i === 0
        ? todaySec + (secondsByDate.get(d.toDateString()) ?? 0)
        : (secondsByDate.get(d.toDateString()) ?? 0);
      arr.push({ date: d, seconds: sec });
    }
    const ma = arr.map((_, i) => {
      const slice = arr.slice(Math.max(0, i - 6), i + 1);
      return slice.reduce((s, x) => s + x.seconds, 0) / slice.length;
    });
    return { points: arr, ma };
  }, [secondsByDate, today, todaySec]);

  const renderTrendChart = () => {
    const { points, ma } = trendData;
    const w = 720, h = 220;
    const pad = { top: 16, right: 16, bottom: 28, left: 44 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const maxSec = Math.max(...points.map(p => p.seconds), ...ma, 3600);
    const x = (i: number) => pad.left + (points.length === 1 ? cw / 2 : (i / (points.length - 1)) * cw);
    const y = (sec: number) => pad.top + ch - (sec / maxSec) * ch;

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.seconds)}`).join(' ');
    const maPath = ma.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
    const areaPath = `${linePath} L${x(points.length - 1)},${pad.top + ch} L${x(0)},${pad.top + ch} Z`;

    const yTicks = 4;
    const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxSec / yTicks) * i);
    const xTickStep = Math.ceil(points.length / 6);

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {/* Líneas de cuadrícula horizontales */}
        {tickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.left} x2={w - pad.right}
              y1={y(v)} y2={y(v)}
              stroke="rgb(var(--mod-border))" strokeWidth="1"
              strokeDasharray={i === 0 ? '' : '2 4'}
            />
            <text x={pad.left - 8} y={y(v) + 3} textAnchor="end" fontSize="9" fill="rgb(var(--mod-fg) / 0.5)">
              {formatHM(v)}
            </text>
          </g>
        ))}
        {/* Etiquetas eje X (cada xTickStep días) */}
        {points.map((p, i) => i % xTickStep === 0 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9" fill="rgb(var(--mod-fg) / 0.5)">
            {p.date.getDate()}/{p.date.getMonth() + 1}
          </text>
        ) : null)}
        {/* Área bajo línea */}
        <path d={areaPath} fill="rgb(var(--mod-blue) / 0.12)" />
        {/* Media móvil */}
        <path d={maPath} fill="none" stroke="rgb(var(--mod-fg) / 0.45)" strokeWidth="1.5" strokeDasharray="4 4" />
        {/* Línea principal */}
        <path d={linePath} fill="none" stroke="rgb(var(--mod-blue))" strokeWidth="2" />
        {/* Puntos */}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.seconds)} r="2.5" fill="rgb(var(--mod-blue))">
            <title>{`${p.date.toDateString()} · ${formatHM(p.seconds)}`}</title>
          </circle>
        ))}
      </svg>
    );
  };

  // ----- Distribución por proyecto (donut)
  const projectTotals = useMemo(() => {
    const m = new Map<string, { name: string; color: string; seconds: number }>();
    historicalLogs.forEach(l => {
      const cur = m.get(l.projectId);
      const proj = projects.find(p => p.id === l.projectId);
      if (cur) cur.seconds += l.durationSeconds;
      else m.set(l.projectId, {
        name: l.projectName,
        color: proj?.color ?? 'vibrant-blue',
        seconds: l.durationSeconds
      });
    });
    // sumar segundos en curso de hoy
    projects.forEach(p => {
      if ((p.currentDaySeconds || 0) > 0) {
        const cur = m.get(p.id);
        if (cur) cur.seconds += p.currentDaySeconds;
        else m.set(p.id, { name: p.name, color: p.color, seconds: p.currentDaySeconds });
      }
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .filter(v => v.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
  }, [historicalLogs, projects]);

  const totalProjectsSec = projectTotals.reduce((s, p) => s + p.seconds, 0);

  const renderDonut = () => {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const sw = 22;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const top = projectTotals.slice(0, 8);
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(var(--mod-border))" strokeWidth={sw} />
        {top.map((p, i) => {
          const portion = totalProjectsSec > 0 ? p.seconds / totalProjectsSec : 0;
          const dash = portion * circumference;
          const el = (
            <circle
              key={p.id}
              cx={center} cy={center} r={radius}
              fill="none"
              className={p.color.replace('vibrant-', 'stroke-current ').includes('stroke-current') ? '' : ''}
              stroke="currentColor"
              strokeWidth={sw}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ color: '' }}
            />
          );
          offset += dash;
          return el;
        })}
        {/* Para usar las clases vibrant-* como color del trazo, usamos un wrapper */}
      </svg>
    );
  };

  // ----- Día de la semana: media histórica
  const dowAverages = useMemo(() => {
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    secondsByDate.forEach((sec, dateStr) => {
      const d = new Date(dateStr);
      const dow = d.getDay();
      sums[dow] += sec;
      counts[dow] += 1;
    });
    return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  }, [secondsByDate]);

  const dowMax = Math.max(...dowAverages, 1);

  // ----- Streak (racha)
  const streak = useMemo(() => {
    const set = new Set<string>();
    secondsByDate.forEach((sec, k) => {
      if (sec > 0) set.add(k);
    });
    if (todaySec > 0) set.add(today.toDateString());
    let days = 0;
    let cursor = new Date(today);
    if (!set.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (set.has(cursor.toDateString())) {
      days += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return days;
  }, [secondsByDate, todaySec, today]);

  // ----- Cards de estadísticas
  const bestDay = useMemo(() => {
    let best: { date: string; seconds: number } | null = null;
    secondsByDate.forEach((sec, dateStr) => {
      if (!best || sec > best.seconds) best = { date: dateStr, seconds: sec };
    });
    return best;
  }, [secondsByDate]);

  const topProjectMonth = useMemo(() => {
    const m = new Map<string, { name: string; color: string; seconds: number }>();
    historicalLogs.forEach(l => {
      const d = startOfDay(new Date(l.date));
      if (d < monthStart) return;
      const proj = projects.find(p => p.id === l.projectId);
      const cur = m.get(l.projectId);
      if (cur) cur.seconds += l.durationSeconds;
      else m.set(l.projectId, {
        name: l.projectName,
        color: proj?.color ?? 'vibrant-blue',
        seconds: l.durationSeconds
      });
    });
    projects.forEach(p => {
      if ((p.currentDaySeconds || 0) > 0) {
        const cur = m.get(p.id);
        if (cur) cur.seconds += p.currentDaySeconds;
        else m.set(p.id, { name: p.name, color: p.color, seconds: p.currentDaySeconds });
      }
    });
    return Array.from(m.values()).sort((a, b) => b.seconds - a.seconds)[0] ?? null;
  }, [historicalLogs, projects, monthStart]);

  const longestSession = useMemo(() => {
    if (historicalLogs.length === 0) return null;
    return historicalLogs.reduce((max, l) =>
      l.durationSeconds > max.durationSeconds ? l : max
    );
  }, [historicalLogs]);

  const avgSession = useMemo(() => {
    if (historicalLogs.length === 0) return 0;
    return historicalLogs.reduce((s, l) => s + l.durationSeconds, 0) / historicalLogs.length;
  }, [historicalLogs]);

  // ----- CSV export
  const handleExportCSV = () => {
    const escapeCSV = (str: any) => {
      const v = String(str ?? '');
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    };
    const headers = ['ID', 'Fecha', 'Proyecto', 'Duracion (Segundos)', 'Estado'];
    const rows = historicalLogs.map(l => [l.id, l.date, l.projectName, l.durationSeconds, l.status]);
    const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_sistema_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto">
      {/* ============ HEADER ============ */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl lg:text-4xl font-light tracking-tighter text-mod-fg">PANEL DE <span className="font-bold">OPERACIONES</span></h2>
          <div className="h-1 w-20 bg-mod-blue mt-2"></div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-3">Métricas y telemetría personal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 h-10 px-5 border border-mod-border bg-transparent text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-mod-fg hover:text-mod-dark transition-all"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={onManualCommit}
            className="flex items-center gap-2 h-10 px-5 bg-mod-blue text-mod-fg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span>Sincronizar Día</span>
          </button>
        </div>
      </div>

      {/* ============ KPIs ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map((k, i) => {
          const pct = k.prev === -1 ? null : trendPct(k.value, k.prev);
          const arrow = pct === null ? '' : pct > 0 ? '↑' : pct < 0 ? '↓' : '·';
          const arrowColor = pct === null ? 'text-slate-500' : pct > 0 ? 'text-emerald-500' : pct < 0 ? 'text-red-500' : 'text-slate-500';
          return (
            <div key={i} className="bg-mod-card border border-mod-border p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-mod-blue/40 group-hover:bg-mod-blue transition-colors"></div>
              <div className="flex items-start justify-between mb-3">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">{k.label}</p>
                <span className="material-symbols-outlined text-mod-blue/60 text-base">{k.icon}</span>
              </div>
              <p className="text-mod-fg text-2xl lg:text-3xl font-black font-mono tracking-tight leading-none">{formatHM(k.value)}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs font-bold ${arrowColor}`}>{arrow}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-widest">
                  {k.prev === -1
                    ? k.prevLabel
                    : pct === null
                      ? `${k.prevLabel} · sin datos`
                      : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% ${k.prevLabel}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ HEATMAP ============ */}
      <div className="bg-mod-card border border-mod-border p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">grid_on</span>
            Mapa de Actividad · Últimas 13 semanas
          </h3>
          <div className="hidden sm:flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500">
            <span>menos</span>
            {heatmapColors.map((c, i) => (
              <div key={i} className={`${c} w-3 h-3 border border-mod-border`}></div>
            ))}
            <span>más</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {/* Etiquetas de día */}
            <div className="flex flex-col gap-[3px] mr-2">
              {DAY_NAMES.map((n, i) => (
                <div key={i} className="h-[14px] flex items-center text-[8px] text-slate-600 font-bold uppercase tracking-widest" style={{ width: 24 }}>
                  {i % 2 === 1 ? n : ''}
                </div>
              ))}
            </div>
            {heatmapData.weeks.map((wk, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {wk.map((c, di) => {
                  if (!c) return <div key={di} style={{ width: 14, height: 14 }} />;
                  const lvl = heatmapLevel(c.seconds, heatmapData.maxSec);
                  return (
                    <div
                      key={di}
                      title={`${c.date.toDateString()} · ${formatHM(c.seconds)}`}
                      style={{ width: 14, height: 14 }}
                      className={`${heatmapColors[lvl]} border border-mod-border/50 hover:border-mod-fg transition-colors`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ TENDENCIA + DONUT ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
        <div className="lg:col-span-2 bg-mod-card border border-mod-border p-6">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">show_chart</span>
            Tendencia · Últimos 30 días
          </h3>
          <div className="flex items-center gap-4 mb-2 text-[9px] uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-mod-blue"></span><span className="text-slate-500">Diario</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-mod-fg/45 border-dashed"></span><span className="text-slate-500">Media móvil 7d</span></span>
          </div>
          {renderTrendChart()}
        </div>

        <div className="bg-mod-card border border-mod-border p-6">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">donut_large</span>
            Por Proyecto
          </h3>
          {projectTotals.length > 0 ? (
            <div className="flex flex-col items-center">
              {/* Donut con clases vibrant-* aplicadas como color al stroke */}
              <svg width={200} height={200} viewBox="0 0 200 200">
                <circle cx={100} cy={100} r={80} fill="none" stroke="rgb(var(--mod-border))" strokeWidth={22} />
                {(() => {
                  const elements: React.ReactElement[] = [];
                  let off = 0;
                  const C = 2 * Math.PI * 80;
                  projectTotals.slice(0, 8).forEach((p) => {
                    const portion = totalProjectsSec > 0 ? p.seconds / totalProjectsSec : 0;
                    const dash = portion * C;
                    elements.push(
                      <g key={p.id} className={p.color}>
                        <circle
                          cx={100} cy={100} r={80}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={22}
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeDashoffset={-off}
                          transform="rotate(-90 100 100)"
                        >
                          <title>{`${p.name} · ${formatHM(p.seconds)}`}</title>
                        </circle>
                      </g>
                    );
                    off += dash;
                  });
                  return elements;
                })()}
                <text x={100} y={94} textAnchor="middle" fontSize="11" fontWeight="900" fill="rgb(var(--mod-fg))" className="uppercase tracking-widest">Total</text>
                <text x={100} y={114} textAnchor="middle" fontSize="14" fontFamily="monospace" fill="rgb(var(--mod-blue))">{formatHM(totalProjectsSec)}</text>
              </svg>
              <div className="w-full mt-4 space-y-2">
                {projectTotals.slice(0, 5).map(p => {
                  const pct = totalProjectsSec > 0 ? (p.seconds / totalProjectsSec) * 100 : 0;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-[9px] uppercase tracking-widest">
                      <div className={`w-2.5 h-2.5 ${p.color} flex-shrink-0`}></div>
                      <span className="text-mod-fg truncate flex-1">{p.name}</span>
                      <span className="text-mod-blue font-mono">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
                {projectTotals.length > 5 && (
                  <p className="text-[8px] text-slate-600 uppercase tracking-widest pt-1 italic">+{projectTotals.length - 5} más</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500 text-[10px] uppercase tracking-widest italic">Sin datos</div>
          )}
        </div>
      </div>

      {/* ============ DÍA DE LA SEMANA + STREAK ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
        <div className="lg:col-span-2 bg-mod-card border border-mod-border p-6">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">bar_chart</span>
            Promedio por Día de la Semana
          </h3>
          <div className="flex items-end gap-2 lg:gap-4 h-44">
            {DAY_NAMES.map((n, i) => {
              const sec = dowAverages[i];
              const heightPct = (sec / dowMax) * 100;
              const isMax = sec === dowMax && sec > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[9px] text-mod-blue font-mono font-bold">{sec > 0 ? formatHM(sec) : '—'}</span>
                  <div className="w-full bg-mod-dark border border-mod-border h-32 flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-700 ${isMax ? 'bg-mod-blue' : 'bg-mod-blue/50'}`}
                      style={{ height: `${heightPct}%` }}
                      title={`${n} · media ${formatHM(sec)}`}
                    ></div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isMax ? 'text-mod-blue' : 'text-slate-500'}`}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-mod-card border border-mod-border p-6 flex flex-col">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">local_fire_department</span>
            Racha Activa
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className={`text-7xl font-black font-mono leading-none ${streak > 0 ? 'text-mod-blue' : 'text-slate-700'}`}>{streak}</p>
            <p className="mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-[0.25em]">
              {streak === 0 ? 'Sin racha activa' : streak === 1 ? 'día consecutivo' : 'días consecutivos'}
            </p>
            {streak > 0 && (
              <p className="mt-4 text-[9px] text-slate-600 uppercase tracking-widest italic max-w-[200px]">
                {streak >= 7 ? 'Disciplina excepcional' : streak >= 3 ? 'Buen ritmo, sigue así' : 'Construyendo el hábito'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============ STAT CARDS ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="bg-mod-card border border-mod-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-emerald-500 text-base">military_tech</span>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">Mejor día</p>
          </div>
          {bestDay ? (
            <>
              <p className="text-mod-fg text-xl font-black font-mono">{formatHM((bestDay as any).seconds)}</p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{new Date((bestDay as any).date).toLocaleDateString()}</p>
            </>
          ) : (
            <p className="text-slate-600 text-xs italic uppercase tracking-widest">Sin datos</p>
          )}
        </div>

        <div className="bg-mod-card border border-mod-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-500 text-base">workspace_premium</span>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">Top mes actual</p>
          </div>
          {topProjectMonth ? (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 ${topProjectMonth.color} flex-shrink-0`}></div>
                <p className="text-mod-fg text-sm font-bold uppercase tracking-tight truncate">{topProjectMonth.name}</p>
              </div>
              <p className="text-mod-blue text-base font-black font-mono mt-1">{formatHM(topProjectMonth.seconds)}</p>
            </>
          ) : (
            <p className="text-slate-600 text-xs italic uppercase tracking-widest">Sin datos</p>
          )}
        </div>

        <div className="bg-mod-card border border-mod-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-mod-blue text-base">timer</span>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">Sesión más larga</p>
          </div>
          {longestSession ? (
            <>
              <p className="text-mod-fg text-xl font-black font-mono">{formatHM(longestSession.durationSeconds)}</p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest truncate">{longestSession.projectName}</p>
            </>
          ) : (
            <p className="text-slate-600 text-xs italic uppercase tracking-widest">Sin datos</p>
          )}
        </div>

        <div className="bg-mod-card border border-mod-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-slate-400 text-base">straighten</span>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.25em]">Sesión media</p>
          </div>
          {avgSession > 0 ? (
            <>
              <p className="text-mod-fg text-xl font-black font-mono">{formatHM(avgSession)}</p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{historicalLogs.length} sesiones</p>
            </>
          ) : (
            <p className="text-slate-600 text-xs italic uppercase tracking-widest">Sin datos</p>
          )}
        </div>
      </div>

      {/* ============ GEMINI INSIGHT ============ */}
      <div className="bg-mod-blue p-6 mb-8 flex flex-col sm:flex-row items-start gap-4">
        <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-3 sm:min-w-[140px]">
          <span className="material-symbols-outlined text-mod-fg text-2xl">psychology</span>
          <p className="text-mod-fg text-[10px] font-black uppercase tracking-widest">Inteligencia Central</p>
        </div>
        <p className="text-mod-fg text-sm leading-relaxed font-light italic flex-1">"{insight}"</p>
      </div>

      {/* ============ HISTORIAL ============ */}
      <div className="bg-mod-card border border-mod-border overflow-hidden">
        <div className="p-6 bg-mod-dark/50 border-b border-mod-border flex items-center justify-between">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.25em] flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">history</span>
            Historial Operativo
          </h3>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">{historicalLogs.length} registros</span>
        </div>

        {historicalLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-600 uppercase tracking-widest italic text-[10px]">
            Sin datos históricos indexados.
          </div>
        ) : (
          <ul className="divide-y divide-mod-border">
            {historicalLogs.slice(0, 20).map(log => {
              const proj = projects.find(p => p.id === log.projectId);
              const colorClass = proj?.color ?? 'vibrant-blue';
              const decimal = formatDecimalHours(log.durationSeconds);
              const isCopied = copiedId === log.id;
              return (
                <li key={log.id} className="px-6 py-4 hover:bg-mod-fg/[0.03] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
                    {/* Fecha */}
                    <div className="lg:w-32 flex items-center gap-3 flex-shrink-0">
                      <div className={`w-1 h-8 ${colorClass} flex-shrink-0`}></div>
                      <span className="text-slate-500 font-mono text-[11px] uppercase tracking-widest">{log.date}</span>
                    </div>

                    {/* Proyecto */}
                    <div className="flex-1 min-w-0">
                      <p className="text-mod-fg font-bold uppercase tracking-tight text-sm truncate">{log.projectName}</p>
                      {log.comment && (
                        <p className="text-slate-500 text-[11px] mt-1 italic flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5 leading-none">chat_bubble</span>
                          <span className="break-words">{log.comment}</span>
                        </p>
                      )}
                    </div>

                    {/* Duraciones */}
                    <div className="flex items-center gap-3 lg:gap-5 flex-wrap">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Duración</span>
                        <span className="text-mod-blue font-mono font-bold text-sm">{formatHHMMSS(log.durationSeconds)}</span>
                      </div>
                      <button
                        onClick={() => copyDecimal(log.id, log.durationSeconds)}
                        title={isCopied ? '¡Copiado!' : `Copiar "${decimal}" al portapapeles`}
                        className={`flex flex-col items-start group/copy border px-3 py-1.5 transition-all ${
                          isCopied
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-mod-border hover:border-mod-blue hover:bg-mod-blue/5'
                        }`}
                      >
                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest group-hover/copy:text-mod-blue">
                          {isCopied ? '✓ Copiado' : 'Decimal'}
                        </span>
                        <span className={`font-mono font-bold text-sm flex items-center gap-1.5 ${isCopied ? 'text-emerald-400' : 'text-mod-fg'}`}>
                          {decimal}
                          <span className="material-symbols-outlined text-[14px] opacity-50 group-hover/copy:opacity-100">
                            {isCopied ? 'check' : 'content_copy'}
                          </span>
                        </span>
                      </button>
                    </div>

                    {/* Estado */}
                    <div className="lg:w-28 flex-shrink-0">
                      <span className="px-2 py-0.5 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5">
                        {log.status}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {historicalLogs.length > 20 && (
          <div className="p-4 bg-mod-dark/30 border-t border-mod-border text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              Mostrando 20 más recientes · usa Movimientos para ver el listado completo
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
