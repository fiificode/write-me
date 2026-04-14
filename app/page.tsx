'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, FolderOpen, Cloud, Shield, Sparkles } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const navVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }
  }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <motion.nav
        initial="hidden"
        animate="visible"
        variants={navVariants}
        className="flex items-center justify-between px-6 py-4 lg:px-12"
      >
        <motion.div
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Image
            src="/logo.png"
            alt="Writeup"
            width={80}
            height={80}
            className="h-20 w-auto"
          />
        </motion.div>
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-gray-600 p-4 cursor-pointer hover:text-gray-900">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-black px-4 py-4 hover:bg-gray-800 text-white cursor-pointer">
              Sign up
            </Button>
          </Link>
        </motion.div>
      </motion.nav>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-24 lg:px-12 lg:pt-24 lg:pb-32">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeIn}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>Free to use</span>
          </motion.div>

          <motion.h1
            variants={fadeIn}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-6 leading-tight"
          >
            Capture ideas, <br className="hidden sm:block" />
            <span className="text-gray-500">organize thoughts</span>
          </motion.h1>

          <motion.p
            variants={fadeIn}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            A clean, fast notes app that works offline and syncs across all your devices.
            Write freely, find instantly, never lose an idea.
          </motion.p>

          <motion.div
            variants={fadeIn}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button size="lg" className="bg-black cursor-pointer hover:bg-gray-800 text-white px-8 py-6 text-base rounded-lg shadow-lg shadow-gray-900/20 transition-all hover:shadow-xl hover:shadow-gray-900/30">
                  Get started free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/login">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button variant="outline" size="lg" className="px-8 cursor-pointer py-6 text-base rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50">
                  I already have an account
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-24 lg:px-12">
        <motion.div
          className="max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<FileText className="w-6 h-6 text-gray-900" />}
              title="Rich Text Editor"
              description="Write with headings, lists, links, images, and tables."
              delay={0}
            />
            <FeatureCard
              icon={<FolderOpen className="w-6 h-6 text-gray-700" />}
              title="Organize with Folders"
              description="Keep your notes tidy with custom folders and pinning."
              delay={0.1}
            />
            <FeatureCard
              icon={<Cloud className="w-6 h-6 text-gray-600" />}
              title="Cloud Sync"
              description="Your notes sync automatically when you're online."
              delay={0.2}
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-gray-500" />}
              title="Works Offline"
              description="Keep writing even without internet. Changes sync later."
              delay={0.3}
            />
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="px-6 py-8 lg:px-12 border-t border-gray-200"
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Writeup"
              width={80}
              height={80}
              className="h-20 w-auto opacity-60"
            />
          </div>
          <p className="text-sm text-gray-400">
            A simple notes app for focused writing.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay = 0 }: { icon: React.ReactNode; title: string; description: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeIn}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <motion.div
        className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {icon}
      </motion.div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}
