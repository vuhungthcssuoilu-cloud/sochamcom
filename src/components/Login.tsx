import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Upload } from 'lucide-react';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState(() => {
    return localStorage.getItem('loginBgImage') || 'https://images.unsplash.com/photo-1552089123-2d26226fc2b7?auto=format&fit=crop&w=1200&q=80';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch global background image setting on load
  useEffect(() => {
    const fetchBgImage = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'login_bg_image')
          .single();
          
        if (data && data.setting_value) {
          setBgImage(data.setting_value);
          localStorage.setItem('loginBgImage', data.setting_value);
        }
      } catch (err) {
        console.error('Error fetching background image:', err);
      }
    };
    
    fetchBgImage();
  }, []);
  
  // Captcha state
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState(0);
  const [userCaptchaInput, setUserCaptchaInput] = useState('');

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptchaQuestion(`${num1} + ${num2}`);
    setCaptchaAnswer(num1 + num2);
    setUserCaptchaInput('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    if (parseInt(userCaptchaInput) !== captchaAnswer) {
      setError('Mã xác nhận không đúng. Vui lòng thử lại.');
      generateCaptcha();
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Tài khoản chưa được xác nhận. Vui lòng kiểm tra email hoặc tắt "Confirm email" trong Supabase.');
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
      generateCaptcha();
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !fullName || !phoneNumber || !licenseKey) {
      setError('Vui lòng nhập đầy đủ họ tên, số điện thoại, email, mật khẩu và mã bản quyền.');
      return;
    }

    // Basic Vietnam phone number validation (10 digits, starts with 0)
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setError('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }

    if (parseInt(userCaptchaInput) !== captchaAnswer) {
      setError('Mã xác nhận không đúng. Vui lòng thử lại.');
      generateCaptcha();
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Format phone number to E.164 format (+84...)
    const formattedPhone = '+84' + phoneNumber.substring(1);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: formattedPhone,
          license_key: licenseKey,
        }
      }
    });

    if (error) {
      setError(error.message);
      generateCaptcha();
    } else {
      setSuccessMsg('Đăng ký thành công! Vui lòng đăng nhập.');
      setIsRegisterMode(false);
      setPassword('');
      setUserCaptchaInput('');
      setPhoneNumber('');
      setLicenseKey('');
      generateCaptcha();
    }
    setLoading(false);
  };

  const saveBgImageToDb = async (url: string) => {
    try {
      // Try to update first
      const { data, error } = await supabase
        .from('app_settings')
        .update({ setting_value: url })
        .eq('setting_key', 'login_bg_image')
        .select();
        
      if (error) {
        console.error('Error updating background image:', error);
        alert('Lỗi khi lưu ảnh lên hệ thống. Vui lòng kiểm tra lại cơ sở dữ liệu Supabase (bảng app_settings).');
        return;
      }
        
      // If no rows updated, it means the key doesn't exist, so insert it
      if (!data || data.length === 0) {
        const { error: insertError } = await supabase
          .from('app_settings')
          .insert([{ setting_key: 'login_bg_image', setting_value: url }]);
          
        if (insertError) {
          console.error('Error inserting background image:', insertError);
          alert('Lỗi khi lưu ảnh lên hệ thống. Vui lòng kiểm tra lại cơ sở dữ liệu Supabase (bảng app_settings).');
        }
      }
    } catch (err) {
      console.error('Error saving background image to DB:', err);
      alert('Lỗi kết nối khi lưu ảnh lên hệ thống.');
    }
  };

  const handleConfigImage = async () => {
    const newUrl = window.prompt('Nhập đường dẫn (URL) hình ảnh mới (hoặc để trống để quay về mặc định):', bgImage);
    if (newUrl !== null && newUrl.trim() !== '') {
      const url = newUrl.trim();
      setBgImage(url);
      localStorage.setItem('loginBgImage', url);
      await saveBgImageToDb(url);
    } else if (newUrl === '') {
      // Reset to default if empty
      const defaultImg = 'https://images.unsplash.com/photo-1552089123-2d26226fc2b7?auto=format&fit=crop&w=1200&q=80';
      setBgImage(defaultImg);
      localStorage.removeItem('loginBgImage');
      await saveBgImageToDb(defaultImg);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert('File quá lớn! Vui lòng chọn file dưới 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setBgImage(base64);
        localStorage.setItem('loginBgImage', base64);
        await saveBgImageToDb(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden pb-24">
      {/* Background pattern similar to the original if needed, but we'll keep it simple gray */}
      
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300 relative z-10">
        
        {/* Header Section */}
        <div className="relative h-32 sm:h-40 flex items-center justify-center border-b-[3px] border-gray-300 overflow-hidden group">
          {/* Background Image - Hoa Ban Dien Bien */}
          <div 
            className="absolute inset-0 w-full h-full" 
            style={{ 
              backgroundImage: `url('${bgImage}')`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center 30%',
            }}
          ></div>
          
          {/* Gradient overlay to match the original warm tone */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#fff8e1]/80 via-[#ffe082]/60 to-transparent"></div>
          
          {/* Text */}
          <div className="relative z-10 text-center flex flex-col items-center justify-center w-full px-4">
            <h2 className="text-lg sm:text-xl font-bold text-[#8B4513] uppercase tracking-wide" style={{ textShadow: '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff, 2px 2px 4px rgba(0,0,0,0.3)' }}>
              Hệ thống quản lý nội trú
            </h2>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#8B4513] uppercase tracking-wider mt-1" style={{ textShadow: '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff, 2px 2px 4px rgba(0,0,0,0.3)' }}>
              Sổ Chấm Cơm
            </h1>
          </div>

          {/* Config Image Button for specific user */}
          {email === 'vuhung@db.edu.vn' && (
            <div className="absolute top-2 right-2 z-20 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/80 hover:bg-white p-2 rounded-full shadow-md text-gray-700 transition-all opacity-50 hover:opacity-100"
                title="Tải ảnh lên từ máy tính"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleConfigImage}
                className="bg-white/80 hover:bg-white p-2 rounded-full shadow-md text-gray-700 transition-all opacity-50 hover:opacity-100"
                title="Nhập URL hình ảnh nền"
              >
                <Settings className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          )}
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

          <form className="space-y-4 max-w-md mx-auto relative z-10" onSubmit={isRegisterMode ? handleSignUp : handleLogin}>
            {isRegisterMode && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label htmlFor="full-name" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">Họ và tên:</label>
                  <div className="w-full sm:w-2/3">
                    <input
                      id="full-name"
                      name="fullName"
                      type="text"
                      required={isRegisterMode}
                      className="w-full border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label htmlFor="phone-number" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">Số điện thoại:</label>
                  <div className="w-full sm:w-2/3">
                    <input
                      id="phone-number"
                      name="phoneNumber"
                      type="tel"
                      required={isRegisterMode}
                      className="w-full border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="VD: 0984246993"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label htmlFor="license-key" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">Mã bản quyền:</label>
                  <div className="w-full sm:w-2/3">
                    <input
                      id="license-key"
                      name="licenseKey"
                      type="text"
                      required={isRegisterMode}
                      className="w-full border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none uppercase"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      placeholder="VD: SL-XXXX-XXXX"
                    />
                  </div>
                </div>
              </>
            )}

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

            <div className="flex flex-col sm:flex-row sm:items-center mt-2">
              <label htmlFor="captcha" className="w-full sm:w-1/3 text-left sm:text-right pr-4 text-sm text-black mb-1 sm:mb-0 font-medium sm:font-normal">
                Xác nhận ({captchaQuestion} = ?):
              </label>
              <div className="w-full sm:w-2/3 flex items-center gap-2">
                <input
                  id="captcha"
                  type="text"
                  required
                  className="w-20 border border-gray-400 px-3 py-2 sm:px-2 sm:py-1.5 focus:outline-none focus:border-blue-500 text-sm bg-white rounded-md sm:rounded-none"
                  value={userCaptchaInput}
                  onChange={(e) => setUserCaptchaInput(e.target.value)}
                  placeholder="Kết quả"
                />
                <button 
                  type="button" 
                  onClick={generateCaptcha}
                  className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                >
                  Đổi mã
                </button>
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

            {successMsg && (
              <div className="flex flex-col sm:flex-row sm:items-center mt-2">
                <div className="hidden sm:block sm:w-1/3"></div>
                <div className="w-full sm:w-2/3 text-emerald-600 text-xs font-medium">
                  {successMsg}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center mt-6 pt-4">
              <div className="hidden sm:block sm:w-1/3"></div>
              <div className="w-full sm:w-2/3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                {isRegisterMode ? (
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                    >
                      {loading ? 'Đang xử lý...' : 'Đăng ký'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(false);
                        setError(null);
                        generateCaptcha();
                      }} 
                      disabled={loading}
                      className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                    >
                      Quay lại
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto bg-[#A0522D] hover:bg-[#8B4513] text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                    >
                      {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(true);
                        setError(null);
                        setSuccessMsg(null);
                        generateCaptcha();
                      }} 
                      disabled={loading}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-1.5 px-6 shadow-md transition-colors text-sm rounded-md sm:rounded-none"
                    >
                      Đăng ký
                    </button>
                  </>
                )}
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
