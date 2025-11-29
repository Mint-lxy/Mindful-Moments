
import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { DiaryEntry } from '../types';

interface MoodChartProps {
  entries: DiaryEntry[];
}

type TimeRange = '7days' | '30days' | 'all';

export const MoodChart: React.FC<MoodChartProps> = ({ entries }) => {
  const [range, setRange] = useState<TimeRange>('7days');

  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0); // Default to beginning of time

    if (range === '7days') {
      cutoff = new Date(now.setDate(now.getDate() - 7));
    } else if (range === '30days') {
      cutoff = new Date(now.setDate(now.getDate() - 30));
    }

    return [...entries]
      .filter(entry => new Date(entry.date) >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        fullDate: new Date(entry.date).toLocaleDateString('zh-CN'),
        score: entry.moodScore,
        summary: entry.summary
      }));
  }, [entries, range]);

  if (entries.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400 bg-white rounded-xl border border-slate-100">
        <p className="text-sm">暂无心情数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
      <div className="flex justify-between items-center mb-4 relative z-10">
        <h3 className="text-base font-bold text-slate-700">心情趋势</h3>
        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
          <button 
            onClick={() => setRange('7days')}
            className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${range === '7days' ? 'bg-white text-primary shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'}`}
          >
            7天
          </button>
          <button 
            onClick={() => setRange('30days')}
            className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${range === '30days' ? 'bg-white text-primary shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'}`}
          >
            30天
          </button>
          <button 
            onClick={() => setRange('all')}
            className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${range === 'all' ? 'bg-white text-primary shadow-sm font-medium' : 'text-slate-400 hover:text-slate-600'}`}
          >
            全部
          </button>
        </div>
      </div>
      
      <div className="h-40 w-full relative z-10">
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--color-primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="rgb(var(--color-primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10}} 
                  dy={5}
                  interval="preserveStartEnd"
              />
              <YAxis 
                  domain={[0, 10]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10}}
              />
              <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelStyle={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '12px' }}
                  itemStyle={{ color: 'rgb(var(--color-primary))', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: number) => [value, '心情指数']}
                  labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                          return (payload[0].payload as any).fullDate;
                      }
                      return label;
                  }}
                  cursor={{ stroke: 'rgb(var(--color-primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="rgb(var(--color-primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorMood)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            该时间段内没有数据
          </div>
        )}
      </div>
    </div>
  );
};
