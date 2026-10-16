import React from 'react';
import { motion, cardSpring, wobbleSpring } from '../../muf/core/muf-motion';
import { TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { MufCountUpText } from '../../muf/core/muf-applike';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  trendUnit?: string;
  subText?: string;
  isNegative?: boolean;
  isProfit?: boolean;
}

export function StatCard({ label, value, icon: Icon, trend, trendUnit = '', subText, isNegative, isProfit }: StatCardProps) {
  const isPositive = trend && trend > 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={cardSpring}
      className={`group relative overflow-hidden rounded-2xl border bg-white/90 dark:bg-[#0d1a11]/90 p-4 shadow-sm backdrop-blur transition-colors duration-200 hover:shadow-xl ${
      isProfit === true ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10' :
      isProfit === false ? 'border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10' :
      'border-slate-200 dark:border-[#203528] hover:border-emerald-300 dark:hover:border-emerald-700'
    }`}>
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-500/10 transition-transform duration-300 group-hover:scale-125" />
      <Eye className="absolute right-3 bottom-3 w-3.5 h-3.5 text-emerald-500/70 opacity-0 group-hover:opacity-100 transition" />
      <div className="relative flex justify-between items-start mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <motion.div
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={wobbleSpring}
          className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-2 text-emerald-600 dark:text-emerald-300"
        >
          <Icon className="w-4 h-4" />
        </motion.div>
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-display text-2xl font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : isProfit === true ? 'text-emerald-700 dark:text-emerald-400' : isProfit === false ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}><MufCountUpText text={String(value)} /></span>
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(trend)}{trendUnit}
            </div>
          )}
        </div>
        {subText && <p className="text-[11px] text-slate-400 mt-1">{subText}</p>}
      </div>
    </motion.div>
  );
}
