import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-white text-[#1A1A1A]">
      <Outlet />
    </div>
  );
}
