"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

const codeSnippet = `function twoSum(nums: number[], target: number) {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}`;

const HeroSection = () => {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-accent/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for university-level coding exams
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Master Code.
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Ace Exams.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
            The modern coding platform for students and educators. Practice problems, take proctored exams, and get instant automated feedback.
          </p>

          <div className="flex items-center gap-3">
            <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-lg px-6 h-11 text-sm">
              Start Coding
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="border-white/10 text-foreground hover:bg-white/5 rounded-lg px-6 h-11 text-sm"
            >
              Explore Problems
            </Button>
          </div>
        </motion.div>

        {/* Code Editor Mock */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative hidden lg:block"
        >
          {/* Glow behind editor */}
          <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent rounded-3xl blur-2xl" />

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-lg overflow-hidden shadow-2xl shadow-primary/5">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-muted-foreground ml-2 font-mono">solution.ts</span>
              </div>
              {/* Code */}
              <pre className="p-5 text-sm font-mono leading-relaxed text-muted-foreground overflow-x-auto">
                <code>{codeSnippet}</code>
              </pre>
              {/* Status bar */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-xs text-muted-foreground">
                <span className="text-green-400">All tests passed</span>
                <span>Runtime: 4ms</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
