import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Key, Plus, Trash2, Copy, Check, ArrowLeft, Info, Image as ImageIcon, 
  Save, Lock, RefreshCw, History, User as UserIcon, Calendar, Settings,
  Eye, EyeOff, X, AlertTriangle, ExternalLink, Code, Wrench
} from 'lucide-react';

const SQL_FIX_SCRIPT = `-- ========================================================
-- CÂU LỆNH SỬA LỖI ĐẶT LẠI MẬT KHẨU (PGRST203) TRONG SUPABASE
-- Xóa 2 phiên bản cũ bị trùng chữ ký hàm và tạo lại chuẩn xác
-- ========================================================

DROP FUNCTION IF EXISTS public.admin_reset_user_password(text, text);
DROP FUNCTION IF EXISTS public.admin_reset_user_password(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_password text)
RETURNS json AS $$
BEGIN
  -- Kiểm tra quyền Admin
  IF auth.jwt() ->> 'email' NOT IN ('vuhung@db.edu.vn', 'vuhungthcssuoilu@gmail.com') THEN
    RETURN json_build_object('success', false, 'message', 'Bạn không có quyền thực hiện hành động này.');
  END IF;

  -- Cập nhật mật khẩu mới trong auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Đã đặt lại mật khẩu thành công.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

export default function Admin({ onBack, onViewSheet }: { onBack: () => void; onViewSheet?: (userId: string, year: number, month: number, className: string) => void }) {
  const [activeTab, setActiveTab] = useState<'keys' | 'history' | 'classes'>('keys');
  const [keys, setKeys] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newKeyDuration, setNewKeyDuration] = useState(365);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState('');
  const [savingFavicon, setSavingFavicon] = useState(false);
  const [savingUiConfigs, setSavingUiConfigs] = useState(false);
  
  // classes state
  const [teachersList, setTeachersList] = useState<{ userId: string; email: string; classes: { className: string; teacherName: string }[] }[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [editingClasses, setEditingClasses] = useState<{ className: string; teacherName: string }[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);
  const [teacherSavedSheets, setTeacherSavedSheets] = useState<any[]>([]);
  const [loadingTeacherSheets, setLoadingTeacherSheets] = useState(false);

  // Reset password and SQL fix modal state
  const [resetModalUser, setResetModalUser] = useState<{ id: string; email: string } | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resettingLoading, setResettingLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [showSqlFixModal, setShowSqlFixModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (selectedTeacherId) {
      const fetchSheets = async () => {
        setLoadingTeacherSheets(true);
        const { data, error } = await supabase
          .from('monthly_sheets')
          .select('month, year, class_name, students, updated_at')
          .eq('user_id', selectedTeacherId)
          .order('updated_at', { ascending: false });
        
        if (!error && data) {
          setTeacherSavedSheets(data);
        }
        setLoadingTeacherSheets(false);
      };
      fetchSheets();
    } else {
      setTeacherSavedSheets([]);
    }
  }, [selectedTeacherId]);

  // UI Configs
  const [uiConfigs, setUiConfigs] = useState({
    school_name: 'TRƯỜNG PTDTBT TH VÀ THCS SUỐI LƯ',
    header_title: 'HỆ THỐNG QUẢN LÝ NỘI TRÚ - SỔ CHẤM CƠM',
    school_year: 'NĂM HỌC 2024 - 2025',
    footer_line1: 'DỮ LIỆU CHÍNH THỨC TỪ TRƯỜNG PTDTBT TH VÀ THCS SUỐI LƯ',
    footer_line2: 'Mọi thắc mắc về phần mềm xin liên hệ quản trị viên',
    footer_line3: 'Application developed by: Vũ Hùng - Email: vuhung@db.edu.vn - SĐT: 0984.246.993',
    global_signing_location: 'Suối Lư'
  });

  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
    fetchSettings();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (keys.length > 0) {
      fetchAllClassesConfig();
    }
  }, [keys]);

  const fetchAllClassesConfig = async () => {
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .like('setting_key', '%_classes_config');
      
      if (error) {
        console.warn('Could not fetch classes configs:', error.message);
        return;
      }

      const usersMap: { [key: string]: string } = {};
      keys.forEach(k => {
        if (k.is_used && k.used_by && k.used_by_email) {
          usersMap[k.used_by] = k.used_by_email;
        }
      });

      const parsedTeachers: { userId: string; email: string; classes: { className: string; teacherName: string }[] }[] = [];
      
      if (data) {
        data.forEach((row: any) => {
          const userId = row.setting_key.replace('_classes_config', '');
          const email = usersMap[userId] || `Giáo viên (${userId.substring(0, 8)})`;
          let classes: { className: string; teacherName: string }[] = [];
          try {
            classes = JSON.parse(row.setting_value);
          } catch (e) {
            console.error('Error parsing classes JSON:', e);
          }
          parsedTeachers.push({ userId, email, classes });
        });
      }

      // Add users from keys that don't have classes config yet
      Object.entries(usersMap).forEach(([userId, email]) => {
        if (!parsedTeachers.some(t => t.userId === userId)) {
          parsedTeachers.push({ userId, email, classes: [] });
        }
      });

      // Sort by email
      parsedTeachers.sort((a, b) => a.email.localeCompare(b.email));

      setTeachersList(parsedTeachers);
      
      if (parsedTeachers.length > 0) {
        // If there's an existing selectedTeacherId, try to find and update its classes, otherwise select first
        const currentId = selectedTeacherId || parsedTeachers[0].userId;
        const found = parsedTeachers.find(t => t.userId === currentId);
        if (found) {
          setSelectedTeacherId(currentId);
          setEditingClasses(found.classes);
        } else {
          setSelectedTeacherId(parsedTeachers[0].userId);
          setEditingClasses(parsedTeachers[0].classes);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const teacher = teachersList.find(t => t.userId === teacherId);
    if (teacher) {
      setEditingClasses(teacher.classes || []);
    }
  };

  const handleSaveTeacherClasses = async () => {
    if (!selectedTeacherId) return;
    
    const filtered = editingClasses
      .map(c => ({
        className: c.className.trim().toUpperCase(),
        teacherName: c.teacherName.trim()
      }))
      .filter(c => c.className !== '');

    if (filtered.length === 0) {
      if (!confirm('Danh sách lớp đang trống. Bạn có chắc chắn muốn xóa hết cấu hình lớp của tài khoản này?')) {
        return;
      }
    }

    setSavingClasses(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: `${selectedTeacherId}_classes_config`,
          setting_value: JSON.stringify(filtered),
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) {
        alert('Lỗi khi lưu cấu hình lớp: ' + error.message);
      } else {
        alert('Đã cập nhật danh sách lớp học thành công!');
        // Reload settings
        await fetchKeys();
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setSavingClasses(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .order('access_time', { ascending: false })
      .limit(200);
    
    if (data) setLogs(data);
    setLoadingLogs(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value');
    
    if (data) {
      const faviconObj = data.find((d: any) => d.setting_key === 'global_favicon');
      if (faviconObj) setFaviconUrl(faviconObj.setting_value);
      
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
  };

  const saveUiConfigs = async () => {
    setSavingUiConfigs(true);
    
    const updates = Object.entries(uiConfigs).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('app_settings')
      .upsert(updates, { onConflict: 'setting_key' });
      
    if (error) {
      alert('Lỗi lưu Cấu hình giao diện: ' + error.message);
    } else {
      alert('Đã cập nhật Cấu hình giao diện thành công!');
    }
    
    setSavingUiConfigs(false);
  };

  const saveFavicon = async () => {
    setSavingFavicon(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        setting_key: 'global_favicon',
        setting_value: faviconUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    
    if (error) {
      alert('Lỗi lưu Favicon: ' + error.message);
    } else {
      // Update the favicon in real-time for the admin too
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = faviconUrl;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = faviconUrl;
        document.head.appendChild(newLink);
      }
      alert('Đã cập nhật Favicon thành công!');
    }
    setSavingFavicon(false);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      alert('Dung lượng ảnh quá lớn (vui lòng chọn ảnh dưới 200KB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFaviconUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchKeys = async () => {
    const { data, error } = await supabase
      .from('license_keys')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setKeys(data);
    setLoading(false);
  };

  const generateKey = async () => {
    setGenerating(true);
    const newKey = 'SL-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const { error } = await supabase
      .from('license_keys')
      .insert([{ key: newKey, duration_days: newKeyDuration }]);
      
    if (!error) {
      fetchKeys();
    } else {
      alert('Lỗi tạo mã: ' + error.message);
    }
    setGenerating(false);
  };

  const deleteKey = async (id: string, isUsed: boolean, email: string | null) => {
    const msg = isUsed 
      ? `CẢNH BÁO: Mã này đang được sử dụng bởi ${email || 'một người dùng'}. Nếu xóa, người này sẽ bị thu hồi quyền truy cập ngay lập tức. Bạn có chắc chắn muốn xóa?`
      : 'Xóa mã bản quyền này?';
      
    if (!confirm(msg)) return;
    await supabase.from('license_keys').delete().eq('id', id);
    fetchKeys();
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openResetPasswordModal = (userId: string, email: string) => {
    setResetModalUser({ id: userId, email });
    setNewPasswordVal('');
    setShowPassword(false);
    setResetError(null);
    setResetSuccess(null);
  };

  const handleExecuteResetPassword = async () => {
    if (!resetModalUser) return;
    if (!newPasswordVal || newPasswordVal.length < 6) {
      setResetError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setResettingLoading(true);
    setResetError(null);
    setResetSuccess(null);
    setResettingPassword(resetModalUser.id);

    try {
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: resetModalUser.id,
        new_password: newPasswordVal
      });

      if (error) {
        if (
          error.code === 'PGRST203' || 
          error.message?.includes('Could not choose the best candidate function') ||
          error.message?.includes('overloading')
        ) {
          setShowSqlFixModal(true);
          setResetError('Cơ sở dữ liệu Supabase đang bị trùng lặp 2 hàm (lỗi PGRST203). Vui lòng chạy lệnh SQL trong bảng hướng dẫn vừa mở để khắc phục.');
        } else {
          setResetError('Lỗi đặt lại mật khẩu: ' + error.message);
        }
      } else if (data && !data.success) {
        setResetError(data.message || 'Không thể đặt lại mật khẩu.');
      } else {
        setResetSuccess(`Đã đặt lại mật khẩu thành công cho ${resetModalUser.email}!`);
      }
    } catch (e: any) {
      setResetError('Lỗi hệ thống: ' + (e.message || e));
    } finally {
      setResettingLoading(false);
      setResettingPassword(null);
    }
  };

  const getExpirationDate = (usedAt: string | null, duration: number) => {
    if (!usedAt) return '-';
    const date = new Date(usedAt);
    date.setDate(date.getDate() + (duration || 365));
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="w-full mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {activeTab === 'keys' ? (
                  <>
                    <Key className="w-6 h-6 text-indigo-600" />
                    Quản lý Mã Bản Quyền
                  </>
                ) : activeTab === 'history' ? (
                  <>
                    <History className="w-6 h-6 text-indigo-600" />
                    Lịch sử Truy cập
                  </>
                ) : (
                  <>
                    <Settings className="w-6 h-6 text-indigo-600" />
                    Quản lý Danh sách Lớp học
                  </>
                )}
              </h1>
              <div className="flex gap-4 mt-2">
                <button 
                  onClick={() => setActiveTab('keys')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'keys' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Mã bản quyền
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Lịch sử truy cập
                </button>
                <button 
                  onClick={() => setActiveTab('classes')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'classes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Quản lý lớp học
                </button>
              </div>
            </div>
          </div>
          {activeTab === 'keys' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSqlFixModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-sm"
                title="Hướng dẫn sửa lỗi đặt lại mật khẩu trong Supabase SQL Editor"
              >
                <Wrench className="w-4 h-4 text-amber-600" />
                Sửa lỗi Reset MK (SQL)
              </button>
              <div className="flex items-center bg-white border border-gray-300 rounded-lg p-1">
                <button 
                  onClick={() => setNewKeyDuration(365)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${newKeyDuration === 365 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Bản quyền (1 năm)
                </button>
                <button 
                  onClick={() => setNewKeyDuration(30)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${newKeyDuration === 30 ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Dùng thử (30 ngày)
                </button>
              </div>
              <button
                onClick={generateKey}
                disabled={generating}
                className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${newKeyDuration === 30 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                <Plus className="w-5 h-5" />
                {generating ? 'Đang tạo...' : 'Tạo mã mới'}
              </button>
            </div>
          )}
          {activeTab === 'history' && (
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          )}
        </div>

        {activeTab === 'keys' ? (
          <>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Lưu ý về mã bản quyền:</p>
                <p className="text-sm mt-1">Mỗi mã bản quyền chỉ được sử dụng <strong>1 lần duy nhất</strong> cho 1 máy hoặc 1 tài khoản đăng ký. Thời hạn sử dụng tùy thuộc vào loại mã (30 ngày đối với bản dùng thử hoặc 1 năm đối với bản quyền chính thức) kể từ ngày kích hoạt.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                Cấu hình Favicon (Biểu tượng trang web)
              </h2>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh hoặc Tải lên ảnh (Base64)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={faviconUrl}
                      onChange={(e) => setFaviconUrl(e.target.value)}
                      placeholder="https://example.com/favicon.ico"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 transition-colors flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Tải lên
                      <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="w-12 h-12 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <button
                  onClick={saveFavicon}
                  disabled={savingFavicon}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingFavicon ? 'Đang lưu...' : 'Lưu Favicon'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                * Favicon sẽ được áp dụng cho toàn bộ hệ thống. Nên sử dụng ảnh vuông (1:1), định dạng .ico, .png hoặc .svg.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Cấu hình Tiêu đề & Chân trang (Trang đăng nhập)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên trường (Header)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.school_name}
                    onChange={(e) => setUiConfigs({...uiConfigs, school_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề chính (Header)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.header_title}
                    onChange={(e) => setUiConfigs({...uiConfigs, header_title: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Năm học (Header)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.school_year}
                    onChange={(e) => setUiConfigs({...uiConfigs, school_year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dòng 1 (Footer)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.footer_line1}
                    onChange={(e) => setUiConfigs({...uiConfigs, footer_line1: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dòng 2 (Footer)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.footer_line2}
                    onChange={(e) => setUiConfigs({...uiConfigs, footer_line2: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dòng 3 (Footer)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.footer_line3}
                    onChange={(e) => setUiConfigs({...uiConfigs, footer_line3: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-700 mb-1 font-bold">Địa danh ngày ký mặc định (GVCN ở dưới)</label>
                  <input 
                    type="text" 
                    value={uiConfigs.global_signing_location || ''}
                    onChange={(e) => setUiConfigs({...uiConfigs, global_signing_location: e.target.value})}
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase font-semibold"
                    placeholder="Ví dụ: SUỐI LƯ"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveUiConfigs}
                  disabled={savingUiConfigs}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingUiConfigs ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 font-semibold text-gray-600">Mã bản quyền</th>
                    <th className="p-4 font-semibold text-gray-600">Loại mã</th>
                    <th className="p-4 font-semibold text-gray-600">Trạng thái</th>
                    <th className="p-4 font-semibold text-gray-600">Người sử dụng</th>
                    <th className="p-4 font-semibold text-gray-600">Ngày tạo</th>
                    <th className="p-4 font-semibold text-gray-600">Ngày hết hạn</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                    </tr>
                  ) : keys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">Chưa có mã bản quyền nào.</td>
                    </tr>
                  ) : (
                    keys.map((k) => (
                      <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <code className={`px-2 py-1 rounded font-mono font-bold ${k.duration_days === 30 ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-indigo-700'}`}>
                              {k.key}
                            </code>
                            <button
                              onClick={() => copyToClipboard(k.key, k.id)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Sao chép"
                            >
                              {copiedId === k.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          {k.duration_days === 30 ? (
                            <span className="text-xs font-bold text-orange-600">Dùng thử (30 ngày)</span>
                          ) : (
                            <span className="text-xs font-bold text-indigo-600">Bản quyền (1 năm)</span>
                          )}
                        </td>
                        <td className="p-4">
                          {k.is_used ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Đã sử dụng
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Chưa sử dụng
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {k.used_by_email || '-'}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {new Date(k.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-4 text-sm text-gray-500 font-medium">
                          {getExpirationDate(k.used_at, k.duration_days)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {k.is_used && k.used_by && (
                              <button
                                onClick={() => openResetPasswordModal(k.used_by, k.used_by_email)}
                                disabled={resettingPassword === k.used_by}
                                className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                                title="Đặt lại mật khẩu"
                              >
                                {resettingPassword === k.used_by ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                              </button>
                            )}
                            <button
                              onClick={() => deleteKey(k.id, k.is_used, k.used_by_email)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title={k.is_used ? "Thu hồi mã" : "Xóa mã"}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'history' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-semibold text-gray-600">Người dùng</th>
                  <th className="p-4 font-semibold text-gray-600">Thời gian truy cập</th>
                  <th className="p-4 font-semibold text-gray-600">Địa chỉ IP</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">Đang tải lịch sử...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">Chưa có dữ liệu truy cập.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{log.email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(log.access_time).toLocaleString('vi-VN')}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-500 font-mono">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left side: Teachers List */}
              <div className="w-full md:w-1/3 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-600" />
                  Danh sách giáo viên ({teachersList.length})
                </h3>
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {loadingClasses ? (
                    <div className="text-center py-8 text-gray-500 text-sm">Đang tải danh sách...</div>
                  ) : teachersList.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">Chưa có tài khoản nào.</div>
                  ) : (
                    teachersList.map((t) => (
                      <button
                        key={t.userId}
                        onClick={() => handleTeacherSelect(t.userId)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between border ${
                          selectedTeacherId === t.userId
                            ? 'bg-indigo-600 border-indigo-600 text-white font-semibold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'
                        }`}
                      >
                        <span className="truncate pr-2">{t.email}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                          selectedTeacherId === t.userId
                            ? 'bg-indigo-700 text-indigo-100'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {t.classes ? t.classes.length : 0} lớp
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right side: Classes Config Table */}
              <div className="flex-1 border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                {selectedTeacherId ? (
                  <div>
                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                      <div>
                        <h3 className="font-bold text-indigo-900 text-lg">
                          Cấu hình lớp học của:
                        </h3>
                        <p className="text-sm font-medium text-gray-500 truncate mt-0.5">
                          {teachersList.find(t => t.userId === selectedTeacherId)?.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingClasses([...editingClasses, { className: '', teacherName: '' }]);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-lg transition-colors text-xs font-bold border border-indigo-200 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm lớp mới
                      </button>
                    </div>

                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4 text-xs text-indigo-800 leading-relaxed">
                      Tại đây người quản trị có thể trực tiếp thêm, sửa hoặc xóa các lớp học và phân công Giáo viên chủ nhiệm cho tài khoản này. Nhớ bấm nút <strong>Lưu cấu hình lớp</strong> để áp dụng thay đổi.
                    </div>

                    <div className="max-h-[350px] overflow-y-auto mb-4 border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700 font-bold sticky top-0 border-b">
                          <tr>
                            <th className="p-3 text-left w-1/3">Tên lớp</th>
                            <th className="p-3 text-left">Giáo viên chủ nhiệm</th>
                            <th className="p-3 text-center w-16">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {editingClasses.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-400">
                                Chưa cấu hình lớp học nào. Hãy bấm "Thêm lớp mới" ở trên.
                              </td>
                            </tr>
                          ) : (
                            editingClasses.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50/50">
                                <td className="p-2">
                                  <input 
                                    type="text"
                                    value={item.className}
                                    onChange={(e) => {
                                      const newCfg = [...editingClasses];
                                      newCfg[index].className = e.target.value.toUpperCase();
                                      setEditingClasses(newCfg);
                                    }}
                                    placeholder="VD: 6A"
                                    className="w-full border border-gray-300 rounded px-3 py-1.5 uppercase font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2">
                                  <input 
                                    type="text"
                                    value={item.teacherName}
                                    onChange={(e) => {
                                      const newCfg = [...editingClasses];
                                      newCfg[index].teacherName = e.target.value;
                                      setEditingClasses(newCfg);
                                    }}
                                    placeholder="VD: Nguyễn Văn A"
                                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button 
                                    onClick={() => {
                                      const newCfg = editingClasses.filter((_, i) => i !== index);
                                      setEditingClasses(newCfg);
                                    }}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title="Xóa lớp này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-100">
                      <button
                        onClick={handleSaveTeacherClasses}
                        disabled={savingClasses}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm flex items-center gap-2 shadow disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {savingClasses ? 'Đang lưu...' : 'Lưu cấu hình lớp'}
                      </button>
                    </div>

                    <div className="mt-8 border-t border-gray-200 pt-6">
                      <h3 className="font-bold text-indigo-900 text-lg mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Các bảng chấm cơm đã lưu
                      </h3>
                      
                      {loadingTeacherSheets ? (
                        <div className="text-center py-4 text-gray-500 text-sm">Đang tải dữ liệu...</div>
                      ) : teacherSavedSheets.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500 text-sm border border-gray-100">
                          Giáo viên này chưa lưu bảng chấm cơm nào.
                        </div>
                      ) : (
                        <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-700 font-bold sticky top-0 border-b">
                              <tr>
                                <th className="p-3 text-left">Thời gian</th>
                                <th className="p-3 text-left">Lớp</th>
                                <th className="p-3 text-center">Sĩ số</th>
                                <th className="p-3 text-right">Cập nhật cuối</th>
                                {onViewSheet && <th className="p-3 text-right w-24">Thao tác</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {teacherSavedSheets.map((sheet, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-gray-900">
                                    Tháng {sheet.month + 1} / {sheet.year}
                                  </td>
                                  <td className="p-3 font-bold text-indigo-600">
                                    {sheet.class_name || 'Không rõ'}
                                  </td>
                                  <td className="p-3 text-center text-gray-700 font-medium">
                                    {sheet.students ? sheet.students.length : 0}
                                  </td>
                                  <td className="p-3 text-right text-gray-500 text-xs">
                                    {sheet.updated_at ? new Date(sheet.updated_at).toLocaleString('vi-VN', {
                                      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                                    }) : '-'}
                                  </td>
                                  {onViewSheet && (
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={() => onViewSheet(selectedTeacherId, sheet.year, sheet.month, sheet.class_name || '')}
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                        title="Xem bảng chấm cơm chi tiết"
                                      >
                                        Xem chi tiết
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Settings className="w-12 h-12 text-gray-300 mb-2" />
                    Vui lòng chọn giáo viên ở cột bên trái để bắt đầu quản lý danh sách lớp.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ĐẶT LẠI MẬT KHẨU */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Đặt lại mật khẩu</h3>
                    <p className="text-xs text-gray-500 font-medium">Cập nhật mật khẩu cho tài khoản người dùng</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResetModalUser(null);
                    setResetError(null);
                    setResetSuccess(null);
                    setNewPasswordVal('');
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl mb-4 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Tài khoản đích:</div>
                <div className="text-sm font-bold text-slate-800 break-all">{resetModalUser.email}</div>
              </div>

              {resetSuccess ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                  <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-1">
                    <Check className="w-4 h-4" /> Đặt lại thành công!
                  </div>
                  <p className="text-xs text-green-600 mb-3">{resetSuccess}</p>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-green-200">
                    <span className="text-xs text-gray-500 font-medium">Mật khẩu mới:</span>
                    <code className="text-sm font-bold text-gray-800 flex-1 font-mono">{newPasswordVal}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newPasswordVal);
                        alert('Đã sao chép mật khẩu mới vào bộ nhớ đệm!');
                      }}
                      className="px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold rounded transition-colors"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-700">Mật khẩu mới</label>
                      <button
                        type="button"
                        onClick={() => {
                          const randomPass = 'Gv' + Math.floor(100000 + Math.random() * 900000) + '@';
                          setNewPasswordVal(randomPass);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        Tạo ngẫu nhiên
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPasswordVal}
                        onChange={(e) => setNewPasswordVal(e.target.value)}
                        placeholder="Nhập tối thiểu 6 ký tự..."
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {resetError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        Lỗi đặt lại mật khẩu:
                      </div>
                      <p>{resetError}</p>
                      <button
                        onClick={() => setShowSqlFixModal(true)}
                        className="mt-2.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Xem hướng dẫn sửa lỗi SQL (PGRST203)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setResetModalUser(null);
                    setResetError(null);
                    setResetSuccess(null);
                    setNewPasswordVal('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Đóng
                </button>
                {!resetSuccess && (
                  <button
                    onClick={handleExecuteResetPassword}
                    disabled={resettingLoading || !newPasswordVal || newPasswordVal.length < 6}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {resettingLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Đang cập nhật...
                      </>
                    ) : (
                      'Xác nhận đổi MK'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HƯỚNG DẪN SỬA LỖI SQL (PGRST203) */}
      {showSqlFixModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Khắc phục lỗi Đặt lại mật khẩu (PGRST203)
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      Xóa phiên bản hàm trùng lặp trong Supabase PostgreSQL
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSqlFixModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold mb-1">
                    🔍 <strong>Nguyên nhân lỗi:</strong> Cơ sở dữ liệu Supabase đang tồn tại cùng lúc 2 phiên bản của hàm <code>admin_reset_user_password</code> (một bản nhận kiểu <code>text</code>, một bản nhận <code>uuid</code>).
                  </p>
                  <p>
                    PostgREST không xác định được cần gọi bản nào nên trả về thông báo lỗi: <br />
                    <code className="text-[11px] bg-amber-100/70 px-1 py-0.5 rounded text-amber-950">Could not choose the best candidate function between: public.admin_reset_user_password(text, text), public.admin_reset_user_password(uuid, text)</code>
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-indigo-600" /> Câu lệnh SQL khắc phục (chỉ cần chạy 1 lần):
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(SQL_FIX_SCRIPT);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2500);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                        copiedSql 
                          ? 'bg-green-600 text-white' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedSql ? 'Đã sao chép SQL!' : 'Sao chép câu lệnh SQL'}
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-52 leading-relaxed border border-slate-800">
                    {SQL_FIX_SCRIPT}
                  </pre>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900">Cách thực hiện chỉ mất 10 giây:</div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                    <span>Bấm nút <strong>"Sao chép câu lệnh SQL"</strong> ở phía trên.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                    <span>
                      Bấm nút màu xanh <strong>"Mở Supabase SQL Editor"</strong> bên dưới rồi Dán (Paste) câu lệnh vào.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                    <span>Bấm nút <strong>RUN</strong> trong Supabase. Sau đó quay lại đây đặt lại mật khẩu là hoàn tất!</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100">
                <a
                  href="https://supabase.com/dashboard/project/jzycmjynzkhevuxyjngv/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" /> Mở Supabase SQL Editor
                </a>
                <button
                  onClick={() => setShowSqlFixModal(false)}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
