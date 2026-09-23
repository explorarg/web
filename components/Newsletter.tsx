'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle } from 'lucide-react';
import { addDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

// Variantes de animación
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const fadeInVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Por favor ingresá un email válido');
      return;
    }

    setLoading(true);
    try {
      // Verificar si el email ya existe
      const q = query(collection(db, 'newsletter'), where('email', '==', email.toLowerCase()));
      const existingSubscriber = await getDocs(q);
      
      if (!existingSubscriber.empty) {
        toast.error('Este email ya está suscrito', {
          description: 'Ya estás recibiendo nuestro newsletter.',
        });
        setLoading(false);
        return;
      }

      // Agregar nuevo suscriptor
      await addDoc(collection(db, 'newsletter'), {
        email: email.toLowerCase(),
        fechaSuscripcion: Timestamp.now(),
        activo: true,
      });

      toast.success('¡Suscripción exitosa!', {
        description: 'Te mantendremos informado sobre las mejores ofertas.',
      });

      setEmail('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error('Error al suscribir:', error);
      toast.error('Error al suscribirse', {
        description: 'Por favor, intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pt-4 pb-12 md:py-20 bg-transparent overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div 
          className="relative overflow-hidden rounded-3xl bg-primary text-white px-6 py-10 md:px-10 md:py-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={containerVariants}
        >
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Lado izquierdo - Texto con animación */}
            <motion.div 
              className="text-center lg:text-left"
              variants={fadeInVariants}
            >
              {!submitted ? (
                <>
                  <motion.h2 
                    className="text-lg md:text-lg lg:text-lg font-bold text-white mb-3 leading-tight"
                    variants={fadeInVariants}
                  >
                    Mantenete informado sobre nuestras últimas ofertas
                  </motion.h2>
                  <motion.p 
                    className="text-sm md:text-sm text-white/80"
                    variants={fadeInVariants}
                  >
                    Recibí novedades y promociones exclusivas
                  </motion.p>
                </>
              ) : (
                <motion.div 
                  className="flex flex-col lg:flex-row items-center lg:items-start gap-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full flex-shrink-0">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-center lg:text-left">
                    <p className="text-lg md:text-lg lg:text-lg font-bold text-white mb-2">¡Gracias por suscribirte!</p>
                    <p className="text-base md:text-lg text-gray-400">Te mantendremos informado sobre nuestras mejores ofertas.</p>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Lado derecho - Formulario con animación */}
            {!submitted && (
              <motion.div variants={fadeInVariants}>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <motion.div 
                    className="relative"
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <Input
                      type="email"
                      placeholder="Ingresa tu dirección de correo electrónico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-white text-gray-900 border-0 rounded-xl text-sm pl-12 placeholder:text-gray-400 focus:ring-2 focus:ring-white shadow-lg transition-all duration-300"
                      disabled={loading}
                    />
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-secondary text-white font-bold text-sm rounded-xl shadow-lg transition-all duration-300 hover:bg-secondary/90 hover:scale-[1.02]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Suscríbete al Newsletter'
                      )}
                    </Button>
                  </motion.div>
                  
                  {/* Disclaimer */}
                  <p className="text-xs text-white/60 text-center">
                    No compartimos tu información. Podés desuscribirte en cualquier momento.
                  </p>
                </form>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

