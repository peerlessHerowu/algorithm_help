'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

// ===== 类型 =====
interface DayData {
  date: string;        // 'yyyy-MM-dd'
  count: number;
  sessions: number;
  reviews: number;
  training: number;
}

// ===== 常量 =====
const WEEK_LABELS = ['', '一', '', '三', '', '五', ''];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CN_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

/** 活动强度 → 颜色（5 级，仿 GitHub 深色风格） */
function getColor(count: number): string {
  if (count === 0) return '#161B22';
  if (count <= 1)  return '#0E4429';
  if (count <= 3)  return '#006D32';
  if (count <= 5)  return '#26A641';
  return '#39D353';
}

/** 格式化日期 'yyyy-MM-dd' */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 生成过去一年的完整日历格子（按周列分组） */
function buildCalendar(): { weeks: { date: Date; dateStr: string }[][] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 从今天往前推 52 周 + 当前周的剩余天数
  const totalDays = 365;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - totalDays);

  // 调整到最近的周日
  const startDay = startDate.getDay(); // 0=Sun
  startDate.setDate(startDate.getDate() - startDay);

  const weeks: { date: Date; dateStr: string }[][] = [];
  let current = new Date(startDate);

  while (current <= today) {
    const week: { date: Date; dateStr: string }[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: new Date(current), dateStr: formatDate(current) });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks };
}

// ===== 主组件 =====
export default function ActivityHeatmap({ userId }: { userId: string }) {
  const { data: rawData } = useSWR<DayData[]>(
    userId ? `/api/v1/analytics/heatmap?userId=${encodeURIComponent(userId)}` : null,
    fetcher
  );

  const [tooltip, setTooltip] = useState<{
    visible: boolean; x: number; y: number; data: DayData | null; dateStr: string;
  }>({ visible: false, x: 0, y: 0, data: null, dateStr: '' });

  // 活动数据 Map
  const dataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    rawData?.forEach(d => map.set(d.date, d));
    return map;
  }, [rawData]);

  // 总统计
  const totalActivity = useMemo(() => {
    if (!rawData || rawData.length === 0) return { total: 0, activeDays: 0, streak: 0 };
    const total = rawData.reduce((sum, d) => sum + d.count, 0);
    const activeDays = rawData.filter(d => d.count > 0).length;
    // 连续天数
    const today = formatDate(new Date());
    let streak = 0;
    const d = new Date();
    while (true) {
      const s = formatDate(d);
      const entry = dataMap.get(s);
      if (entry && entry.count > 0) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return { total, activeDays, streak };
  }, [rawData, dataMap]);

  const { weeks } = useMemo(() => buildCalendar(), []);

  // 月份标签计算（在哪一列出现月份变更）
  const monthPositions = useMemo(() => {
    const positions: { weekIdx: number; month: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        positions.push({ weekIdx: i, month });
        lastMonth = month;
      }
    });
    return positions;
  }, [weeks]);

  const CELL = 12;  // 格子大小
  const GAP  = 2;   // 间距
  const STEP = CELL + GAP;

  return (
    <div className="space-y-3">
      {/* 统计概览 */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
        <span>过去一年：<span className="text-gray-200 font-bold">{totalActivity.total}</span> 次活动</span>
        <span>活跃天数：<span className="text-emerald-400 font-bold">{totalActivity.activeDays}</span> 天</span>
        {totalActivity.streak > 0 && (
          <span>连续学习：<span className="text-amber-400 font-bold">{totalActivity.streak}</span> 天 🔥</span>
        )}
      </div>

      {/* 热力图 */}
      <div className="relative overflow-x-auto">
        <svg
          width={weeks.length * STEP + 32}
          height={7 * STEP + 28}
          className="select-none"
        >
          {/* 月份标签 */}
          {monthPositions.map(({ weekIdx, month }) => (
            <text
              key={weekIdx}
              x={weekIdx * STEP + 32}
              y={10}
              className="fill-gray-500 text-[9px]"
              fontSize="9"
              fill="#6B7280"
            >
              {CN_MONTHS[month]}
            </text>
          ))}

          {/* 星期标签 */}
          {WEEK_LABELS.map((label, i) => label && (
            <text
              key={i}
              x={8}
              y={i * STEP + 22}
              fontSize="9"
              fill="#6B7280"
              dominantBaseline="middle"
            >
              {label}
            </text>
          ))}

          {/* 格子 */}
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const data = dataMap.get(day.dateStr);
              const count = data?.count ?? 0;
              const color = getColor(count);
              const x = wi * STEP + 32;
              const y = di * STEP + 16;
              return (
                <rect
                  key={day.dateStr}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={color}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={e => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({ visible: true, x: rect.left, y: rect.top, data: data ?? null, dateStr: day.dateStr });
                  }}
                  onMouseLeave={() => setTooltip(p => ({ ...p, visible: false }))}
                />
              );
            })
          )}
        </svg>

        {/* 图例 */}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] text-gray-600">少</span>
          {[0, 1, 3, 5, 7].map(n => (
            <div key={n} className="w-3 h-3 rounded-sm" style={{ backgroundColor: getColor(n) }} />
          ))}
          <span className="text-[10px] text-gray-600">多</span>
        </div>
      </div>

      {/* Tooltip（fixed 定位） */}
      {tooltip.visible && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-xl
            px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 16, top: tooltip.y - 70 }}
        >
          <p className="text-gray-300 font-medium mb-1">{tooltip.dateStr}</p>
          {tooltip.data && tooltip.data.count > 0 ? (
            <div className="space-y-0.5 text-gray-400">
              <p>总活动：<span className="text-gray-200">{tooltip.data.count}</span></p>
              {tooltip.data.sessions > 0 && <p>会话：{tooltip.data.sessions}</p>}
              {tooltip.data.reviews > 0 && <p>复习：{tooltip.data.reviews}</p>}
              {tooltip.data.training > 0 && <p>训练：{tooltip.data.training}</p>}
            </div>
          ) : (
            <p className="text-gray-600">无活动</p>
          )}
        </div>
      )}
    </div>
  );
}
