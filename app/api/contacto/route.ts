import { NextResponse } from 'next/server';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { ADMIN_EMAIL, SITE_NAME } from '@/lib/constants';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import * as z from 'zod';

// Schema for request validation
const contactFormSchema = z.object({
  categoria: z.enum(['soporte', 'ventas', 'informacion', 'otro'], {
    required_error: 'Selecciona una categoría válida',
  }),
  nombre: z.string().min(2, 'Nombre demasiado corto').max(100, 'Nombre demasiado largo'),
  email: z.string().email('Email inválido'),
  asunto: z.string().min(5, 'Asunto demasiado corto').max(200, 'Asunto demasiado largo'),
  mensaje: z.string().min(10, 'Mensaje demasiado corto').max(2000, 'Mensaje demasiado largo'),
  // Optional fields depending on category
  referencia: z.string().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = contactFormSchema.parse(body);

    // Save to Firestore if enabled
    if (firebaseEnabled) {
      await addDoc(collection(db, 'contactos'), {
        ...data,
        fechaCreacion: Timestamp.now(),
        leida: false,
      });
    }

    // Send email via Resend if enabled
    let emailSent = false;
    if (isResendConfigured() && resend) {
      const from = getFromEmail();
      const subject = `[Contacto - ${data.categoria}] ${data.asunto} - ${SITE_NAME}`;

      // Build HTML email
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">Nuevo mensaje de contacto</h2>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p><strong>Categoría:</strong> ${data.categoria}</p>
            <p><strong>Nombre:</strong> ${data.nombre}</p>
            <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
            ${data.referencia ? `<p><strong>Referencia:</strong> ${data.referencia}</p>` : ''}
          </div>
          <div>
            <h3 style="color: #111827;">Asunto: ${data.asunto}</h3>
            <p style="white-space: pre-wrap; line-height: 1.6;">${data.mensaje}</p>
          </div>
        </div>
      `;

      // Send to admin
      const result: any = await resend.emails.send({
        from,
        to: ADMIN_EMAIL,
        subject,
        html,
        replyTo: data.email,
      });

      if (!result.error) {
        emailSent = true;
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      savedToDb: firebaseEnabled,
    });
  } catch (error) {
    console.error('Error processing contact form:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error processing your message',
      },
      { status: 500 }
    );
  }
}
