/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Printer, Save, Plus, Trash2, ChevronLeft, ChevronRight, Download, Upload, LogOut } from 'lucide-react';
import { read, utils } from 'xlsx';
import { supabase } from './lib/supabase';
import Login from './components/Login';

// --- Types ---

type MealType = 'S' | 'T1' | 'T2'; // Sáng, Trưa, Tối

interface MealData {
  [date: number]: {
    S: boolean;
    T1: boolean;
    T2: boolean;
  };
}

interface Student {
  id: string;
  name: string;
  meals: MealData;
}

// --- Constants ---

const MEAL_LABELS: Record<MealType, string> = {
  S: 'S',
  T1: 'T',
  T2: 'T',
};

const DAYS_OF_WEEK = ['CN', '2', '3', '4', '5', '6', '7'];

// --- Helper Functions ---

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getDayOfWeek = (day: number, month: number, year: number) => {
  const date = new Date(year, month, day);
  return DAYS_OF_WEEK[date.getDay()];
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_STUDENTS = [
  "Lò Hải Đăng", "Hạ Thị Dếnh", "Vàng A Dinh", "Vàng A Dình", "Lầu Thị Đùa",
  "Vàng Thị Thuỳ Linh", "Lầu Thị May", "Vàng A Minh", "Lầu Thị Mo", "Vàng Thị Mua(A)",
  "Vàng Thị Mua(B)", "Vàng A Nếnh", "Hạ A Phong", "Chá Thị Sanh", "Chá A Sủa",
  "Lầu Thị Trang", "Lò Thị Vân", "Lò Thị Sen", "Cứ Thị Húa", "Lù Duy Khánh"
].map(name => ({
  id: generateId(),
  name,
  meals: {}
}));

export default function App() {
  // --- State ---
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schoolName, setSchoolName] = useState('TRƯỜNG PTDTBT TH&THCS SUỐI LỪ');
  const [className, setClassName] = useState('8C1');
  const [month, setMonth] = useState(1); // 0-indexed (Feb = 1)
  const [year, setYear] = useState(2026);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [location, setLocation] = useState('Suối Lừ');
  const [teacherName, setTeacherName] = useState('Vũ Văn Hùng');
  const [standardMeals, setStandardMeals] = useState({ S: 14, T1: 14, T2: 12 });
  const [footerDay, setFooterDay] = useState(new Date().getDate());
  const [footerMonth, setFooterMonth] = useState(new Date().getMonth() + 1);
  const [footerYear, setFooterYear] = useState(new Date().getFullYear());
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Computed ---
  const daysInMonth = useMemo(() => getDaysInMonth(month, year), [month, year]);
  
  const firstHalfDays = useMemo(() => {
    const days = [];
    for (let i = 1; i <= 16; i++) days.push(i);
    return days;
  }, []);

  const secondHalfDays = useMemo(() => {
    const days = [];
    for (let i = 17; i <= daysInMonth; i++) {
      if (i <= daysInMonth) days.push(i);
    }
    return days;
  }, [daysInMonth]);

  // --- Auth & Data Fetching ---

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data when user, month, or year changes
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('monthly_sheets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error('Error fetching data:', error);
      }

      if (data) {
        setSchoolName(data.school_name || 'TRƯỜNG PTDTBT TH&THCS SUỐI LỪ');
        setClassName(data.class_name || '8C1');
        setTeacherName(data.teacher_name || 'Vũ Văn Hùng');
        setLocation(data.location || 'Suối Lừ');
        setStudents(data.students || INITIAL_STUDENTS);
        setStandardMeals(data.standard_meals || { S: 14, T1: 14, T2: 12 });
      } else {
        console.log('No data found for this month, starting fresh or keeping current state.');
      }
      setLoading(false);
    };

    fetchData();
  }, [user, month, year]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('monthly_sheets')
      .upsert({
        user_id: user.id,
        month,
        year,
        class_name: className,
        teacher_name: teacherName,
        school_name: schoolName,
        location,
        students,
        standard_meals: standardMeals,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,month,year' });

    if (error) {
      console.error('Error saving data:', error);
      alert('Lỗi khi lưu dữ liệu!');
    } else {
      alert('Đã lưu dữ liệu thành công!');
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // --- Handlers ---

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const toggleMeal = (studentId: string, day: number, meal: MealType) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const currentMeals = s.meals[day] || { S: false, T1: false, T2: false };
      return {
        ...s,
        meals: {
          ...s.meals,
          [day]: {
            ...currentMeals,
            [meal]: !currentMeals[meal]
          }
        }
      };
    }));
  };

  const updateStudentName = (id: string, newName: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const addStudent = () => {
    setStudents(prev => [...prev, { id: generateId(), name: 'Học sinh mới', meals: {} }]);
  };

  const removeStudent = (id: string) => {
    if (confirm('Xóa học sinh này?')) {
      setStudents(prev => prev.filter(s => s.id !== id));
    }
  };

  const calculateStudentTotals = (student: Student) => {
    let sCount = 0;
    let t1Count = 0;
    let t2Count = 0;

    Object.values(student.meals).forEach(dayMeals => {
      if (dayMeals.S) sCount++;
      if (dayMeals.T1) t1Count++;
      if (dayMeals.T2) t2Count++;
    });

    const uS = standardMeals.S - sCount;
    const uT1 = standardMeals.T1 - t1Count;
    const uT2 = standardMeals.T2 - t2Count;

    return { S: sCount, T1: t1Count, T2: t2Count, uS, uT1, uT2 };
  };

  const calculateDayTotals = (day: number, meal: MealType) => {
    return students.reduce((acc, s) => {
      return acc + (s.meals[day]?.[meal] ? 1 : 0);
    }, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Assuming names are in the second column (index 1) if there's a header, 
      // or try to find a column that looks like names.
      // For simplicity, let's assume the first column contains names if it's a simple list,
      // or look for a header "Họ và tên".
      
      let nameColIndex = 0;
      let startRow = 0;

      // Simple heuristic to find header row
      for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
        const row = jsonData[i];
        const nameIdx = row.findIndex((cell: any) => 
          typeof cell === 'string' && 
          (cell.toLowerCase().includes('họ và tên') || cell.toLowerCase().includes('họ tên'))
        );
        if (nameIdx !== -1) {
          nameColIndex = nameIdx;
          startRow = i + 1;
          break;
        }
      }

      const newStudents: Student[] = [];
      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row[nameColIndex]) {
          newStudents.push({
            id: generateId(),
            name: String(row[nameColIndex]).trim(),
            meals: {}
          });
        }
      }

      if (newStudents.length > 0) {
        if (confirm(`Tìm thấy ${newStudents.length} học sinh. Bạn có muốn thay thế danh sách hiện tại không?`)) {
          setStudents(newStudents);
        }
      } else {
        alert('Không tìm thấy danh sách học sinh hợp lệ trong file.');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Lỗi khi đọc file Excel. Vui lòng thử lại.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // --- Render Helpers ---

  const renderTableHalf = (days: number[], isSecondHalf: boolean) => (
    <div className="bg-white relative">
      <table className="w-full border-collapse text-[7px] leading-none border-[0.5px] border-black">
        <thead>
          {/* Header Row 1: Title */}
          <tr>
            <th colSpan={days.length * 3 + 2 + (isSecondHalf ? 6 : 0)} className="border-[0.5px] border-black p-1 text-center font-bold uppercase text-[9px]">
              SỔ CHẤM CƠM LỚP: 
              <input 
                type="text" 
                value={className} 
                onChange={(e) => setClassName(e.target.value)}
                className="font-bold text-[9px] uppercase border-none focus:ring-0 p-0 w-8 text-center bg-transparent inline-block mx-1"
              />
               THÁNG {month + 1}/{year}
            </th>
          </tr>
          {/* Header Row 2: Day Numbers */}
          <tr>
            <th rowSpan={2} className="border-[0.5px] border-black w-4 text-center font-normal">STT</th>
            <th rowSpan={2} className="border-[0.5px] border-black min-w-[70px] text-center relative h-16">
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <svg className="w-full h-full" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke="black" strokeWidth="0.3" />
                </svg>
              </div>
              <span className="absolute top-1 right-2 scale-90">Ngày</span>
              <span className="absolute bottom-1 left-2 scale-90">Thứ</span>
            </th>
            {days.map(d => (
              <th key={d} colSpan={3} className="border-[0.5px] border-black text-center py-1 font-normal">{d}</th>
            ))}
            {isSecondHalf && (
              <th colSpan={6} className="border-[0.5px] border-black text-center text-[8px] font-bold">Số ngày ăn trong tháng</th>
            )}
          </tr>
          {/* Header Row 3: Day of Week */}
          <tr>
            {days.map(d => (
              <th key={d} colSpan={3} className={`border-[0.5px] border-black text-center py-1 font-normal ${getDayOfWeek(d, month, year) === 'CN' ? 'bg-gray-100' : ''}`}>
                {getDayOfWeek(d, month, year)}
              </th>
            ))}
            {isSecondHalf && (
              <>
                <th colSpan={3} className="border-[0.5px] border-black text-center bg-gray-50 font-bold">Số ngày báo ăn</th>
                <th colSpan={3} className="border-[0.5px] border-black text-center bg-gray-50 font-bold">Số ngày không báo ăn</th>
              </>
            )}
          </tr>
          {/* Header Row 4: Name & Meal Labels */}
          <tr>
            <th colSpan={2} className="border-[0.5px] border-black text-center font-bold py-1">Họ và tên</th>
            {days.map(d => (
              <React.Fragment key={d}>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">S</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
              </React.Fragment>
            ))}
            {isSecondHalf && (
              <>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">S</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">S</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
                <th className="border-[0.5px] border-black w-2.5 text-center font-normal">T</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => {
            const totals = calculateStudentTotals(student);
            return (
              <tr key={student.id} className="hover:bg-blue-50 group h-4">
                <td className="border-[0.5px] border-black text-center">{idx + 1}</td>
                <td className="border-[0.5px] border-black px-0.5 font-medium whitespace-nowrap overflow-hidden relative group/cell">
                  <input 
                    type="text" 
                    value={student.name} 
                    onChange={(e) => updateStudentName(student.id, e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-[7px] h-full"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStudent(student.id); }}
                    className="absolute right-0 top-0 bottom-0 px-1 bg-white/90 text-red-500 opacity-0 group-hover/cell:opacity-100 hover:bg-red-50 transition-all print:hidden flex items-center justify-center"
                    title="Xóa học sinh"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
                {days.map(d => (
                  <React.Fragment key={d}>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'S')}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none w-2.5 ${student.meals[d]?.S ? 'font-bold' : ''}`}
                    >
                      {student.meals[d]?.S ? '+' : ''}
                    </td>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'T1')}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none w-2.5 ${student.meals[d]?.T1 ? 'font-bold' : ''}`}
                    >
                      {student.meals[d]?.T1 ? '+' : ''}
                    </td>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'T2')}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none w-2.5 ${student.meals[d]?.T2 ? 'font-bold' : ''}`}
                    >
                      {student.meals[d]?.T2 ? '+' : ''}
                    </td>
                  </React.Fragment>
                ))}
                {isSecondHalf && (
                  <>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.S}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.T1}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.T2}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.uS}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.uT1}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50">{totals.uT2}</td>
                  </>
                )}
              </tr>
            );
          })}
          {/* Add Student Row */}
          <tr className="print:hidden hover:bg-emerald-50 cursor-pointer group/add" onClick={addStudent}>
            <td className="border-[0.5px] border-black text-center text-emerald-600 font-bold group-hover/add:bg-emerald-100">+</td>
            <td colSpan={days.length * 3 + 1 + (isSecondHalf ? 6 : 0)} className="border-[0.5px] border-black px-2 text-[7px] text-emerald-600 font-bold group-hover/add:bg-emerald-100">
              Thêm học sinh mới...
            </td>
          </tr>
          {/* Footer Row: Totals */}
          <tr className="bg-gray-50 font-bold h-4">
            <td colSpan={2} className="border-[0.5px] border-black text-center uppercase">CỘNG</td>
            {days.map(d => (
              <React.Fragment key={d}>
                <td className="border-[0.5px] border-black text-center">{calculateDayTotals(d, 'S')}</td>
                <td className="border-[0.5px] border-black text-center">{calculateDayTotals(d, 'T1')}</td>
                <td className="border-[0.5px] border-black text-center">{calculateDayTotals(d, 'T2')}</td>
              </React.Fragment>
            ))}
            {isSecondHalf && (
              <td colSpan={6} className="border-[0.5px] border-black"></td>
            )}
          </tr>
        </tbody>
      </table>
      {/* Watermark-like Page Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] text-8xl font-bold select-none">
        Page {isSecondHalf ? '3' : '1'}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 p-4 font-sans text-gray-900 print:bg-white print:p-0">
      {/* Controls - Hidden on Print */}
      <div className="max-w-[1600px] mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-black/5 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
            <Save className="w-6 h-6" />
            Sổ Chấm Cơm Nội Trú
          </h1>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-white rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 font-medium min-w-[100px] text-center">Tháng {month + 1} / {year}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-white rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Năm:</span>
            <input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-20 px-2 py-1 border rounded text-sm font-bold text-center"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu dữ liệu'}
          </button>
          <button 
            onClick={addStudent}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Thêm học sinh
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" /> Nhập Excel
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> In sổ (PDF)
          </button>
          <button 
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isPreviewMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
          >
            {isPreviewMode ? 'Thoát xem trước' : 'Xem trước khi in'}
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Section - Hidden in Preview Mode */}
        {!isPreviewMode && (
          <div className="w-full flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Tên lớp:</span>
            <input 
              type="text" 
              value={className} 
              onChange={(e) => setClassName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-indigo-500 font-bold"
              placeholder="8C1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Giáo viên chủ nhiệm:</span>
            <input 
              type="text" 
              value={teacherName} 
              onChange={(e) => setTeacherName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-indigo-500"
              placeholder="Nhập tên GVCN"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Ngày ký:</span>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                value={footerDay} 
                onChange={(e) => setFooterDay(parseInt(e.target.value) || 0)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-12 text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-gray-400">/</span>
              <input 
                type="number" 
                value={footerMonth} 
                onChange={(e) => setFooterMonth(parseInt(e.target.value) || 0)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-12 text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-gray-400">/</span>
              <input 
                type="number" 
                value={footerYear} 
                onChange={(e) => setFooterYear(parseInt(e.target.value) || 0)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-16 text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => setIsQuotaModalOpen(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <span className="font-bold">Định mức ăn</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">
                S:{standardMeals.S} | T:{standardMeals.T1} | T:{standardMeals.T2}
              </span>
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Main Sheet */}
      <div className={`transition-all duration-300 ${
        isPreviewMode 
          ? 'fixed inset-0 z-50 overflow-auto bg-gray-900/90 flex items-start justify-center p-8' 
          : ''
      }`}>
        {/* Close button for preview mode */}
        {isPreviewMode && (
          <button 
            onClick={() => setIsPreviewMode(false)}
            className="fixed top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm z-50 print:hidden"
            title="Thoát xem trước"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}

        <div className={`max-w-[1600px] mx-auto bg-white shadow-2xl p-4 print:shadow-none print:p-0 overflow-x-auto excel-grid ${
          isPreviewMode ? 'scale-90 origin-top shadow-2xl' : ''
        }`}>
        {/* Header Section */}
        <div className="flex justify-between items-start mb-2 px-2">
          <div className="text-left">
            <input 
              type="text" 
              value={schoolName} 
              onChange={(e) => setSchoolName(e.target.value)}
              className="font-bold text-[10px] uppercase border-none focus:ring-0 p-0 w-[200px] bg-transparent"
            />
          </div>
        </div>

        {/* Tables Container - Side-by-side layout on screen, Stacked on print */}
        <div className="grid grid-cols-2 gap-0 border-x-[0.5px] border-black relative print:block print:border-none">
          {/* Blue dashed line separator - Hidden on print */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-blue-500 border-dashed z-10 pointer-events-none print:hidden"></div>
          
          {/* Left Half: Days 1-16 */}
          <div className="border-r-[0.5px] border-black relative print:border-none print:break-after-page print:w-full print:h-screen">
            {renderTableHalf(firstHalfDays, false)}
          </div>

          {/* Right Half: Days 17-End */}
          <div className="relative print:w-full print:h-screen print:pt-4">
            {renderTableHalf(secondHalfDays, true)}
          </div>
        </div>

        {/* Footer Section */}
        <div className="mt-4 flex justify-between items-end px-4">
          {/* Định mức ăn info (Print Only) */}
          <div className="w-32 text-[8px] invisible print:visible">
            <p><strong>Định mức ăn:</strong></p>
            <p>S: {standardMeals.S}, T: {standardMeals.T1}, T: {standardMeals.T2}</p>
          </div>

          <div className="text-center w-48">
            <p className="italic text-[9px] mb-0.5 flex items-center justify-center gap-0.5">
              <input 
                type="text" 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                className="border-none focus:ring-0 p-0 w-auto min-w-[30px] text-right bg-transparent italic"
                style={{ width: `${location.length * 5}px` }}
              />
              , ngày 
              <input 
                type="number" 
                value={footerDay} 
                onChange={(e) => setFooterDay(parseInt(e.target.value) || 0)}
                className="border-none focus:ring-0 p-0 w-[18px] text-center bg-transparent italic appearance-none"
              />
               tháng 
              <input 
                type="number" 
                value={footerMonth} 
                onChange={(e) => setFooterMonth(parseInt(e.target.value) || 0)}
                className="border-none focus:ring-0 p-0 w-[18px] text-center bg-transparent italic appearance-none"
              />
               năm 
              <input 
                type="number" 
                value={footerYear} 
                onChange={(e) => setFooterYear(parseInt(e.target.value) || 0)}
                className="border-none focus:ring-0 p-0 w-[30px] text-center bg-transparent italic appearance-none"
              />
            </p>
            <p className="font-bold uppercase text-[9px]">GIÁO VIÊN CHỦ NHIỆM</p>
            <div className="h-12"></div>
            <input 
              type="text" 
              value={teacherName} 
              onChange={(e) => setTeacherName(e.target.value)}
              className="font-bold text-[9px] border-none focus:ring-0 p-0 w-full text-center bg-transparent"
            />
          </div>
        </div>
        </div>
      </div>

      {/* Footer Info */}
      {!isPreviewMode && (
        <div className="max-w-[1600px] mx-auto mt-6 text-center text-gray-500 text-sm print:hidden">
          <p>© 2026 Hệ thống Quản lý Nội trú - Suối Lừ</p>
          <p className="text-xs mt-1">Hướng dẫn: Click vào ô để chấm cơm (+). Ô trống mặc định là không ăn.</p>
        </div>
      )}

      {/* Meal Quota Modal */}
      {isQuotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 max-w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 uppercase text-center border-b pb-2">Cấu hình Định mức ăn</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-medium text-gray-700">Sáng (S):</label>
                <input 
                  type="number" 
                  value={standardMeals.S} 
                  onChange={(e) => setStandardMeals(prev => ({ ...prev, S: parseInt(e.target.value) || 0 }))}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="font-medium text-gray-700">Trưa (T):</label>
                <input 
                  type="number" 
                  value={standardMeals.T1} 
                  onChange={(e) => setStandardMeals(prev => ({ ...prev, T1: parseInt(e.target.value) || 0 }))}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="font-medium text-gray-700">Tối (T):</label>
                <input 
                  type="number" 
                  value={standardMeals.T2} 
                  onChange={(e) => setStandardMeals(prev => ({ ...prev, T2: parseInt(e.target.value) || 0 }))}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsQuotaModalOpen(false)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium w-full"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
