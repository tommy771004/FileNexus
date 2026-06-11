import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideIcon, ChevronRight } from 'lucide-react';

interface LiquidExpandablePanelProps {
  title: string;
  icon: LucideIcon;
  description: string;
  children: React.ReactNode;
}

export function LiquidExpandablePanel({
  title,
  icon: Icon,
  description,
  children
}: LiquidExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 極端動態曲線 (Extreme Ease / Spring Physics)
  // 這完美模擬了 After Effects 中的物體彈性轉換
  const liquidSpring = {
    type: "spring" as const,
    stiffness: 300,
    damping: 24,
    mass: 0.8,
  };

  return (
    <motion.div
      layout
      transition={liquidSpring}
      data-expanded={isExpanded}
      className={`
        liquid-glass liquid-glass-sweep liquid-morph
        cursor-pointer
        group
        ${isExpanded ? 'p-6 sm:p-8 bg-white/5' : 'p-4 sm:p-5'}
      `}
      onClick={() => !isExpanded && setIsExpanded(true)}
      style={{
        // 效能優化 (Performance Optimization)
        willChange: 'transform, height, border-radius',
        transformOrigin: 'top center'
      }}
    >
      <motion.div layout className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div 
            layout 
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
          >
            <Icon className="h-6 w-6 text-white/90" />
          </motion.div>
          <motion.div layout>
            <motion.h3 layout className="text-lg font-semibold text-white/90 tracking-tight">
              {title}
            </motion.h3>
            <AnimatePresence>
              {!isExpanded && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-white/60"
                >
                  {description}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        
        <motion.button
          layout
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={liquidSpring}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-white/70" />
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
            exit={{ opacity: 0, height: 0, filter: 'blur(10px)' }}
            transition={liquidSpring}
            className="overflow-hidden"
          >
            <div className="pt-6 border-t border-white/10 mt-6 text-white/80">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
