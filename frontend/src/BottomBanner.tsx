import { useRef, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function BottomBanner() {
  // Reference to the section to track its position in the viewport
  const containerRef = useRef<HTMLElement>(null);

  // Track the scroll progress specifically for this component
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  });

  // Map the scroll progress (0 to 1) to animation values
  const textY = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.8, 1], [0, 0.8, 1]);
  const textScale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);

  // Ember particles for banner
  const embers = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: Math.random() * 5,
    duration: 5 + Math.random() * 3,
    x: Math.random() * 100,
    opacity: Math.random() * 0.5 + 0.1,
  })), []);

  return (
    <section 
      ref={containerRef}
      className="relative flex h-[30vh] items-center justify-center overflow-hidden bg-gradient-to-b from-[#2a2520] via-[#1a1612] to-[#0f0d0a] md:h-[40vh]"
    >
      {/* Premium gradient border */}
      <div className="absolute top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[#D9A521]/40 to-transparent" />

      {/* Ambient orbs */}
      <motion.div
        className="absolute left-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-[#D9A521]/10 blur-[100px]"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-[#F2CD7C]/8 blur-[100px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />

      {/* Rising ember particles */}
      {embers.map(ember => (
        <motion.div
          key={`ember-${ember.id}`}
          className="absolute h-0.5 w-0.5 rounded-full bg-[#F2CD7C]"
          style={{
            left: `${ember.x}%`,
            bottom: 0,
            opacity: ember.opacity,
            boxShadow: '0 0 12px rgba(242, 205, 124, 0.8)',
          }}
          animate={{
            y: [-20, -window.innerHeight - 100],
            opacity: [ember.opacity, 0],
            scale: [1, 0.3],
            x: [0, Math.random() * 40 - 20],
          }}
          transition={{
            duration: ember.duration,
            delay: ember.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Animated Background Text */}
      <motion.div 
        style={{ 
          y: textY, 
          opacity: textOpacity, 
          scale: textScale 
        }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.h1
          className="
            select-none
            whitespace-nowrap
            font-black
            leading-none
            tracking-[-0.08em]
            text-transparent
            bg-gradient-to-br
            from-[#FFE5A8]
            via-[#F2CD7C]
            to-[#D9A521]
            bg-clip-text
            drop-shadow-2xl
            
            text-7xl
            sm:text-8xl
            md:text-[10rem]
            lg:text-[13rem]
            xl:text-[16rem]
          "
          animate={{
            textShadow: [
              '0 0 40px rgba(242, 205, 124, 0.2)',
              '0 0 60px rgba(242, 205, 124, 0.4)',
              '0 0 40px rgba(242, 205, 124, 0.2)',
            ],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          Built by Akshay
        </motion.h1>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-[#0f0d0a] via-[#0f0d0a]/50 to-transparent pointer-events-none" />
    </section>
  );
}
