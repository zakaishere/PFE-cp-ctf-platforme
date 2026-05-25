"use client";

import { motion } from "framer-motion";
import { Play, ShieldCheck, CheckCircle } from "lucide-react";

const features = [
  {
    icon: Play,
    title: "Real-time Execution",
    description:
      "Run code instantly in 20+ languages with our blazing-fast cloud compiler. See results in milliseconds.",
  },
  {
    icon: ShieldCheck,
    title: "Live Anti-Cheat Exams",
    description:
      "Proctored coding exams with tab-switch detection, plagiarism analysis, and live monitoring for academic integrity.",
  },
  {
    icon: CheckCircle,
    title: "Automated Grading",
    description:
      "Instant, unbiased grading against hidden test cases. Detailed feedback on correctness, efficiency, and style.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            Everything you need to teach & learn code
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            A platform purpose-built for academic coding — from practice to proctored finals.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group rounded-xl border border-white/10 bg-card/50 backdrop-blur-sm p-6 transition-all hover:border-white/20 hover:bg-card/70"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
