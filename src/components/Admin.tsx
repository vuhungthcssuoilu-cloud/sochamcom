import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Plus, Trash2, Copy, Check, ArrowLeft, Info } from 'lucide-react';

export default function Admin({ onBack }: { onBack: () => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

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
      .insert([{ key: newKey }]);
      
    if (!error) {
      fetchKeys();
    } else {
      alert('Lỗi tạo mã: ' + error.message);
    }
    setGenerating(false);
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Xóa mã này?')) return;
    await supabase.from('license_keys').delete().eq('id', id);
    fetchKeys();
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getExpirationDate = (usedAt: string | null) => {
    if (!usedAt) return '-';
    const date = new Date(usedAt);
    date.setFullYear(date.getFullYear() + 1);
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
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
          <button
            onClick={generateKey}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {generating ? 'Đang tạo...' : 'Tạo mã mới'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Lưu ý về mã bản quyền:</p>
            <p className="text-sm mt-1">Mỗi mã bản quyền chỉ được sử dụng <strong>1 lần duy nhất</strong> cho 1 máy hoặc 1 tài khoản đăng ký. Thời hạn sử dụng là 1 năm kể từ ngày kích hoạt.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Mã bản quyền</th>
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
                  <td colSpan={6} className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">Chưa có mã bản quyền nào.</td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-indigo-700 font-mono font-bold">
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
                      {getExpirationDate(k.used_at)}
                    </td>
                    <td className="p-4 text-right">
                      {!k.is_used && (
                        <button
                          onClick={() => deleteKey(k.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa mã"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
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
