import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Plus, Trash2, Copy, Check, ArrowLeft, Info, Image as ImageIcon, Save } from 'lucide-react';

export default function Admin({ onBack }: { onBack: () => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyDuration, setNewKeyDuration] = useState(365);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState('');
  const [savingFavicon, setSavingFavicon] = useState(false);

  useEffect(() => {
    fetchKeys();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'global_favicon')
      .single();
    
    if (data) {
      setFaviconUrl(data.setting_value);
    }
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

  const getExpirationDate = (usedAt: string | null, duration: number) => {
    if (!usedAt) return '-';
    const date = new Date(usedAt);
    date.setDate(date.getDate() + (duration || 365));
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="w-full mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-6 h-6 text-indigo-600" />
              Quản lý Mã Bản Quyền
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
        </div>

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
                      <button
                        onClick={() => deleteKey(k.id, k.is_used, k.used_by_email)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title={k.is_used ? "Thu hồi mã" : "Xóa mã"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
