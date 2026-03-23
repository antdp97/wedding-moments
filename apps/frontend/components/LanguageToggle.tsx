"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "./ui/button";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full shadow-sm bg-white/50 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/40 transition-all"
      >
        <Globe className="h-[1.2rem] w-[1.2rem] text-primary" />
        <span className="sr-only">Toggle language</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-32 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl overflow-hidden z-50 py-1"
          >
            <button
              onClick={() => {
                setLanguage('vi');
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                language === 'vi' ? 'font-bold text-primary bg-primary/5' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Tiếng Việt
            </button>
            <button
              onClick={() => {
                setLanguage('en');
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                language === 'en' ? 'font-bold text-primary bg-primary/5' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              English
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
