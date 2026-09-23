import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createReferralLink,
  deactivateReferralLink,
  deleteReferralLink,
  getReferralLinksByVendor,
} from '@/lib/vendors';
import { getPaquetes } from '@/lib/paquetes';
import { requireVendorToken, vendorHasPackageAccess } from '@/lib/vendorAuth';

const createSchema = z.object({
  packageId: z.string().min(1),
  code: z.string().min(3).max(60),
});

const patchSchema = z.object({
  linkId: z.string().min(1),
  action: z.enum(['deactivate']),
});

const deleteSchema = z.object({
  linkId: z.string().min(1),
});

export async function GET(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  try {
    const [links, paquetes] = await Promise.all([getReferralLinksByVendor(vendor.id), getPaquetes()]);
    const packages = paquetes
      .filter((item) => vendorHasPackageAccess(vendor, item.id))
      .map((item) => ({
        id: item.id,
        title: String(item.titulo ?? ''),
        slug: String(item.slug ?? ''),
      }));

    return NextResponse.json({
      vendor: { id: vendor.id, name: vendor.name, email: vendor.email },
      allowedPackages: vendor.allowedPackages ?? vendor.allowedExperiences ?? null,
      links,
      packages,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudieron cargar los enlaces';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((item) => item.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  if (!vendorHasPackageAccess(vendor, payload.packageId)) {
    return NextResponse.json({ error: 'No tenés permiso para ese paquete' }, { status: 403 });
  }

  try {
    const id = await createReferralLink({
      vendorId: vendor.id,
      code: payload.code.trim().toUpperCase(),
      active: true,
      utm: null,
      experienceId: payload.packageId,
    });
    return NextResponse.json({ id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo crear el enlace';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((item) => item.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const links = await getReferralLinksByVendor(vendor.id);
  if (!links.some((item) => item.id === payload.linkId)) {
    return NextResponse.json({ error: 'No tenés permiso para este enlace' }, { status: 403 });
  }

  await deactivateReferralLink(payload.linkId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof deleteSchema>;
  try {
    payload = deleteSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((item) => item.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const links = await getReferralLinksByVendor(vendor.id);
  const link = links.find((item) => item.id === payload.linkId);
  if (!link) {
    return NextResponse.json({ error: 'No tenés permiso para este enlace' }, { status: 403 });
  }
  if ((link.salesCount ?? 0) > 0) {
    return NextResponse.json({ error: 'No podés eliminar un enlace con ventas' }, { status: 400 });
  }

  await deleteReferralLink(payload.linkId);
  return NextResponse.json({ ok: true });
}
