/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Printer, Save, Plus, Trash2, ChevronLeft, ChevronRight, Download, Upload, LogOut, FileSpreadsheet, Copy, ClipboardPaste, Maximize2, Minimize2, User as UserIcon, Info } from 'lucide-react';
import { read, utils } from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

const INITIAL_STUDENTS: Student[] = [];

export default function App() {
  // --- State ---
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schoolName, setSchoolName] = useState('TRƯỜNG PTDTBT TH&THCS SUỐI LỪ');
  const [className, setClassName] = useState('8C1');
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed
  const [year, setYear] = useState(new Date().getFullYear());
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [location, setLocation] = useState('Suối Lừ');
  const [teacherName, setTeacherName] = useState('Vũ Văn Hùng');
  const [standardMeals, setStandardMeals] = useState({ S: 14, T1: 14, T2: 12 });
  const [footerDay, setFooterDay] = useState(new Date().getDate());
  const [footerMonth, setFooterMonth] = useState(new Date().getMonth() + 1);
  const [footerYear, setFooterYear] = useState(new Date().getFullYear());
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [markSymbol, setMarkSymbol] = useState<'x' | '+'>('+'); // New state for mark symbol
  const [clipboard, setClipboard] = useState<MealData | null>(null);
  const [columnClipboard, setColumnClipboard] = useState<boolean[] | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
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
  
  // Ref to track if data has been modified
  const isDirty = useRef(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        // If there's an error (like invalid refresh token), clear the session
        supabase.auth.signOut();
      }
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error('Unexpected session error:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Save function
  const handleSave = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setSaving(true);

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
      if (!silent) alert('Lỗi khi lưu dữ liệu!');
    } else {
      if (!silent) alert('Đã lưu dữ liệu thành công!');
      isDirty.current = false; // Reset dirty flag after successful save
    }
    if (!silent) setSaving(false);
  }, [user, month, year, className, teacherName, schoolName, location, students, standardMeals]);

  // Auto-save effect
  useEffect(() => {
    if (loading || !isDirty.current) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [students, className, teacherName, schoolName, location, standardMeals, handleSave, loading]);

  // Mark as dirty when data changes
  useEffect(() => {
    if (!loading) {
      isDirty.current = true;
    }
  }, [students, className, teacherName, schoolName, location, standardMeals]);


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
        isDirty.current = false;
      } else {
        // Try to find the most recent month's data BEFORE the current month to copy the student list and metadata
        const { data: latestData } = await supabase
          .from('monthly_sheets')
          .select('*')
          .eq('user_id', user.id)
          .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestData) {
          console.log(`Copying student list from ${latestData.month + 1}/${latestData.year}`);
          setSchoolName(latestData.school_name || 'TRƯỜNG PTDTBT TH&THCS SUỐI LỪ');
          setClassName(latestData.class_name || '8C1');
          setTeacherName(latestData.teacher_name || 'Vũ Văn Hùng');
          setLocation(latestData.location || 'Suối Lừ');
          setStandardMeals(latestData.standard_meals || { S: 14, T1: 14, T2: 12 });
          // Copy students but clear their meal data for the new month
          const copiedStudents = (latestData.students || []).map((s: any) => ({
            ...s,
            meals: {}
          }));
          setStudents(copiedStudents);
          isDirty.current = true; // Mark as dirty so it gets saved for the new month
        } else {
          setStudents(INITIAL_STUDENTS);
          isDirty.current = false;
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [user, month, year]);

  const handleLogout = async () => {
    if (isDirty.current) {
      await handleSave(true);
    }
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // --- Handlers ---

  const prevMonth = async () => {
    if (isDirty.current) await handleSave(true);
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const nextMonth = async () => {
    if (isDirty.current) await handleSave(true);
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };
  
  const handleYearChange = async (newYear: number) => {
    if (isDirty.current) await handleSave(true);
    setYear(newYear);
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

  const copyMeals = (student: Student) => {
    setClipboard(JSON.parse(JSON.stringify(student.meals)));
  };

  const pasteMeals = (studentId: string) => {
    if (!clipboard) return;
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return { ...s, meals: JSON.parse(JSON.stringify(clipboard)) };
      }
      return s;
    }));
  };

  const pasteToAll = () => {
    if (!clipboard || !confirm('Bạn có muốn dán dữ liệu này cho TẤT CẢ học sinh không?')) return;
    setStudents(prev => prev.map(s => ({
      ...s,
      meals: JSON.parse(JSON.stringify(clipboard))
    })));
  };

  const copyColumn = (day: number, meal: MealType) => {
    const values = students.map(s => !!s.meals[day]?.[meal]);
    setColumnClipboard(values);
  };

  const pasteColumn = (day: number, meal: MealType) => {
    if (!columnClipboard) return;
    setStudents(prev => prev.map((s, idx) => {
      const currentMeals = s.meals[day] || { S: false, T1: false, T2: false };
      return {
        ...s,
        meals: {
          ...s.meals,
          [day]: {
            ...currentMeals,
            [meal]: columnClipboard[idx] || false
          }
        }
      };
    }));
  };

  const fillColumn = (day: number, meal: MealType) => {
    setStudents(prev => prev.map(s => {
      const currentMeals = s.meals[day] || { S: false, T1: false, T2: false };
      return {
        ...s,
        meals: {
          ...s.meals,
          [day]: {
            ...currentMeals,
            [meal]: true
          }
        }
      };
    }));
  };

  const clearColumn = (day: number, meal: MealType) => {
    setStudents(prev => prev.map(s => {
      const currentMeals = s.meals[day] || { S: false, T1: false, T2: false };
      return {
        ...s,
        meals: {
          ...s.meals,
          [day]: {
            ...currentMeals,
            [meal]: false
          }
        }
      };
    }));
  };

  const clearDay = (day: number) => {
    if (!confirm(`Xóa toàn bộ chấm cơm ngày ${day}?`)) return;
    setStudents(prev => prev.map(s => {
      const newMeals = { ...s.meals };
      delete newMeals[day];
      return { ...s, meals: newMeals };
    }));
  };

  const clearMonth = () => {
    if (!confirm('Bạn có chắc chắn muốn XÓA HẾT dữ liệu chấm cơm của cả tháng này không? Thao tác này không thể hoàn tác.')) return;
    setStudents(prev => prev.map(s => ({ ...s, meals: {} })));
  };

  const clearAllStudents = () => {
    if (!confirm('CẢNH BÁO: Bạn đang chọn xóa TOÀN BỘ danh sách học sinh. Mọi tên học sinh và dữ liệu chấm cơm sẽ bị mất. Bạn có chắc chắn không?')) return;
    setStudents([]);
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

  const autoFillMeals = () => {
    if (!confirm('Bạn có muốn chấm tự động cho tất cả học sinh trong tháng này không? (Sẽ tự động bỏ qua chiều T6, T7 và CN)')) return;
    
    setStudents(prev => prev.map(s => {
      const newMeals: MealData = { ...s.meals };
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dow = getDayOfWeek(day, month, year);
        
        // Skip Saturday and Sunday completely
        if (dow === '7' || dow === 'CN') {
          continue;
        }
        
        const currentMeals = newMeals[day] || { S: false, T1: false, T2: false };
        
        // If Friday, skip T2 (Tối)
        if (dow === '6') {
          newMeals[day] = {
            ...currentMeals,
            S: true,
            T1: true,
            T2: false // Skip Friday evening
          };
        } else {
          // Monday to Thursday: all meals
          newMeals[day] = {
            ...currentMeals,
            S: true,
            T1: true,
            T2: true
          };
        }
      }
      
      return { ...s, meals: newMeals };
    }));
  };

  const syncFromPreviousMonth = async () => {
    if (!user) return;
    if (!confirm('Bạn có muốn cập nhật danh sách học sinh từ tháng trước không? Dữ liệu chấm cơm hiện tại của tháng này sẽ được giữ nguyên, chỉ thêm các học sinh mới hoặc cập nhật tên.')) return;

    const { data: latestData } = await supabase
      .from('monthly_sheets')
      .select('*')
      .eq('user_id', user.id)
      .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestData && latestData.students) {
      const prevStudents = latestData.students as Student[];
      setStudents(prev => {
        const currentStudents = [...prev];
        const newStudents = [...currentStudents];

        prevStudents.forEach(ps => {
          const exists = currentStudents.find(cs => cs.id === ps.id);
          if (!exists) {
            newStudents.push({ ...ps, meals: {} });
          } else {
            // Update name if changed
            const idx = newStudents.findIndex(ns => ns.id === ps.id);
            newStudents[idx] = { ...newStudents[idx], name: ps.name };
          }
        });

        return newStudents;
      });
      alert('Đã cập nhật danh sách học sinh thành công!');
    } else {
      alert('Không tìm thấy dữ liệu tháng trước để cập nhật.');
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
      
      // Try to find a sheet that has data
      let jsonData: any[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length > 0) {
          jsonData = rows;
          break;
        }
      }

      if (jsonData.length === 0) {
        alert('File Excel không có dữ liệu.');
        return;
      }

      let nameColIndex = -1;
      let startRow = 0;

      // 1. Try to find a header row
      const headerKeywords = ['họ và tên', 'họ tên', 'tên học sinh', 'học sinh', 'tên'];
      for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        const idx = row.findIndex((cell: any) => 
          typeof cell === 'string' && 
          headerKeywords.some(k => cell.toLowerCase().includes(k))
        );
        
        if (idx !== -1) {
          nameColIndex = idx;
          startRow = i + 1;
          break;
        }
      }

      // 2. If no header found, look for the first column that looks like names
      if (nameColIndex === -1) {
        // Find a column where most entries are strings and not numbers
        const colStats: { [key: number]: number } = {};
        for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
          const row = jsonData[i];
          if (!row) continue;
          row.forEach((cell, idx) => {
            if (typeof cell === 'string' && cell.trim().length > 3 && isNaN(Number(cell))) {
              colStats[idx] = (colStats[idx] || 0) + 1;
            }
          });
        }
        
        // Pick the column with the most "name-like" strings
        let maxCount = 0;
        Object.entries(colStats).forEach(([idx, count]) => {
          if (count > maxCount) {
            maxCount = count;
            nameColIndex = Number(idx);
          }
        });
        
        // If we found a column, start from the first row that has a string in it
        if (nameColIndex !== -1) {
          for (let i = 0; i < jsonData.length; i++) {
            if (typeof jsonData[i][nameColIndex] === 'string') {
              startRow = i;
              break;
            }
          }
        }
      }

      if (nameColIndex === -1) {
        alert('Không tìm thấy cột chứa tên học sinh. Vui lòng đảm bảo file có cột "Họ và tên".');
        return;
      }

      const newStudents: Student[] = [];
      const skipKeywords = ['stt', 'tổng', 'cộng', 'lớp', 'trường', 'giáo viên', 'năm học', 'tháng'];
      
      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        const rawName = row[nameColIndex];
        if (rawName && typeof rawName === 'string') {
          const name = rawName.trim();
          // Basic validation: length > 2 and not a header/footer keyword
          if (name.length > 2 && !skipKeywords.some(k => name.toLowerCase().includes(k))) {
            newStudents.push({
              id: generateId(),
              name: name,
              meals: {}
            });
          }
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
      alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Helper to create a sheet
    const createSheet = (sheetName: string, days: number[], isSecondHalf: boolean) => {
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { 
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0, // Fit to width, but let height grow
          margins: {
            left: 0.25, right: 0.25, top: 0.25, bottom: 0.25,
            header: 0.1, footer: 0.1
          }
        }
      });

      // --- Columns Setup ---
      // STT (1), Name (1), Days (3 * days.length), Summaries (6 if second half)
      const cols = [
        { header: 'STT', key: 'stt', width: 5 },
        { header: 'Họ và tên', key: 'name', width: 25 },
      ];
      
      days.forEach(d => {
        cols.push(
          { header: `${d} (S)`, key: `d${d}_S`, width: 4 },
          { header: `${d} (T)`, key: `d${d}_T1`, width: 4 },
          { header: `${d} (T)`, key: `d${d}_T2`, width: 4 }
        );
      });

      if (isSecondHalf) {
        cols.push(
          { header: 'Tổng S', key: 'total_S', width: 6 },
          { header: 'Tổng T', key: 'total_T1', width: 6 },
          { header: 'Tổng T', key: 'total_T2', width: 6 },
          { header: 'Không S', key: 'u_S', width: 6 },
          { header: 'Không T', key: 'u_T1', width: 6 },
          { header: 'Không T', key: 'u_T2', width: 6 }
        );
      }

      // We don't use sheet.columns directly because we need complex headers
      // But we can set widths manually later.
      
      // --- Header Rows ---
      // Row 1: Title
      const titleRow = sheet.addRow([`SỔ CHẤM CƠM LỚP: ${className} THÁNG ${month + 1}/${year}`]);
      titleRow.font = { name: 'Times New Roman', size: 14, bold: true };
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.mergeCells(1, 1, 1, cols.length);
      titleRow.height = 30;

      // Row 2 & 3: Headers
      // We need to construct the header structure manually
      // Row 2: STT, Ngày/Thứ, Day Numbers, (Summaries Title)
      const headerRow2Values = ['STT', 'Ngày/Thứ'];
      days.forEach(d => {
        headerRow2Values.push(String(d), '', ''); // Merged 3 cells
      });
      if (isSecondHalf) {
        headerRow2Values.push('Số ngày ăn trong tháng', '', '', '', '', '');
      }
      const headerRow2 = sheet.addRow(headerRow2Values);
      
      // Row 3: Day of Week / Sub-headers
      const headerRow3Values = ['', '']; // STT, Ngày/Thứ are merged vertically
      days.forEach(d => {
        const dow = getDayOfWeek(d, month, year);
        headerRow3Values.push(dow, '', ''); // Merged 3 cells
      });
      if (isSecondHalf) {
        headerRow3Values.push('Số ngày báo ăn', '', '', 'Số ngày không báo ăn', '', '');
      }
      const headerRow3 = sheet.addRow(headerRow3Values);

      // Row 4: S, T, T labels
      const row4Vals = ['Họ và tên', '', ...days.flatMap(() => ['S', 'T', 'T'])];
      if (isSecondHalf) {
        row4Vals.push('S', 'T', 'T', 'S', 'T', 'T');
      }
      const headerRow4 = sheet.addRow(row4Vals);

      // Merges
      sheet.mergeCells(2, 1, 3, 1); // STT
      sheet.mergeCells(2, 2, 3, 2); // Ngày/Thứ placeholder
      sheet.mergeCells(4, 1, 4, 2); // Họ và tên

      // Diagonal line and text for Ngày/Thứ cell
      const dayThurCell = sheet.getCell(2, 2);
      dayThurCell.value = {
        richText: [
          { text: '                Ngày\n\nThứ' }
        ]
      };
      dayThurCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      dayThurCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
        diagonal: { up: false, down: true, style: 'thin' }
      };

      let colIdx = 3;
      days.forEach(() => {
        sheet.mergeCells(2, colIdx, 2, colIdx + 2); // Day Num
        sheet.mergeCells(3, colIdx, 3, colIdx + 2); // DOW
        colIdx += 3;
      });

      if (isSecondHalf) {
        sheet.mergeCells(2, colIdx, 2, colIdx + 5); // "Số ngày ăn..."
        sheet.mergeCells(3, colIdx, 3, colIdx + 2); // "Có báo"
        sheet.mergeCells(3, colIdx + 3, 3, colIdx + 5); // "Không báo"
      }

      // Styling Headers
      [2, 3, 4].forEach(r => {
        const row = sheet.getRow(r);
        row.font = { name: 'Times New Roman', size: 10, bold: true };
        row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        row.height = 25;

        // Add background for Sunday columns in headers
        days.forEach((d, i) => {
          if (getDayOfWeek(d, month, year) === 'CN') {
            const startCol = 3 + i * 3;
            for (let c = startCol; c < startCol + 3; c++) {
              row.getCell(c).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3F4F6' } // gray-100
              };
            }
          }
        });
      });

      // --- Data Rows ---
      students.forEach((student, index) => {
        const totals = calculateStudentTotals(student);
        const rowValues = [index + 1, student.name];
        
        days.forEach(d => {
          const meals = student.meals[d];
          rowValues.push(meals?.S ? "+" : "", meals?.T1 ? "+" : "", meals?.T2 ? "+" : "");
        });

        if (isSecondHalf) {
          rowValues.push(totals.S, totals.T1, totals.T2, totals.uS, totals.uT1, totals.uT2);
        }

        const row = sheet.addRow(rowValues);
        row.font = { name: 'Times New Roman', size: 11 };
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        // Name alignment left
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.height = 20;

        // Add background for Sunday columns in data rows
        days.forEach((d, i) => {
          if (getDayOfWeek(d, month, year) === 'CN') {
            const startCol = 3 + i * 3;
            for (let c = startCol; c < startCol + 3; c++) {
              row.getCell(c).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF9FAFB' } // gray-50
              };
            }
          }
        });
      });

      // --- Totals Row ---
      const totalRowValues = ['CỘNG', ''];
      days.forEach(d => {
        totalRowValues.push(
          String(calculateDayTotals(d, 'S')),
          String(calculateDayTotals(d, 'T1')),
          String(calculateDayTotals(d, 'T2'))
        );
      });
      if (isSecondHalf) {
        totalRowValues.push('', '', '', '', '', '');
      }
      const totalRow = sheet.addRow(totalRowValues);
      totalRow.font = { name: 'Times New Roman', size: 11, bold: true };
      totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.mergeCells(totalRow.number, 1, totalRow.number, 2); // Merge "CỘNG" across STT and Name columns
      totalRow.height = 25;

      // --- Borders ---
      // Apply borders to all cells in the table
      const lastRow = totalRow.number;
      const lastCol = isSecondHalf ? 2 + days.length * 3 + 6 : 2 + days.length * 3;
      
      for (let r = 2; r <= lastRow; r++) {
        for (let c = 1; c <= lastCol; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      // --- Footer Info ---
      if (isSecondHalf) {
        const footerStartRow = lastRow + 2;
        
        // Định mức ăn
        const quotaRow = sheet.getRow(footerStartRow);
        quotaRow.getCell(2).value = `Định mức ăn: S: ${standardMeals.S}, T: ${standardMeals.T1}, T: ${standardMeals.T2}`;
        quotaRow.font = { name: 'Times New Roman', size: 10, italic: true };
        
        // Signature
        const sigRowIdx = footerStartRow;
        const sigColStart = lastCol - 6;
        
        sheet.mergeCells(sigRowIdx, sigColStart, sigRowIdx, lastCol);
        const dateCell = sheet.getCell(sigRowIdx, sigColStart);
        dateCell.value = `${location}, ngày ${footerDay} tháng ${footerMonth} năm ${footerYear}`;
        dateCell.alignment = { horizontal: 'center' };
        dateCell.font = { name: 'Times New Roman', size: 11, italic: true };

        const roleRowIdx = sigRowIdx + 1;
        sheet.mergeCells(roleRowIdx, sigColStart, roleRowIdx, lastCol);
        const roleCell = sheet.getCell(roleRowIdx, sigColStart);
        roleCell.value = "GIÁO VIÊN CHỦ NHIỆM";
        roleCell.alignment = { horizontal: 'center' };
        roleCell.font = { name: 'Times New Roman', size: 11, bold: true };

        const nameRowIdx = roleRowIdx + 4;
        sheet.mergeCells(nameRowIdx, sigColStart, nameRowIdx, lastCol);
        const nameCell = sheet.getCell(nameRowIdx, sigColStart);
        nameCell.value = teacherName;
        nameCell.alignment = { horizontal: 'center' };
        nameCell.font = { name: 'Times New Roman', size: 11, bold: true };
      }

      // --- Column Widths ---
      sheet.getColumn(1).width = 5; // STT
      sheet.getColumn(2).width = 25; // Name
      for (let c = 3; c <= lastCol; c++) {
        sheet.getColumn(c).width = 4; // S, T, T columns
      }
      if (isSecondHalf) {
        // Summary columns slightly wider
        for (let c = lastCol - 5; c <= lastCol; c++) {
          sheet.getColumn(c).width = 6;
        }
      }
    };

    // Create Sheet 1 (Days 1-16)
    createSheet('Trang 1', firstHalfDays, false);
    
    // Create Sheet 2 (Days 17-End)
    createSheet('Trang 2', secondHalfDays, true);

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `So_Cham_Com_${className}_Thang_${month + 1}_${year}.xlsx`);
  };

  // --- Render Helpers ---

  const renderTableHalf = (days: number[], isSecondHalf: boolean) => (
    <div className="bg-white relative w-full overflow-x-auto">
      <table className="w-full border-collapse text-[10px] leading-none border-[0.5px] border-black table-fixed min-w-max">
        <colgroup>
          <col className="w-8" /><col className="w-40" />
          {days.map(d => (
            <React.Fragment key={d}>
              <col className="w-[18px]" /><col className="w-[18px]" /><col className="w-[18px]" />
            </React.Fragment>
          ))}
          {isSecondHalf && (
            <>
              <col className="w-[20px]" /><col className="w-[20px]" /><col className="w-[20px]" />
              <col className="w-[20px]" /><col className="w-[20px]" /><col className="w-[20px]" />
            </>
          )}
        </colgroup>
        <thead>
          {/* Header Row 1: Title */}
          <tr>
            <th colSpan={days.length * 3 + 2 + (isSecondHalf ? 6 : 0)} className="border-[0.5px] border-black p-2 text-center font-bold uppercase text-sm">
              SỔ CHẤM CƠM LỚP: 
              <input 
                type="text" 
                value={className} 
                onChange={(e) => setClassName(e.target.value)}
                className="font-bold text-sm uppercase border-none focus:ring-0 p-0 w-12 text-center bg-transparent inline-block mx-1"
              />
               THÁNG {month + 1}/{year}
            </th>
          </tr>
          {/* Header Row 2: Day Numbers */}
          <tr>
            <th rowSpan={2} className="border-[0.5px] border-black text-center font-normal sticky left-0 bg-white z-20">STT</th>
            <th rowSpan={2} className="border-[0.5px] border-black text-center relative h-16 sticky left-8 bg-white z-20 shadow-[1px_0_0_black]">
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <svg className="w-full h-full" preserveAspectRatio="none">
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke="black" strokeWidth="0.5" />
                </svg>
              </div>
              <span className="absolute top-1 right-1">Ngày</span>
              <span className="absolute bottom-1 left-1">Thứ</span>
            </th>
            {days.map(d => (
              <th 
                key={d} 
                colSpan={3} 
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`border-[0.5px] border-black text-center py-1 font-normal relative group/d ${hoveredDay === d ? 'bg-blue-100' : ''}`}
              >
                {d}
                <button 
                  onClick={() => clearDay(d)}
                  className="absolute -top-1 -right-1 p-0.5 bg-white text-red-500 opacity-0 group-hover/d:opacity-100 hover:bg-red-50 rounded-full shadow-sm border border-red-100 transition-all print:hidden"
                  title={`Xóa ngày ${d}`}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </th>
            ))}
            {isSecondHalf && (
              <th colSpan={6} className="border-[0.5px] border-black text-center text-[9px] font-bold">Số ngày ăn trong tháng</th>
            )}
          </tr>
          {/* Header Row 3: Day of Week */}
          <tr>
            {days.map(d => (
              <th 
                key={d} 
                colSpan={3} 
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`border-[0.5px] border-black text-center py-1 font-normal ${hoveredDay === d ? 'bg-blue-100' : (getDayOfWeek(d, month, year) === 'CN' ? 'bg-gray-100' : '')}`}
              >
                {getDayOfWeek(d, month, year)}
              </th>
            ))}
            {isSecondHalf && (
              <>
                <th colSpan={3} className="border-[0.5px] border-black text-center bg-gray-50 font-bold text-[8px]">Số ngày<br/>báo ăn</th>
                <th colSpan={3} className="border-[0.5px] border-black text-center bg-gray-50 font-bold text-[8px]">Số ngày<br/>không báo ăn</th>
              </>
            )}
          </tr>
          {/* Header Row 4: Name & Meal Labels */}
          <tr>
            <th colSpan={2} className="border-[0.5px] border-black text-center font-bold py-1 sticky left-0 bg-white z-20 shadow-[1px_0_0_black]">
              <div className="flex items-center justify-between px-1">
                <span>Họ và tên</span>
                {clipboard && (
                  <button 
                    onClick={pasteToAll}
                    className="p-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 print:hidden"
                    title="Dán mẫu cho tất cả học sinh"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                  </button>
                )}
              </div>
            </th>
            {days.map(d => (
              <React.Fragment key={d}>
                <th 
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`border-[0.5px] border-black text-center font-normal text-[8px] relative group/h ${hoveredDay === d ? 'bg-blue-100' : ''}`}
                >
                  S
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover/h:opacity-100 transition-opacity bg-white border border-gray-200 p-0.5 rounded shadow-sm z-30 print:hidden">
                    <button onClick={() => fillColumn(d, 'S')} className="p-0.5 hover:bg-emerald-50 text-emerald-600 rounded" title="Chọn tất cả"><Plus className="w-2.5 h-2.5" /></button>
                    <button onClick={() => copyColumn(d, 'S')} className="p-0.5 hover:bg-indigo-50 text-indigo-600 rounded" title="Sao chép cột"><Copy className="w-2.5 h-2.5" /></button>
                    {columnClipboard && <button onClick={() => pasteColumn(d, 'S')} className="p-0.5 hover:bg-orange-50 text-orange-600 rounded" title="Dán cột"><ClipboardPaste className="w-2.5 h-2.5" /></button>}
                    <button onClick={() => clearColumn(d, 'S')} className="p-0.5 hover:bg-red-50 text-red-600 rounded" title="Xóa tất cả"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                </th>
                <th 
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`border-[0.5px] border-black text-center font-normal text-[8px] relative group/h ${hoveredDay === d ? 'bg-blue-100' : ''}`}
                >
                  T
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover/h:opacity-100 transition-opacity bg-white border border-gray-200 p-0.5 rounded shadow-sm z-30 print:hidden">
                    <button onClick={() => fillColumn(d, 'T1')} className="p-0.5 hover:bg-emerald-50 text-emerald-600 rounded" title="Chọn tất cả"><Plus className="w-2.5 h-2.5" /></button>
                    <button onClick={() => copyColumn(d, 'T1')} className="p-0.5 hover:bg-indigo-50 text-indigo-600 rounded" title="Sao chép cột"><Copy className="w-2.5 h-2.5" /></button>
                    {columnClipboard && <button onClick={() => pasteColumn(d, 'T1')} className="p-0.5 hover:bg-orange-50 text-orange-600 rounded" title="Dán cột"><ClipboardPaste className="w-2.5 h-2.5" /></button>}
                    <button onClick={() => clearColumn(d, 'T1')} className="p-0.5 hover:bg-red-50 text-red-600 rounded" title="Xóa tất cả"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                </th>
                <th 
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`border-[0.5px] border-black text-center font-normal text-[8px] relative group/h ${hoveredDay === d ? 'bg-blue-100' : ''}`}
                >
                  T
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover/h:opacity-100 transition-opacity bg-white border border-gray-200 p-0.5 rounded shadow-sm z-30 print:hidden">
                    <button onClick={() => fillColumn(d, 'T2')} className="p-0.5 hover:bg-emerald-50 text-emerald-600 rounded" title="Chọn tất cả"><Plus className="w-2.5 h-2.5" /></button>
                    <button onClick={() => copyColumn(d, 'T2')} className="p-0.5 hover:bg-indigo-50 text-indigo-600 rounded" title="Sao chép cột"><Copy className="w-2.5 h-2.5" /></button>
                    {columnClipboard && <button onClick={() => pasteColumn(d, 'T2')} className="p-0.5 hover:bg-orange-50 text-orange-600 rounded" title="Dán cột"><ClipboardPaste className="w-2.5 h-2.5" /></button>}
                    <button onClick={() => clearColumn(d, 'T2')} className="p-0.5 hover:bg-red-50 text-red-600 rounded" title="Xóa tất cả"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                </th>
              </React.Fragment>
            ))}
            {isSecondHalf && (
              <>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">S</th>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">T</th>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">T</th>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">S</th>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">T</th>
                <th className="border-[0.5px] border-black text-center font-normal text-[8px]">T</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => {
            const totals = calculateStudentTotals(student);
            return (
              <tr key={student.id} className="hover:bg-blue-50 group h-6">
                <td className="border-[0.5px] border-black text-center sticky left-0 bg-white group-hover:bg-blue-50 z-10">{idx + 1}</td>
                <td className="border-[0.5px] border-black px-1 font-medium whitespace-nowrap overflow-hidden relative group/cell sticky left-8 bg-white group-hover:bg-blue-50 z-10 shadow-[1px_0_0_black]">
                  <div className="flex items-center gap-1 h-full">
                    <input 
                      type="text" 
                      value={student.name} 
                      onChange={(e) => updateStudentName(student.id, e.target.value)}
                      className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[10px] h-full min-w-0"
                    />
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                      <button
                        onClick={() => copyMeals(student)}
                        className="p-0.5 hover:bg-indigo-100 text-indigo-600 rounded"
                        title="Sao chép mẫu chấm cơm"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {clipboard && (
                        <button
                          onClick={() => pasteMeals(student.id)}
                          className="p-0.5 hover:bg-orange-100 text-orange-600 rounded"
                          title="Dán mẫu chấm cơm"
                        >
                          <ClipboardPaste className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStudent(student.id); }}
                        className="p-0.5 hover:bg-red-100 text-red-500 rounded"
                        title="Xóa học sinh"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </td>
                {days.map(d => (
                  <React.Fragment key={d}>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'S')}
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none ${student.meals[d]?.S ? 'font-bold' : ''} ${hoveredDay === d ? '!bg-blue-100' : (student.meals[d]?.S ? 'bg-gray-50' : '')}`}
                    >
                      {student.meals[d]?.S ? markSymbol : ''}
                    </td>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'T1')}
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none ${student.meals[d]?.T1 ? 'font-bold' : ''} ${hoveredDay === d ? '!bg-blue-100' : (student.meals[d]?.T1 ? 'bg-gray-50' : '')}`}
                    >
                      {student.meals[d]?.T1 ? markSymbol : ''}
                    </td>
                    <td 
                      onClick={() => toggleMeal(student.id, d, 'T2')}
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`border-[0.5px] border-black text-center cursor-pointer select-none ${student.meals[d]?.T2 ? 'font-bold' : ''} ${hoveredDay === d ? '!bg-blue-100' : (student.meals[d]?.T2 ? 'bg-gray-50' : '')}`}
                    >
                      {student.meals[d]?.T2 ? markSymbol : ''}
                    </td>
                  </React.Fragment>
                ))}
                {isSecondHalf && (
                  <>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 font-medium">{totals.S}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 font-medium">{totals.T1}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 font-medium">{totals.T2}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 text-gray-500">{totals.uS}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 text-gray-500">{totals.uT1}</td>
                    <td className="border-[0.5px] border-black text-center bg-gray-50 text-gray-500">{totals.uT2}</td>
                  </>
                )}
              </tr>
            );
          })}
          {/* Add Student Row */}
          <tr className="print:hidden hover:bg-emerald-50 cursor-pointer group/add h-6" onClick={addStudent}>
            <td className="border-[0.5px] border-black text-center text-emerald-600 font-bold group-hover/add:bg-emerald-100 sticky left-0 bg-white z-10">+</td>
            <td colSpan={days.length * 3 + 1 + (isSecondHalf ? 6 : 0)} className="border-[0.5px] border-black px-2 text-[10px] text-emerald-600 font-bold group-hover/add:bg-emerald-100 sticky left-8 bg-white z-10">
              Thêm học sinh mới...
            </td>
          </tr>
          {/* Footer Row: Totals */}
          <tr className="bg-gray-50 font-bold h-6">
            <td colSpan={2} className="border-[0.5px] border-black text-center uppercase sticky left-0 bg-gray-50 z-10 shadow-[1px_0_0_black]">CỘNG</td>
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
        {isSecondHalf && (
          <tfoot className="print:table-footer-group">
            <tr className="no-print-border border-none print:break-inside-avoid">
              <td colSpan={days.length * 3 + 2 + 6} className="border-none !border-transparent pt-8 pb-4">
                <div className="flex justify-end pr-8">
                  <div className="text-center w-64 print:break-inside-avoid">
                    <p className="italic text-[11px] mb-1 flex items-center justify-center gap-0.5">
                      <input 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        className="border-none focus:ring-0 p-0 min-w-[50px] text-right bg-transparent italic"
                        style={{ width: `${Math.max(location.length * 8, 50)}px` }}
                      />
                      , ngày 
                      <input 
                        type="text" 
                        value={footerDay} 
                        onChange={(e) => setFooterDay(parseInt(e.target.value) || 0)}
                        className="border-none focus:ring-0 p-0 w-[30px] text-center bg-transparent italic"
                      />
                      tháng 
                      <input 
                        type="text" 
                        value={footerMonth} 
                        onChange={(e) => setFooterMonth(parseInt(e.target.value) || 0)}
                        className="border-none focus:ring-0 p-0 w-[30px] text-center bg-transparent italic"
                      />
                      năm 
                      <input 
                        type="text" 
                        value={footerYear} 
                        onChange={(e) => setFooterYear(parseInt(e.target.value) || 0)}
                        className="border-none focus:ring-0 p-0 w-[40px] text-center bg-transparent italic"
                      />
                    </p>
                    <p className="font-bold uppercase text-[11px] leading-tight">GIÁO VIÊN CHỦ NHIỆM</p>
                    <div className="h-16"></div>
                    <input 
                      type="text" 
                      value={teacherName} 
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="font-bold text-[11px] border-none focus:ring-0 p-0 w-full text-center bg-transparent"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {/* Watermark-like Page Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] text-8xl font-bold select-none print:hidden">
        Page {isSecondHalf ? '2' : '1'}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-stone-100 font-sans text-gray-900 print:bg-white print:p-0 ${isFullScreen ? 'p-0 overflow-hidden' : 'p-4'}`}>
      {/* Controls - Hidden on Print */}
      <div className={`max-w-[1600px] mx-auto mb-6 bg-white rounded-xl shadow-sm border border-black/5 print:hidden ${isFullScreen ? 'hidden' : ''}`}>
        
        {/* Top bar of control panel for User Info */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-indigo-50/50 rounded-t-xl">
          <div className="text-sm text-indigo-900/60 font-medium">Phần mềm Sổ Chấm Cơm Nội Trú</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-700 bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100">
              <UserIcon className="w-4 h-4" />
              <span className="text-sm font-bold">{user?.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-full transition-colors text-sm font-bold border border-red-100"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
              <Save className="w-6 h-6" />
              Sổ Chấm Cơm
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
                onChange={(e) => handleYearChange(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-20 px-2 py-1 border rounded text-sm font-bold text-center"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={clearMonth}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-all shadow-sm group"
              title="Xóa toàn bộ dữ liệu chấm cơm tháng này"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Xóa hết<br/>tháng</span>
            </button>

            <button 
              onClick={clearAllStudents}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-red-50 text-red-700 rounded-xl border border-red-100 hover:bg-red-100 transition-all shadow-sm group"
              title="Xóa toàn bộ danh sách học sinh"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Xóa danh<br/>sách</span>
            </button>

            <button 
              onClick={autoFillMeals}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 hover:bg-amber-100 transition-all shadow-sm group"
              title="Chấm tự động cả tháng (Trừ chiều T6, T7, CN)"
            >
              <ClipboardPaste className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Chấm<br/>tự động</span>
            </button>

            <button 
              onClick={() => handleSave()}
              disabled={saving}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-indigo-600 text-white rounded-xl border border-indigo-700 hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">{saving ? 'Đang lưu...' : <>Lưu<br/>dữ liệu</>}</span>
            </button>

            <button 
              onClick={addStudent}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-emerald-600 text-white rounded-xl border border-emerald-700 hover:bg-emerald-700 transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Thêm<br/>học sinh</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-blue-600 text-white rounded-xl border border-blue-700 hover:bg-blue-700 transition-all shadow-sm"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Nhập<br/>Excel</span>
            </button>

            <button 
              onClick={() => window.print()}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-slate-700 text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition-all shadow-sm"
            >
              <Printer className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">In sổ<br/>(PDF)</span>
            </button>

            <button 
              onClick={handleExportExcel}
              className="flex flex-col items-center justify-center gap-1.5 w-20 h-20 bg-green-600 text-white rounded-xl border border-green-700 hover:bg-green-700 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">Xuất<br/>Excel</span>
            </button>

            <button 
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`flex flex-col items-center justify-center gap-1.5 w-20 h-20 rounded-xl border transition-all shadow-sm ${isPreviewMode ? 'bg-orange-600 text-white border-orange-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
            >
              <Maximize2 className="w-5 h-5" />
              <span className="text-[11px] font-bold leading-tight text-center">{isPreviewMode ? 'Thoát xem' : <>Xem trước<br/>khi in</>}</span>
            </button>

            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`flex flex-col items-center justify-center gap-1.5 w-20 h-20 rounded-xl border transition-all shadow-sm ${isFullScreen ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              <span className="text-[11px] font-bold leading-tight text-center">{isFullScreen ? 'Thu nhỏ' : <>Phóng<br/>to</>}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 rounded-xl border border-slate-200 p-1 h-12 ml-2 shadow-sm">
              <button onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))} className="w-8 h-full hover:bg-white rounded-lg text-sm font-bold flex items-center justify-center text-slate-700">-</button>
              <span className="text-[11px] font-bold w-10 text-center text-slate-700">{zoomLevel}%</span>
              <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))} className="w-8 h-full hover:bg-white rounded-lg text-sm font-bold flex items-center justify-center text-slate-700">+</button>
            </div>
          </div>
        </div>

        {/* Configuration Section - Hidden in Preview Mode or Fullscreen */}
        {(!isPreviewMode && !isFullScreen) && (
          <div className="w-full flex flex-col gap-4 mt-4 pt-4 border-t border-gray-200">
            {/* Top Row: Inputs */}
            <div className="flex flex-wrap items-center gap-6">
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
            </div>
            
            {/* Bottom Row: Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-2 mr-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                <span className="text-sm font-medium text-gray-700">Ký hiệu chấm:</span>
                <select 
                  value={markSymbol} 
                  onChange={(e) => setMarkSymbol(e.target.value as '+' | 'x')}
                  className="border-none bg-transparent text-sm font-bold text-indigo-700 focus:ring-0 cursor-pointer"
                >
                  <option value="+">Dấu cộng (+)</option>
                  <option value="x">Dấu nhân (x)</option>
                </select>
              </div>
              <button 
                onClick={syncFromPreviousMonth}
                className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-sm"
                title="Cập nhật danh sách học sinh từ tháng trước"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="font-bold">Đồng bộ DS tháng trước</span>
              </button>
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
          ? 'fixed inset-0 z-50 overflow-auto bg-black/80 backdrop-blur-md flex items-start justify-center p-8' 
          : isFullScreen
            ? 'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-start p-4 overflow-auto'
            : ''
      }`}>
        {/* Close button for preview mode or fullscreen */}
        {(isPreviewMode || isFullScreen) && (
          <button 
            onClick={() => {
              setIsPreviewMode(false);
              setIsFullScreen(false);
            }}
            className="fixed top-6 right-6 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-2xl z-50 print:hidden flex items-center gap-2 transition-all hover:scale-105 group"
            title={isPreviewMode ? 'Thoát xem trước' : 'Thoát phóng to'}
          >
            <Minimize2 className="w-6 h-6" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">Thoát</span>
          </button>
        )}

        <div 
          className={`bg-white shadow-2xl p-4 print:shadow-none print:p-0 overflow-x-auto excel-grid transition-all duration-500 ${
            isPreviewMode ? 'max-w-[1600px] mx-auto scale-90 origin-top' : isFullScreen ? 'w-fit h-fit min-w-[95%] rounded-xl my-auto' : 'max-w-[1600px] mx-auto'
          }`}
          style={{ zoom: isPreviewMode ? undefined : `${zoomLevel}%` }}
        >
        {/* Header Section */}
        <div className="flex justify-between items-start mb-2 px-2">
          <div className="text-left">
            <input 
              type="text" 
              value={schoolName} 
              onChange={(e) => setSchoolName(e.target.value)}
              className="font-bold text-xs uppercase border-none focus:ring-0 p-0 w-[300px] bg-transparent"
            />
          </div>
        </div>

        {/* Tables Container - Side-by-side layout on large screens, Stacked on mobile/print */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-x-[0.5px] border-black relative print:block print:border-none">
          {/* Blue dashed line separator - Hidden on mobile and print */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-blue-500 border-dashed z-10 pointer-events-none hidden lg:block print:hidden"></div>
          
          {/* Left Half: Days 1-16 */}
          <div className="border-r-[0.5px] border-black relative print:border-none print:break-after-page print:w-full overflow-x-auto">
            {renderTableHalf(firstHalfDays, false)}
          </div>

          {/* Right Half: Days 17-End */}
          <div className="relative print:w-full print:pt-4 overflow-x-auto">
            {renderTableHalf(secondHalfDays, true)}
          </div>
        </div>
        </div>

        {/* Hidden File Input for Excel Upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls"
          className="hidden"
        />
      </div>

      {/* Footer Info / Instructions */}
      {!isPreviewMode && (
        <div className="max-w-[1600px] mx-auto mt-6 bg-white rounded-xl shadow-sm border border-blue-100 p-6 print:hidden">
          <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
              <Info className="w-5 h-5" />
            </span>
            Hướng dẫn chi tiết cách chấm cơm
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div className="space-y-3">
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-50 h-full">
                <h4 className="font-bold text-blue-900 mb-2">1. Chấm thủ công từng buổi</h4>
                <p className="mb-2">• <strong>Đánh dấu có ăn:</strong> Click chuột trái vào ô tương ứng (S: Sáng, T: Trưa, T: Tối) của học sinh. Ô sẽ hiện dấu <span className="font-bold text-black bg-gray-200 px-1.5 py-0.5 rounded">{markSymbol}</span>.</p>
                <p>• <strong>Xóa đánh dấu (không ăn):</strong> Click chuột trái thêm lần nữa vào ô đã có dấu <span className="font-bold text-black bg-gray-200 px-1.5 py-0.5 rounded">{markSymbol}</span> để xóa (ô trở về trống).</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-50 h-full">
                <h4 className="font-bold text-emerald-900 mb-2">2. Thao tác nhanh cho CẢ LỚP (Theo cột)</h4>
                <p className="mb-2">Rê chuột vào tiêu đề cột buổi (S, T, T) của một ngày, một menu nhỏ sẽ hiện ra:</p>
                <ul className="space-y-2 ml-2">
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><Plus className="w-3.5 h-3.5 text-emerald-600" /></span> <strong>Chọn tất cả:</strong> Chấm ăn cho toàn bộ học sinh trong buổi đó.</li>
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><Trash2 className="w-3.5 h-3.5 text-red-600" /></span> <strong>Xóa tất cả:</strong> Xóa chấm cơm của toàn bộ học sinh trong buổi đó.</li>
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><Copy className="w-3.5 h-3.5 text-indigo-600" /></span> <strong>Sao chép:</strong> Copy dữ liệu của cột hiện tại.</li>
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><ClipboardPaste className="w-3.5 h-3.5 text-orange-600" /></span> <strong>Dán:</strong> Dán dữ liệu vừa copy vào cột này.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-50 h-full">
                <h4 className="font-bold text-purple-900 mb-2">3. Thao tác nhanh cho MỘT HỌC SINH (Theo hàng)</h4>
                <p className="mb-2">Rê chuột vào tên của một học sinh, các nút công cụ sẽ hiện ra bên phải tên:</p>
                <ul className="space-y-2 ml-2">
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><Copy className="w-3.5 h-3.5 text-indigo-600" /></span> <strong>Sao chép:</strong> Copy toàn bộ dữ liệu chấm cơm cả tháng của học sinh này.</li>
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><ClipboardPaste className="w-3.5 h-3.5 text-orange-600" /></span> <strong>Dán:</strong> Dán dữ liệu đã copy cho học sinh này.</li>
                  <li className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm"><ClipboardPaste className="w-3.5 h-3.5 text-orange-600" /></span> <strong>Dán cho tất cả:</strong> (Nút dán trên tiêu đề "Họ và tên") Dán mẫu đã copy cho toàn bộ lớp.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-red-50/50 p-4 rounded-lg border border-red-50 h-full">
                <h4 className="font-bold text-red-900 mb-2">4. Xóa dữ liệu nhanh</h4>
                <p className="mb-3">• <strong>Xóa cả ngày:</strong> Rê chuột vào số ngày (1, 2, 3...) trên tiêu đề, bấm biểu tượng <span className="bg-white p-1 rounded shadow-sm inline-flex align-middle mx-1"><Trash2 className="w-3.5 h-3.5 text-red-600" /></span> để xóa toàn bộ dữ liệu của ngày đó.</p>
                <p>• <strong>Xóa học sinh:</strong> Rê chuột vào tên học sinh, bấm biểu tượng <span className="bg-white p-1 rounded shadow-sm inline-flex align-middle mx-1"><Trash2 className="w-3.5 h-3.5 text-red-600" /></span> để xóa học sinh khỏi danh sách.</p>
              </div>
            </div>
          </div>
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
