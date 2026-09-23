'use client';

import { motion, Variants } from 'framer-motion';
import BlogCard from '@/components/BlogCard';
import { BlogPost } from '@/types';

interface BlogSectionProps {
  posts: BlogPost[];
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  fadeInUpVariants: Variants;
  fadeInDownVariants: Variants;
  fadeInScaleVariants: Variants;
  staggerFastVariants: Variants;
}

export default function BlogSection({
  posts,
  fadeInLeftVariants,
  fadeInRightVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  fadeInScaleVariants,
  staggerFastVariants,
}: BlogSectionProps) {
  const lineRevealVariants: Variants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  if (posts.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-transparent border-t border-primary/10 overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-10 md:mb-14 max-w-3xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.16, delayChildren: 0.2 }}
        >
          <motion.div className="inline-block mb-4" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">Blog</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight overflow-hidden"
            variants={fadeInRightVariants}
            transition={{ duration: 0.7 }}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Últimas noticias
            </motion.span>
          </motion.h2>
          <motion.p
            className="text-sm md:text-sm text-[#4B5563] overflow-hidden"
            variants={fadeInUpVariants}
            transition={{ duration: 0.65 }}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Novedades, lanzamientos y tips para viajar mejor.
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
          variants={fadeInScaleVariants}
          transition={{ duration: 0.65, delay: 0.05 }}
        >
          {posts.slice(0, 4).map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
