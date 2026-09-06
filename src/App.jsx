import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  arrayUnion, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Search, Plus, User, Hospital, Pill, Calendar, Phone, Trash2, 
  Printer, Edit3, HeartPulse, Stethoscope, Building2, LayoutDashboard,
  Users, Activity, Settings, Image as ImageIcon, Save, CheckCircle2,
  ShieldAlert, ArrowUpRight, Award, MapPin, BarChart3
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentWorkplace, setCurrentWorkplace] = useState('Hospital');
  const [filterLocation, setFilterLocation] = useState('All');

  // Reports view controls
  const [reportPeriod, setReportPeriod] = useState('thisMonth');
  const [reportFacility, setReportFacility] = useState('Hospital'); // default to selected mode
  const [customMonthValue, setCustomMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [doctorProfile, setDoctorProfile] = useState({
    doctorName: 'Dr. Tariq Mahmood',
    qualifications: 'DHMS',
    specialization: 'Homoeo Medicine Specialist / Family Physician',
    hospitalName: 'AYESHA FREE DISPENSARY (R)',
    clinicName: 'HOMOEOPATHIC CENTER (R)',
    clinicAddress: 'Main Bazar Gulgasht Colony near Nusrat Fateh Ali Khan Hospital, Faisalabad',
    contactNumber: '+92 333-8982371 / 0321-6606720',
    registrationNo: 'NCH#98863/PHC#17038/PHCL 2030917038',
    logoUrl: ''
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [printVisit, setPrintVisit] = useState(null);

  const [patientForm, setPatientForm] = useState({
    name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', medicalHistory: '', address: ''
  });

  const [visitDiagnosis, setVisitDiagnosis] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [vitals, setVitals] = useState({ bp: '', pulse: '', temp: '', weight: '', sugar: '' });
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '1-0-1', duration: '5 Days', instructions: 'After Meals' }
  ]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const patientList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(patientList);

      if (selectedPatient) {
        const updated = patientList.find(p => p.id === selectedPatient.id);
        setSelectedPatient(updated || null);
      } else if (patientList.length > 0 && !selectedPatient) {
        setSelectedPatient(patientList[0]);
      }
    });

    return () => unsubscribe();
  }, [selectedPatient?.id]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'doctor_profile'), (docSnap) => {
      if (docSnap.exists()) {
        setDoctorProfile(docSnap.data());
      }
    });
    return () => unsubSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'doctor_profile'), doctorProfile);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        return alert('Image size is too large. Please upload an image under 1MB.');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setDoctorProfile(prev => ({ ...prev, logoUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const allVisits = patients.flatMap(p => (p.visits || []).map(v => ({ 
    ...v, 
    patientName: p.name, 
    patientId: p.id, 
    patientPhone: p.phone
  })));
  const todayVisits = allVisits.filter(v => v.date === todayStr);
  const hospitalVisits = allVisits.filter(v => v.location === 'Hospital');
  const clinicVisits = allVisits.filter(v => v.location === 'Clinic');

  // Reports data calculation
  const reportData = useMemo(() => {
    const now = new Date();
    const mkDate = (y, m, d) => new Date(y, m, d);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    let start, end;
    if (reportPeriod === 'thisWeek') {
      start = mkDate(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      end = mkDate(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    } else if (reportPeriod === 'lastWeek') {
      const thisMonday = mkDate(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      start = mkDate(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
      end = thisMonday;
    } else if (reportPeriod === 'thisYear') {
      start = mkDate(now.getFullYear(), 0, 1);
      end = mkDate(now.getFullYear() + 1, 0, 1);
    } else if (reportPeriod === 'customMonth') {
      const [yy, mm] = customMonthValue.split('-').map(Number);
      start = mkDate(yy, mm - 1, 1);
      end = mkDate(yy, mm, 1);
    } else {
      start = mkDate(now.getFullYear(), now.getMonth(), 1);
      end = mkDate(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const parseVisitDate = (dStr) => {
      if (!dStr) return null;
      const parts = dStr.split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return null;
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    const inRange = (d) => d && d >= start && d < end;
    const periodVisitsAll = allVisits.filter(v => inRange(parseVisitDate(v.date)));
    
    // Strict isolation by facility
    const periodVisits = reportFacility === 'All'
      ? periodVisitsAll
      : periodVisitsAll.filter(v => v.location === reportFacility);

    // Group visits by date
    const dateCounts = {};
    periodVisits.forEach(v => {
      if (v.date) {
        dateCounts[v.date] = (dateCounts[v.date] || 0) + 1;
      }
    });

    const dateSummary = Object.keys(dateCounts)
      .sort()
      .map(date => ({
        date,
        count: dateCounts[date]
      }));

    // Split dateSummary into two equal parallel columns
    const mid = Math.ceil(dateSummary.length / 2);
    const colLeft = dateSummary.slice(0, mid);
    const colRight = dateSummary.slice(mid);

    // Line Chart Data Buckets
    let buckets = [];
    if (reportPeriod === 'thisWeek' || reportPeriod === 'lastWeek') {
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      buckets = labels.map((label, i) => {
        const dayStart = mkDate(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const dayEnd = mkDate(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
        const value = periodVisits.filter(v => {
          const d = parseVisitDate(v.date);
          return d && d >= dayStart && d < dayEnd;
        }).length;
        return { label, value };
      });
    } else if (reportPeriod === 'thisYear') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      buckets = months.map((label, i) => {
        const value = periodVisits.filter(v => {
          const d = parseVisitDate(v.date);
          return d && d.getFullYear() === start.getFullYear() && d.getMonth() === i;
        }).length;
        return { label, value };
      });
    } else {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const numWeeks = Math.ceil(daysInMonth / 7);
      buckets = Array.from({ length: numWeeks }, (_, i) => {
        const weekStartDay = i * 7 + 1;
        const weekEndDay = Math.min(weekStartDay + 6, daysInMonth);
        const value = periodVisits.filter(v => {
          const d = parseVisitDate(v.date);
          return d && d.getDate() >= weekStartDay && d.getDate() <= weekEndDay;
        }).length;
        return { label: `Week ${i + 1}`, value };
      });
    }

    const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lastDay = mkDate(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    const staticShortLabels = { thisWeek: 'This Week', lastWeek: 'Last Week', thisMonth: 'This Month', thisYear: 'This Year' };
    
    let shortLabel, rangeLabel;
    if (reportPeriod === 'thisWeek' || reportPeriod === 'lastWeek') {
      shortLabel = staticShortLabels[reportPeriod];
      rangeLabel = `${fmtDate(start)} – ${fmtDate(lastDay)}`;
    } else if (reportPeriod === 'thisYear') {
      shortLabel = staticShortLabels[reportPeriod];
      rangeLabel = `${start.getFullYear()} (${fmtDate(start)} – ${fmtDate(lastDay)})`;
    } else {
      const monthName = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      shortLabel = reportPeriod === 'customMonth'
        ? start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : staticShortLabels.thisMonth;
      rangeLabel = `${monthName} (${fmtDate(start)} – ${fmtDate(lastDay)})`;
    }

    return {
      rangeLabel,
      shortLabel,
      totalVisitsCount: periodVisits.length,
      dateSummary,
      colLeft,
      colRight,
      buckets
    };
  }, [allVisits, reportPeriod, reportFacility, customMonthValue]);

  const handlePrintReport = () => {
    window.print();
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery);
    const matchesLocation = filterLocation === 'All' ? true : p.registeredAt === filterLocation;
    return matchesSearch && matchesLocation;
  });

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!patientForm.name || !patientForm.phone) return alert('Name and phone number are required');

    try {
      const docRef = await addDoc(collection(db, 'patients'), {
        ...patientForm,
        registeredAt: currentWorkplace,
        createdAt: serverTimestamp(),
        visits: []
      });
      setShowAddPatientModal(false);
      setPatientForm({ name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', medicalHistory: '', address: '' });
      setSelectedPatient({ id: docRef.id, ...patientForm, visits: [] });
      setCurrentView('records');
    } catch (err) {
      alert('Error creating patient: ' + err.message);
    }
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, patientForm);
      setShowEditPatientModal(false);
    } catch (err) {
      alert('Error updating patient: ' + err.message);
    }
  };

  const handleDeletePatient = async (patientId, patientName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete medical record for "${patientName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'patients', patientId));
      if (selectedPatient?.id === patientId) setSelectedPatient(null);
    } catch (err) {
      alert('Error deleting patient: ' + err.message);
    }
  };

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', dosage: '1-0-1', duration: '5 Days', instructions: 'After Meals' }]);
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const removeMedicineRow = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleAddVisit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const newVisitRecord = {
      id: Date.now().toString(),
      date: visitDate,
      location: currentWorkplace,
      facilityName: currentWorkplace === 'Hospital' ? doctorProfile.hospitalName : doctorProfile.clinicName,
      diagnosis: visitDiagnosis,
      notes: visitNotes,
      vitals: vitals,
      medicines: medicines.filter(m => m.name.trim() !== '')
    };

    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        visits: arrayUnion(newVisitRecord),
        lastVisitDate: visitDate,
        lastLocation: currentWorkplace
      });

      setShowAddVisitModal(false);
      setVisitDiagnosis('');
      setVisitNotes('');
      setVitals({ bp: '', pulse: '', temp: '', weight: '', sugar: '' });
      setMedicines([{ name: '', dosage: '1-0-1', duration: '5 Days', instructions: 'After Meals' }]);
    } catch (err) {
      alert('Error saving visit: ' + err.message);
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!selectedPatient) return;
    if (!window.confirm('Delete this visit record?')) return;
    try {
      const updatedVisits = selectedPatient.visits.filter(v => v.id !== visitId);
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, { visits: updatedVisits });
    } catch (err) {
      alert('Error deleting visit: ' + err.message);
    }
  };

  const triggerPrint = (visit) => {
    setPrintVisit(visit);
    setTimeout(() => {
      window.print();
      setPrintVisit(null);
    }, 250);
  };

  // Helper function to build SVG Line Path
  const buildSvgLine = (data, width, height, padX, padY) => {
    if (data.length <= 1) return { path: '', area: '', points: [] };
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const points = data.map((d, i) => {
      const x = padX + (i / (data.length - 1)) * plotW;
      const y = height - padY - (d.value / maxVal) * plotH;
      return { x, y, value: d.value, label: d.label };
    });

    const path = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
    const area = `${path} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    return { path, area, points };
  };

  const lineChartData = buildSvgLine(reportData.buckets, 780, 200, 45, 25);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      
      {/* GLOBAL PRINT OVERRIDE STYLES */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body, #root, div {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          table {
            page-break-inside: avoid;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* 1. TOP NAVBAR */}
      <header className="no-print" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {doctorProfile.logoUrl ? (
              <img src={doctorProfile.logoUrl} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
            ) : (
              <div style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', padding: '10px', borderRadius: '10px' }}>
                <Stethoscope size={22} />
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{doctorProfile.clinicName || "Doctor's Portal"}</h1>
              <p style={{ fontSize: '12px', color: '#64748b' }}>{doctorProfile.doctorName} • {doctorProfile.specialization}</p>
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
            <button
              onClick={() => setCurrentView('dashboard')}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: currentView === 'dashboard' ? '#fff' : 'transparent',
                color: currentView === 'dashboard' ? '#2563eb' : '#64748b',
                boxShadow: currentView === 'dashboard' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <LayoutDashboard size={15} /> Dashboard
            </button>
            <button
              onClick={() => setCurrentView('records')}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: currentView === 'records' ? '#fff' : 'transparent',
                color: currentView === 'records' ? '#2563eb' : '#64748b',
                boxShadow: currentView === 'records' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Users size={15} /> Patients
            </button>
            <button
              onClick={() => setCurrentView('reports')}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: currentView === 'reports' ? '#fff' : 'transparent',
                color: currentView === 'reports' ? '#2563eb' : '#64748b',
                boxShadow: currentView === 'reports' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <BarChart3 size={15} /> Reports
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: currentView === 'settings' ? '#fff' : 'transparent',
                color: currentView === 'settings' ? '#2563eb' : '#64748b',
                boxShadow: currentView === 'settings' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Settings size={15} /> Clinic Settings
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { setCurrentWorkplace('Hospital'); setReportFacility('Hospital'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: currentWorkplace === 'Hospital' ? '#2563eb' : 'transparent',
              color: currentWorkplace === 'Hospital' ? '#ffffff' : '#64748b'
            }}
          >
            <Hospital size={16} /> Hospital Mode
          </button>
          <button
            onClick={() => { setCurrentWorkplace('Clinic'); setReportFacility('Clinic'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: currentWorkplace === 'Clinic' ? '#059669' : 'transparent',
              color: currentWorkplace === 'Clinic' ? '#ffffff' : '#64748b'
            }}
          >
            <Building2 size={16} /> Clinic Mode
          </button>
        </div>
      </header>

      {/* VIEW: CLINIC / DOCTOR SETTINGS */}
      {currentView === 'settings' && (
        <div className="no-print" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Doctor & Clinic Profile Setup</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Configure doctor details, credentials, clinic logo, and prescription header.</p>
              </div>
              {settingsSaved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: '700', fontSize: '13px', background: '#dcfce7', padding: '6px 12px', borderRadius: '6px' }}>
                  <CheckCircle2 size={16} /> Settings Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '10px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {doctorProfile.logoUrl ? (
                    <img src={doctorProfile.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={32} color="#94a3b8" />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '4px' }}>Upload Clinic / Hospital Logo</label>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>This logo will appear on all printed prescription slips (PNG/JPG, max 1MB).</p>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Doctor Full Name & Title</label>
                  <input
                    type="text"
                    required
                    value={doctorProfile.doctorName}
                    onChange={e => setDoctorProfile({ ...doctorProfile, doctorName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Qualifications</label>
                  <input
                    type="text"
                    value={doctorProfile.qualifications}
                    onChange={e => setDoctorProfile({ ...doctorProfile, qualifications: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Specialization / Department</label>
                  <input
                    type="text"
                    value={doctorProfile.specialization}
                    onChange={e => setDoctorProfile({ ...doctorProfile, specialization: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Medical Reg / License No.</label>
                  <input
                    type="text"
                    value={doctorProfile.registrationNo}
                    onChange={e => setDoctorProfile({ ...doctorProfile, registrationNo: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Private Clinic Name</label>
                  <input
                    type="text"
                    value={doctorProfile.clinicName}
                    onChange={e => setDoctorProfile({ ...doctorProfile, clinicName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Hospital / Facility Name</label>
                  <input
                    type="text"
                    value={doctorProfile.hospitalName}
                    onChange={e => setDoctorProfile({ ...doctorProfile, hospitalName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Clinic Address</label>
                  <input
                    type="text"
                    value={doctorProfile.clinicAddress}
                    onChange={e => setDoctorProfile({ ...doctorProfile, clinicAddress: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Contact / Appointment Phone</label>
                  <input
                    type="text"
                    value={doctorProfile.contactNumber}
                    onChange={e => setDoctorProfile({ ...doctorProfile, contactNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  background: '#2563eb', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none',
                  fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', marginTop: '10px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                }}
              >
                <Save size={18} /> Save & Apply
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW: REPORTS & ANALYTICS */}
      {currentView === 'reports' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* Top Controls & Print Action */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Reports & Analytics</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Showing: <strong style={{ color: '#0f172a' }}>{reportData.rangeLabel}</strong> • Facility: <strong style={{ color: '#0f172a' }}>{reportFacility}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                  {['Hospital', 'Clinic', 'All'].map(loc => (
                    <button
                      key={loc}
                      onClick={() => setReportFacility(loc)}
                      style={{
                        padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '12px',
                        background: reportFacility === loc ? '#fff' : 'transparent',
                        color: reportFacility === loc ? '#0f172a' : '#64748b',
                        boxShadow: reportFacility === loc ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', color: '#1e293b', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="customMonth">Choose a Month...</option>
                </select>

                {reportPeriod === 'customMonth' && (
                  <input
                    type="month"
                    value={customMonthValue}
                    onChange={(e) => setCustomMonthValue(e.target.value)}
                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                    style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', color: '#1e293b', background: '#fff', cursor: 'pointer' }}
                  />
                )}

                {/* Print Button at top */}
                <button
                  onClick={handlePrintReport}
                  style={{
                    background: '#2563eb', color: '#fff', padding: '9px 18px', borderRadius: '8px', border: 'none',
                    fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px',
                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                  }}
                >
                  <Printer size={16} /> Print Report
                </button>
              </div>
            </div>

            {/* SCREEN ONLY: Strict Metric Cards */}
            <div className="no-print" style={{ display: 'grid', gridTemplateColumns: reportFacility === 'All' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '16px' }}>
              {reportFacility !== 'Clinic' && (
                <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Hospital Encounters</span>
                    <Hospital size={18} color="#1d4ed8" />
                  </div>
                  <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>
                    {reportFacility === 'Hospital' ? reportData.totalVisitsCount : allVisits.filter(v => v.location === 'Hospital').length}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{doctorProfile.hospitalName}</span>
                </div>
              )}

              {reportFacility !== 'Hospital' && (
                <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Clinic Encounters</span>
                    <Building2 size={18} color="#d97706" />
                  </div>
                  <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>
                    {reportFacility === 'Clinic' ? reportData.totalVisitsCount : allVisits.filter(v => v.location === 'Clinic').length}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{doctorProfile.clinicName}</span>
                </div>
              )}

              <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Total Consultations</span>
                  <Activity size={18} color="#059669" />
                </div>
                <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>{reportData.totalVisitsCount}</h3>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>In selected range</span>
              </div>
            </div>

            {/* SCREEN ONLY: Smooth Interactive SVG Line Graph */}
            <div className="no-print" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Consultation Volume Trend ({reportFacility})
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Line chart visualization across {reportData.shortLabel}</p>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px' }}>
                  {reportData.totalVisitsCount} Total Visits
                </span>
              </div>

              {reportData.buckets.every(b => b.value === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                  No consultations recorded for {reportFacility} in this period.
                </div>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg viewBox="0 0 780 200" style={{ width: '100%', height: '200px', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                      <line
                        key={idx}
                        x1="45"
                        y1={200 - 25 - ratio * 150}
                        x2="735"
                        y2={200 - 25 - ratio * 150}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                      />
                    ))}

                    {lineChartData.area && (
                      <path d={lineChartData.area} fill="url(#chartGradient)" />
                    )}

                    {lineChartData.path && (
                      <path d={lineChartData.path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {lineChartData.points.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
                        <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
                          {pt.value}
                        </text>
                        <text x={pt.x} y={200 - 6} textAnchor="middle" fontSize="11" fill="#64748b">
                          {pt.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}
            </div>

            {/* PRINT ONLY: Professional Letterhead */}
            <div className="print-only" style={{ paddingBottom: '8px', fontFamily: 'Arial, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #1e3a8a', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {doctorProfile.logoUrl && (
                    <img src={doctorProfile.logoUrl} alt="Clinic Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                  )}
                  <div>
                    <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a8a', margin: 0 }}>{doctorProfile.doctorName}</h1>
                    <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '2px 0', color: '#334155' }}>{doctorProfile.qualifications}</p>
                    <p style={{ fontSize: '10px', margin: 0, color: '#475569' }}>{doctorProfile.specialization} • Reg #{doctorProfile.registrationNo}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px', color: '#334155' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px', color: '#1e3a8a' }}>
                    {reportFacility === 'Hospital'
                      ? doctorProfile.hospitalName
                      : reportFacility === 'Clinic'
                        ? doctorProfile.clinicName
                        : `${doctorProfile.clinicName} & ${doctorProfile.hospitalName}`}
                  </h3>
                  <p style={{ margin: '1px 0' }}>{doctorProfile.clinicAddress}</p>
                  <p style={{ margin: '1px 0' }}><strong>Tel:</strong> {doctorProfile.contactNumber}</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px' }}>
                    {reportFacility === 'Hospital' ? 'Hospital Consultation Report' : reportFacility === 'Clinic' ? 'Clinic Consultation Report' : 'Consolidated Consultation Report'}
                  </h2>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>
                    <strong>Period:</strong> {reportData.rangeLabel} &nbsp;|&nbsp; <strong>Facility:</strong> {reportFacility}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>
                    Total Patients Seen: {reportData.totalVisitsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* 2 PARALLEL TABLES: All 31 rows fit perfectly on one single sheet */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Daily Consultation Summary — Parallel Layout ({reportFacility})
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Compact Dual-Column View</span>
              </div>

              {reportData.dateSummary.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '13px' }}>
                  No visit records available for this period.
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    
                    {/* Left Column Table */}
                    <div style={{ flex: 1 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                            <th style={{ padding: '6px 8px', width: '45px', fontWeight: '800' }}>Sr.</th>
                            <th style={{ padding: '6px 8px', fontWeight: '800' }}>Date</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800' }}>Patients</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.colLeft.map((row, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 8px', color: '#64748b', fontWeight: '700' }}>{index + 1}</td>
                              <td style={{ padding: '5px 8px', color: '#0f172a', fontWeight: '600' }}>{row.date}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '800', color: '#2563eb' }}>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Right Column Table */}
                    <div style={{ flex: 1 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                            <th style={{ padding: '6px 8px', width: '45px', fontWeight: '800' }}>Sr.</th>
                            <th style={{ padding: '6px 8px', fontWeight: '800' }}>Date</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800' }}>Patients</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.colRight.map((row, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 8px', color: '#64748b', fontWeight: '700' }}>{reportData.colLeft.length + index + 1}</td>
                              <td style={{ padding: '5px 8px', color: '#0f172a', fontWeight: '600' }}>{row.date}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '800', color: '#2563eb' }}>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                  </div>

                  {/* Combined Bottom Summary Bar */}
                  <div style={{ borderTop: '2px solid #cbd5e1', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                      Grand Total Patients Seen:
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a' }}>
                      {reportData.totalVisitsCount}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* VIEW: DASHBOARD */}
      {currentView === 'dashboard' && (
        <div className="no-print" style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Clinical Overview</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Real-time statistics for {doctorProfile.doctorName}</p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setPatientForm({ name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', medicalHistory: '', address: '' });
                    setShowAddPatientModal(true);
                  }}
                  style={{
                    background: '#2563eb', color: '#fff', padding: '10px 18px', borderRadius: '8px', border: 'none',
                    fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  <Plus size={18} /> Register Patient
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Total Patients</span>
                  <Users size={18} color="#2563eb" />
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{patients.length}</h3>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>In Cloud Database</span>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Today's Checkups</span>
                  <Activity size={18} color="#059669" />
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{todayVisits.length}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Seen today ({todayStr})</span>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Hospital Encounters</span>
                  <Hospital size={18} color="#1d4ed8" />
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{hospitalVisits.length}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Morning Session</span>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Clinic Encounters</span>
                  <Building2 size={18} color="#d97706" />
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{clinicVisits.length}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Evening Session</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Recent Medical Consultations</h3>
                  <button 
                    onClick={() => setCurrentView('records')}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View All Directory <ArrowUpRight size={15} />
                  </button>
                </div>

                {allVisits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No consultation history recorded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[...allVisits].reverse().slice(0, 5).map((visit, index) => (
                      <div 
                        key={index}
                        onClick={() => {
                          const p = patients.find(pat => pat.id === visit.patientId);
                          if (p) {
                            setSelectedPatient(p);
                            setCurrentView('records');
                          }
                        }}
                        style={{
                          padding: '14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{visit.patientName}</span>
                            <span style={{
                              fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700',
                              background: visit.location === 'Hospital' ? '#dbeafe' : '#dcfce7',
                              color: visit.location === 'Hospital' ? '#1e40af' : '#166534'
                            }}>
                              {visit.location}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}><strong>Diagnosis:</strong> {visit.diagnosis}</p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                          <div>{visit.date}</div>
                          <span style={{ color: '#2563eb', fontWeight: '600' }}>{visit.medicines?.length || 0} Meds prescribed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '22px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>Quick Patient Access</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {patients.slice(0, 6).map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setCurrentView('records');
                      }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px',
                        borderRadius: '6px', border: '1px solid #f1f5f9', cursor: 'pointer', background: '#fff'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.gender}, {p.age} yrs • {p.phone}</div>
                      </div>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700' }}>Open &rarr;</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: PATIENT DIRECTORY */}
      {currentView === 'records' && (
        <div className="no-print" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '360px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <button
                onClick={() => {
                  setPatientForm({ name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', medicalHistory: '', address: '' });
                  setShowAddPatientModal(true);
                }}
                style={{
                  width: '100%', background: '#2563eb', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none',
                  fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', cursor: 'pointer', marginBottom: '12px'
                }}
              >
                <Plus size={18} /> Add New Patient
              </button>

              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {['All', 'Hospital', 'Clinic'].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setFilterLocation(loc)}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: filterLocation === loc ? '#e2e8f0' : '#f8fafc', color: filterLocation === loc ? '#0f172a' : '#64748b'
                    }}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredPatients.map(patient => {
                const isSelected = selectedPatient?.id === patient.id;
                return (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    style={{
                      padding: '14px 18px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{patient.name}</h4>
                        <span style={{
                          fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700',
                          background: patient.registeredAt === 'Hospital' ? '#dbeafe' : '#dcfce7',
                          color: patient.registeredAt === 'Hospital' ? '#1e40af' : '#166534'
                        }}>
                          {patient.registeredAt}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {patient.gender}, {patient.age} yrs • {patient.phone}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeletePatient(patient.id, patient.name, e)}
                      style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '6px' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
            {selectedPatient ? (
              <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{selectedPatient.name}</h2>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                          {selectedPatient.gender}, {selectedPatient.age} Years Old
                        </span>
                        {selectedPatient.bloodGroup && (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                            🩸 {selectedPatient.bloodGroup}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '18px', marginTop: '12px', color: '#64748b', fontSize: '13px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                          <Phone size={15} color="#2563eb" /> {selectedPatient.phone}
                        </span>
                        {selectedPatient.address && <span>📍 {selectedPatient.address}</span>}
                      </div>

                      <div style={{ marginTop: '14px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={16} color="#dc2626" />
                        <span style={{ fontSize: '13px', color: '#991b1b' }}>
                          <strong>Medical History / Known Allergies:</strong> {selectedPatient.medicalHistory || 'None registered'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setPatientForm(selectedPatient); setShowEditPatientModal(true); }}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}
                      >
                        <Edit3 size={15} /> Edit Patient
                      </button>
                      <button
                        onClick={() => setShowAddVisitModal(true)}
                        style={{ background: '#059669', color: '#fff', padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}
                      >
                        <Plus size={18} /> New Visit & Prescription
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', marginBottom: '14px' }}>
                    Consultation History & Prescriptions ({selectedPatient.visits ? selectedPatient.visits.length : 0})
                  </h3>

                  {(!selectedPatient.visits || selectedPatient.visits.length === 0) ? (
                    <div style={{ background: '#fff', padding: '48px', textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                      <Activity size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <p>No visits recorded yet. Click <strong>"New Visit & Prescription"</strong> to record today's checkup.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {[...selectedPatient.visits].reverse().map((visit) => (
                        <div key={visit.id} style={{ background: '#fff', padding: '22px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '800',
                                background: visit.location === 'Hospital' ? '#dbeafe' : '#dcfce7',
                                color: visit.location === 'Hospital' ? '#1e40af' : '#166534'
                              }}>
                                {visit.location === 'Hospital' ? '🏥 Hospital Consultation' : '🏢 Clinic Consultation'}
                              </span>
                              <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
                                <Calendar size={14} /> {visit.date}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                onClick={() => triggerPrint(visit)}
                                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Printer size={14} /> Print Rx
                              </button>
                              <button
                                onClick={() => handleDeleteVisit(visit.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {visit.vitals && Object.values(visit.vitals).some(v => v !== '') && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
                              {visit.vitals.bp && <span style={{ fontSize: '12px', color: '#475569' }}><strong>BP:</strong> {visit.vitals.bp} mmHg</span>}
                              {visit.vitals.pulse && <span style={{ fontSize: '12px', color: '#475569' }}><strong>Pulse:</strong> {visit.vitals.pulse} bpm</span>}
                              {visit.vitals.temp && <span style={{ fontSize: '12px', color: '#475569' }}><strong>Temp:</strong> {visit.vitals.temp} °F</span>}
                              {visit.vitals.weight && <span style={{ fontSize: '12px', color: '#475569' }}><strong>Weight:</strong> {visit.vitals.weight} kg</span>}
                              {visit.vitals.sugar && <span style={{ fontSize: '12px', color: '#475569' }}><strong>RBS:</strong> {visit.vitals.sugar} mg/dL</span>}
                            </div>
                          )}

                          <div style={{ marginBottom: '14px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Diagnosis</h4>
                            <p style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>{visit.diagnosis}</p>
                            {visit.notes && (
                              <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px', background: '#fffbeb', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                                <strong>Notes:</strong> {visit.notes}
                              </p>
                            )}
                          </div>

                          {visit.medicines && visit.medicines.length > 0 && (
                            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <h5 style={{ fontSize: '13px', fontWeight: '800', color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Pill size={15} color="#2563eb" /> Prescribed Medications:
                              </h5>
                              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '8px' }}>Medicine</th>
                                    <th style={{ padding: '8px' }}>Dosage</th>
                                    <th style={{ padding: '8px' }}>Duration</th>
                                    <th style={{ padding: '8px' }}>Instructions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visit.medicines.map((m, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '8px', fontWeight: '700', color: '#1e293b' }}>{m.name}</td>
                                      <td style={{ padding: '8px', color: '#059669', fontWeight: '600' }}>{m.dosage}</td>
                                      <td style={{ padding: '8px', color: '#475569' }}>{m.duration}</td>
                                      <td style={{ padding: '8px', color: '#64748b' }}>{m.instructions}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '120px', color: '#94a3b8' }}>
                <User size={56} style={{ opacity: 0.2, marginBottom: '14px' }} />
                <h3>No Patient Selected</h3>
                <p style={{ fontSize: '14px', marginTop: '6px' }}>Pick a patient from the left directory or register a new one.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: New Visit */}
      {showAddVisitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '16px', width: '740px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>
              New Consultation for {selectedPatient?.name}
            </h3>

            <form onSubmit={handleAddVisit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Consultation Place</label>
                  <input
                    type="text"
                    disabled
                    value={currentWorkplace === 'Hospital' ? doctorProfile.hospitalName : doctorProfile.clinicName}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#f8fafc', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <HeartPulse size={15} color="#dc2626" /> Patient Vitals (Optional)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  <input type="text" placeholder="BP (120/80)" value={vitals.bp} onChange={e => setVitals({...vitals, bp: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <input type="text" placeholder="Pulse (72 bpm)" value={vitals.pulse} onChange={e => setVitals({...vitals, pulse: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <input type="text" placeholder="Temp (98.6 F)" value={vitals.temp} onChange={e => setVitals({...vitals, temp: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <input type="text" placeholder="Weight (kg)" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <input type="text" placeholder="Sugar (mg/dL)" value={vitals.sugar} onChange={e => setVitals({...vitals, sugar: e.target.value})} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Chief Problem & Diagnosis *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Upper Respiratory Tract Infection"
                  value={visitDiagnosis}
                  onChange={e => setVisitDiagnosis(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Doctor's Clinical Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Advised complete bed rest for 3 days..."
                  value={visitNotes}
                  onChange={e => setVisitNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Prescription (Rx)</label>
                  <button
                    type="button"
                    onClick={addMedicineRow}
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    + Add Medicine
                  </button>
                </div>

                {medicines.map((med, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Medicine Name (e.g. Panadol 500mg)"
                      value={med.name}
                      onChange={e => updateMedicine(index, 'name', e.target.value)}
                      style={{ flex: 2.2, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <select
                      value={med.dosage}
                      onChange={e => updateMedicine(index, 'dosage', e.target.value)}
                      style={{ flex: 1.2, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="1-0-1">1-0-1 (BD)</option>
                      <option value="1-1-1">1-1-1 (TDS)</option>
                      <option value="1-0-0">1-0-0 (Morning)</option>
                      <option value="0-0-1">0-0-1 (Night)</option>
                      <option value="SOS">SOS (As needed)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Duration"
                      value={med.duration}
                      onChange={e => updateMedicine(index, 'duration', e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <select
                      value={med.instructions}
                      onChange={e => updateMedicine(index, 'instructions', e.target.value)}
                      style={{ flex: 1.4, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="After Meals">After Meals</option>
                      <option value="Before Meals">Before Meals</option>
                      <option value="Empty Stomach">Empty Stomach</option>
                      <option value="At Bedtime">At Bedtime</option>
                    </select>
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicineRow(index)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddVisitModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save Consultation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Patient Form */}
      {(showAddPatientModal || showEditPatientModal) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: '26px', borderRadius: '16px', width: '480px', maxWidth: '92%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px' }}>
              {showEditPatientModal ? 'Edit Patient Information' : 'Register New Patient'}
            </h3>
            <form onSubmit={showEditPatientModal ? handleUpdatePatient : handleAddPatient} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Full Name *"
                required
                value={patientForm.name}
                onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                required
                value={patientForm.phone}
                onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  placeholder="Age"
                  value={patientForm.age}
                  onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <select
                  value={patientForm.gender}
                  onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Blood (e.g. O+)"
                  value={patientForm.bloodGroup}
                  onChange={e => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                  style={{ width: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <input
                type="text"
                placeholder="City / Area Address"
                value={patientForm.address || ''}
                onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <textarea
                placeholder="Known Allergies / Chronic Medical History"
                rows="3"
                value={patientForm.medicalHistory}
                onChange={e => setPatientForm({ ...patientForm, medicalHistory: e.target.value })}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddPatientModal(false); setShowEditPatientModal(false); }}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LETTERHEAD PRESCRIPTION (PRINT ONLY) */}
      {printVisit && (
        <div className="print-only" style={{ padding: '36px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #1e3a8a', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              {doctorProfile.logoUrl && (
                <img src={doctorProfile.logoUrl} alt="Clinic Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
              )}
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a8a', margin: 0 }}>{doctorProfile.doctorName}</h1>
                <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '2px 0', color: '#334155' }}>{doctorProfile.qualifications}</p>
                <p style={{ fontSize: '12px', margin: 0, color: '#475569' }}>{doctorProfile.specialization} • Reg #{doctorProfile.registrationNo}</p>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '12px', color: '#334155' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 4px', color: '#1e3a8a' }}>
                {printVisit.location === 'Hospital' ? doctorProfile.hospitalName : doctorProfile.clinicName}
              </h3>
              <p style={{ margin: '2px 0' }}>{doctorProfile.clinicAddress}</p>
              <p style={{ margin: '2px 0' }}><strong>Tel:</strong> {doctorProfile.contactNumber}</p>
            </div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <div>
              <p style={{ margin: '2px 0' }}><strong>Patient Name:</strong> {selectedPatient?.name}</p>
              <p style={{ margin: '2px 0' }}><strong>Age / Gender:</strong> {selectedPatient?.age} yrs / {selectedPatient?.gender}</p>
            </div>
            <div>
              <p style={{ margin: '2px 0' }}><strong>Date:</strong> {printVisit.date}</p>
              <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {selectedPatient?.phone}</p>
            </div>
            <div>
              <p style={{ margin: '2px 0' }}><strong>Blood Group:</strong> {selectedPatient?.bloodGroup || 'N/A'}</p>
              <p style={{ margin: '2px 0' }}><strong>Facility:</strong> {printVisit.location}</p>
            </div>
          </div>

          {printVisit.vitals && Object.values(printVisit.vitals).some(v => v !== '') && (
            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '16px', fontSize: '12px', color: '#334155' }}>
              {printVisit.vitals.bp && <span><strong>BP:</strong> {printVisit.vitals.bp} mmHg</span>}
              {printVisit.vitals.pulse && <span><strong>Pulse:</strong> {printVisit.vitals.pulse} bpm</span>}
              {printVisit.vitals.temp && <span><strong>Temp:</strong> {printVisit.vitals.temp} °F</span>}
              {printVisit.vitals.weight && <span><strong>Weight:</strong> {printVisit.vitals.weight} kg</span>}
              {printVisit.vitals.sugar && <span><strong>Sugar:</strong> {printVisit.vitals.sugar} mg/dL</span>}
            </div>
          )}

          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a', borderBottom: '1px solid #94a3b8', paddingBottom: '4px', textTransform: 'uppercase' }}>
              Clinical Diagnosis & Findings
            </h3>
            <p style={{ fontSize: '14px', marginTop: '6px', fontWeight: 'bold' }}>{printVisit.diagnosis}</p>
            {printVisit.notes && <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>Advice / Notes: {printVisit.notes}</p>}
          </div>

          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'serif', color: '#1e3a8a', marginBottom: '6px' }}>℞</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1e3a8a', textAlign: 'left', color: '#1e3a8a' }}>
                  <th style={{ padding: '8px 6px' }}>Medicine Name</th>
                  <th style={{ padding: '8px 6px' }}>Dosage (Routine)</th>
                  <th style={{ padding: '8px 6px' }}>Duration</th>
                  <th style={{ padding: '8px 6px' }}>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {printVisit.medicines?.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>{i + 1}. {m.name}</td>
                    <td style={{ padding: '8px 6px', color: '#059669', fontWeight: 'bold' }}>{m.dosage}</td>
                    <td style={{ padding: '8px 6px' }}>{m.duration}</td>
                    <td style={{ padding: '8px 6px' }}>{m.instructions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '90px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Generated electronically via Doctor's Cloud Health Records.
            </div>
            <div style={{ textAlign: 'center', width: '220px', borderTop: '1px solid #000', paddingTop: '6px', fontSize: '12px' }}>
              <strong>{doctorProfile.doctorName}</strong>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Authorized Signature</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}