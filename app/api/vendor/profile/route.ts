import { NextResponse } from 'next/server';
import { getPaquetes } from '@/lib/paquetes';
import { requireVendorToken, vendorHasPackageAccess } from '@/lib/vendorAuth';

export async function GET(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  try {
    const paquetes = await getPaquetes();
    const allowedPackages = paquetes.filter((item) => vendorHasPackageAccess(vendor, item.id));
    return NextResponse.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
      },
      packages: allowedPackages,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo cargar el perfil';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
