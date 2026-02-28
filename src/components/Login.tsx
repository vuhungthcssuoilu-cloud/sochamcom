import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setError('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden pb-24">
      {/* Background pattern similar to the original if needed, but we'll keep it simple gray */}
      
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300 relative z-10">
        
        {/* Header Section */}
        <div className="relative h-28 sm:h-32 flex items-center justify-center border-b-[3px] border-gray-300 overflow-hidden bg-gradient-to-r from-[#fff8e1] via-[#ffe082] to-[#ffca28]">
          {/* Landscape image on the right */}
          <div 
            className="absolute inset-y-0 right-0 w-2/3 opacity-60 mix-blend-multiply" 
            style={{ 
              backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80')", 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 40%)',
              maskImage: 'linear-gradient(to right, transparent, black 40%)'
            }}
          ></div>
          
          {/* Text */}
          <div className="relative z-10 text-center flex flex-col items-center justify-center w-full px-4">
            <h2 className="text-lg sm:text-xl font-bold text-[#8B4513] uppercase tracking-wide" style={{ textShadow: '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff, 2px 2px 4px rgba(0,0,0,0.3)' }}>
              Hệ thống quản lý nội trú
            </h2>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#8B4513] uppercase tracking-wider mt-1" style={{ textShadow: '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff, 2px 2px 4px rgba(0,0,0,0.3)' }}>
              Sổ Chấm Cơm
            </h1>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8 sm:p-12 relative">
          {/* Yellow wave at bottom right */}
          <div className="absolute bottom-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <svg className="absolute bottom-0 right-0 w-3/4 h-48 sm:h-64" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M100,100 L100,0 C60,80 20,90 0,100 Z" fill="#fef08a" opacity="0.6" />
              <path d="M100,100 L100,20 C50,80 10,95 0,100 Z" fill="#fde047" opacity="0.8" />
              <path d="M100,100 L100,40 C40,80 5,95 0,100 Z" fill="#eab308" opacity="0.9" />
            </svg>
          </div>

          <form className="space-y-4 max-w-md mx-auto relative z-10" onSubmit={handleLogin}>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <label htmlFor="email-address" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">Tài khoản Gmail:</label>
              <div className="w-full sm:w-2/3">
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center">
              <label htmlFor="password" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">Mật khẩu:</label>
              <div className="w-full sm:w-2/3">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="hidden sm:block sm:w-1/3"></div>
              <div className="w-full sm:w-2/3 flex items-center">
                <input type="checkbox" id="remember" className="mr-2 cursor-pointer w-4 h-4 sm:w-auto sm:h-auto" />
                <label htmlFor="remember" className="text-sm text-black cursor-pointer">Nhớ mật khẩu</label>
              </div>
            </div>

            {error && (
              <div className="flex flex-col sm:flex-row sm:items-center mt-2">
                <div className="hidden sm:block sm:w-1/3"></div>
                <div className="w-full sm:w-2/3 text-red-600 text-xs font-medium">
                  {error}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center mt-6 pt-4">
              <div className="hidden sm:block sm:w-1/3"></div>
              <div className="w-full sm:w-2/3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                >
                  {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
                <button 
                  type="button"
                  onClick={handleSignUp} 
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                >
                  Đăng ký
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Footer info */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-500">
        <p className="font-medium">Ứng dụng được phát triển bởi: Vũ Văn Hùng</p>
        <p>SĐT: 0984 246 993 - Đơn vị công tác tại trường PTDTBT TH và THCS Suối Lư</p>
      </div>
    </div>
  );
}
