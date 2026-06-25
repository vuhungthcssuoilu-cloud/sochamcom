import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Upload } from 'lucide-react';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<{ duration: number, text: string } | null>(null);
  const [checkingLicense, setCheckingLicense] = useState(false);
  const [email, setEmail] = useState('');

  // Check license key when it changes
  useEffect(() => {
    const checkKey = async () => {
      if (licenseKey.length < 5) {
        setLicenseInfo(null);
        return;
      }
      
      setCheckingLicense(true);
      try {
        const { data, error } = await supabase.rpc('check_license_key_status', {
          key_text: licenseKey.toUpperCase()
        });
        
        if (!error && data) {
          if (data.valid) {
            setLicenseInfo({ 
              duration: data.duration_days, 
              text: data.message 
            });
          } else {
            setLicenseInfo({ duration: 0, text: data.message });
          }
        } else {
          setLicenseInfo({ duration: 0, text: 'Mã không hợp lệ' });
        }
      } catch (e) {
        setLicenseInfo(null);
      } finally {
        setCheckingLicense(false);
      }
    };

    const timeoutId = setTimeout(checkKey, 500);
    return () => clearTimeout(timeoutId);
  }, [licenseKey]);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // UI Config state
  const [uiConfigs, setUiConfigs] = useState({
    school_name: 'TRƯỜNG PTDTBT TH VÀ THCS SUỐI LƯ',
    header_title: 'HỆ THỐNG QUẢN LÝ NỘI TRÚ - SỔ CHẤM CƠM',
    school_year: 'NĂM HỌC 2026 - 2027',
    footer_line1: '',
    footer_line2: 'Mọi thắc mắc về phần mềm xin liên hệ quản trị viên',
    footer_line3: 'Application developed by: Vũ Hùng - Email: vuhung@db.edu.vn'
  });

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value');
        
        if (data) {
          setUiConfigs(prev => {
            const newConfigs = { ...prev };
            let hasChanges = false;
            
            data.forEach((d: any) => {
              if (Object.keys(newConfigs).includes(d.setting_key)) {
                (newConfigs as any)[d.setting_key] = d.setting_value;
                hasChanges = true;
              }
            });
            
            return hasChanges ? newConfigs : prev;
          });
        }
      } catch (err) {
        console.error('Error fetching UI configs:', err);
      }
    };
    
    fetchConfigs();
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

    // Clear any stale session data before attempting to log in
    await supabase.auth.signOut().catch(() => {});
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase.auth.token') || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        localStorage.removeItem(key);
      }
    });

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

    // Clear any stale session data before attempting to sign up
    await supabase.auth.signOut().catch(() => {});
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase.auth.token') || (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        localStorage.removeItem(key);
      }
    });

    // Format phone number to E.164 format (+84...)
    const formattedPhone = '+84' + phoneNumber.substring(1);

    // Check license duration before signup to show message
    let durationText = '1 năm (Bản quyền)';
    try {
      const { data: keyData, error: keyError } = await supabase.rpc('check_license_key_status', {
        key_text: licenseKey.toUpperCase()
      });
      
      if (!keyError && keyData && keyData.valid) {
        durationText = keyData.duration_days === 30 ? '30 ngày (Dùng thử)' : '1 năm (Bản quyền)';
      }
    } catch (e) {
      // Ignore error here, let the trigger handle validation
    }

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
      setSuccessMsg(`Đăng ký thành công! Thời hạn sử dụng: ${durationText}. Vui lòng đăng nhập.`);
      setIsRegisterMode(false);
      setPassword('');
      setUserCaptchaInput('');
      setPhoneNumber('');
      setLicenseKey('');
      generateCaptcha();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: '#eef6fc', backgroundImage: 'radial-gradient(#c6dced 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      {/* Header */}
      <header className="bg-[#0b5394] text-white text-center py-3 px-4">
        <h2 className="text-sm font-semibold uppercase mb-0.5">{uiConfigs.school_name}</h2>
        <h1 className="text-xl font-bold uppercase mb-1 tracking-wide">{uiConfigs.header_title}</h1>
        <div className="bg-[#cc0000] text-white inline-block px-3 py-0.5 text-xs font-bold shadow-sm">{uiConfigs.school_year}</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
          {/* Top Blue Border */}
          <div className="h-1.5 bg-[#0b5394] w-full"></div>
          
          <div className="p-5 sm:p-6">
            <h3 className="text-lg text-[#0b5394] font-bold mb-3 pb-2 border-b border-gray-100 text-center sm:text-left">
              {isRegisterMode ? 'Đăng ký tài khoản' : 'Nhập thông tin đăng nhập'}
            </h3>
            
            <form className="space-y-3" onSubmit={isRegisterMode ? handleSignUp : handleLogin}>
              {isRegisterMode && (
                <>
                  <div className="flex flex-col">
                    <label htmlFor="full-name" className="text-sm text-gray-700 font-medium mb-1">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="full-name"
                      name="fullName"
                      type="text"
                      required={isRegisterMode}
                      className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                  
                  <div className="flex flex-col">
                    <label htmlFor="phone-number" className="text-sm text-gray-700 font-medium mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="phone-number"
                      name="phoneNumber"
                      type="tel"
                      required={isRegisterMode}
                      className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="VD: 0984246993"
                    />
                  </div>
                  
                  <div className="flex flex-col">
                    <label htmlFor="license-key" className="text-sm text-gray-700 font-medium mb-1">
                      Mã bản quyền <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="license-key"
                      name="licenseKey"
                      type="text"
                      required={isRegisterMode}
                      className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors uppercase"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      placeholder="VD: SL-XXXX-XXXX"
                    />
                    {checkingLicense ? (
                      <p className="text-xs text-gray-500 mt-1">Đang kiểm tra mã...</p>
                    ) : licenseInfo ? (
                      <p className={`text-xs mt-1 font-medium ${licenseInfo.duration > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {licenseInfo.text}
                      </p>
                    ) : null}
                  </div>
                </>
              )}

              <div className="flex flex-col">
                <label htmlFor="email-address" className="text-sm text-gray-700 font-medium mb-1">
                  Tài khoản Gmail <span className="text-red-500">*</span>
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email của bạn"
                />
              </div>
              
              <div className="flex flex-col">
                <label htmlFor="password" className="text-sm text-gray-700 font-medium mb-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                />
              </div>

              {!isRegisterMode && (
                <div className="flex items-center">
                  <input type="checkbox" id="remember" className="mr-2 cursor-pointer w-4 h-4 text-[#0b5394] focus:ring-[#0b5394] border-gray-300 rounded" />
                  <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer select-none">Nhớ mật khẩu</label>
                </div>
              )}

              <div className="flex flex-col">
                <label htmlFor="captcha" className="text-sm text-gray-700 font-medium mb-1 flex items-center justify-between">
                  <span>Mã xác nhận ({captchaQuestion} = ?) <span className="text-red-500">*</span></span>
                  <button 
                    type="button" 
                    onClick={generateCaptcha}
                    className="text-xs text-[#0b5394] hover:text-blue-800 hover:underline"
                    tabIndex={-1}
                  >
                    Đổi mã
                  </button>
                </label>
                <input
                  id="captcha"
                  type="text"
                  required
                  className="w-full border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-[#0b5394] focus:ring-1 focus:ring-[#0b5394] rounded text-sm transition-colors"
                  value={userCaptchaInput}
                  onChange={(e) => setUserCaptchaInput(e.target.value)}
                  placeholder="Nhập kết quả phép tính"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm font-medium p-3 bg-red-50 rounded border border-red-100">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="text-emerald-700 text-sm font-medium p-3 bg-emerald-50 rounded border border-emerald-100">
                  {successMsg}
                </div>
              )}
              
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0b5394] hover:bg-[#094074] text-white font-bold py-2 px-4 rounded shadow transition-colors text-sm"
                >
                  {loading ? 'Đang xử lý...' : (isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập')}
                </button>
                
                <div className="mt-2 text-center">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      setError(null);
                      setSuccessMsg(null);
                      generateCaptcha();
                    }} 
                    disabled={loading}
                    className="text-sm text-[#0b5394] hover:text-[#094074] hover:underline font-medium"
                  >
                    {isRegisterMode ? 'Đã có tài khoản? Quay lại đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-[#0b5394] text-white text-center py-3 px-4 border-t border-[#094074]">
        <p className="font-bold text-sm sm:text-base mb-1 uppercase">{uiConfigs.footer_line1}</p>
        <p className="text-xs sm:text-sm mb-0.5 text-blue-100">{uiConfigs.footer_line2}</p>
        <p className="text-[11px] sm:text-xs text-blue-200">{uiConfigs.footer_line3}</p>
      </footer>
    </div>
  );
}

