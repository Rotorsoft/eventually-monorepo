"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { animate } from "@/lib/animation";
import { motion } from "framer-motion";
import { ArrowRight, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function Home() {
  const [, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    animate(ctx, canvas)();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  const eventuallyUrl =
    "https://github.com/Rotorsoft/eventually-monorepo/blob/master/libs/eventually/README.md";

  return (
    <div className="flex flex-col min-h-screen overflow-hidden bg-slate-100 relative">
      <canvas
        ref={canvasRef}
        className="fixed top-6 left-0 w-full h-3/4 -z-10 opacity-30"
      />
      <header className="sticky top-0 z-50 w-full px-3 border-b  bg-slate-300/95 backdrop-blur supports-[backdrop-filter]:bg-slate-300/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 hidden md:flex">
            <Link className="mr-6 flex items-center space-x-2" href="/">
              <span className="hidden font-bold sm:inline-block text-black">
                Eventually
              </span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/docs"
                className="text-black hover:text-orange-500 transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/guide"
                className="text-black hover:text-orange-500 transition-colors"
              >
                Guide
              </Link>
              <Link
                href="/config"
                className="text-black hover:text-orange-500 transition-colors"
              >
                Config
              </Link>
              <Link
                href={eventuallyUrl}
                className="text-black hover:text-orange-500 transition-colors"
              >
                GitHub
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-slate-700">
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
          <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl text-slate-200"
            >
              Eventually
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="max-w-[42rem] leading-normal text-slate-400 sm:text-xl sm:leading-8"
            >
              Lightweight TypeScript framework for building event-driven
              applications
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="space-x-4"
            >
              <Button asChild>
                <Link href="/docs">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={eventuallyUrl} target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>
        <section className="container space-y-6 bg-slate-100 py-8 dark:bg-transparent md:py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl text-slate-700">
              Features
            </h2>
          </div>
          <div className="mx-auto px-3 grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            {[
              "Event Sourcing",
              "CQRS",
              "Domain Driven Design",
              "Hexagonal Architecture",
              "Express Adapter",
              "PostgreSQL Adapter"
            ].map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="bg-slate-50 hover:bg-slate-100 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-black flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-slate-500" />
                      {feature}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">
                      Essential for building robust event-driven systems
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <footer className="bg-slate-300 py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-slate-700 md:text-left">
            Built by{" "}
            <a
              href="https://github.com/Rotorsoft"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Rotorsoft
            </a>
            . The source code is available on{" "}
            <a
              href={eventuallyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
