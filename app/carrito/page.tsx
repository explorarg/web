import Navbar from '@/components/Navbar';
import CartClient from '@/components/cart/CartClient';
import HomeFooter from '@/components/home/HomeFooter';

export const revalidate = 0;

export default function CarritoPage() {
  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />
      <CartClient />
      <HomeFooter />
    </div>
  );
}
