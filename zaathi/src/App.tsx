import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Page, Language, Patient, Medicine, Alert, Reminder, DoctorNote } from './types';
import { TRANSLATIONS, VOICE_MESSAGES } from './constants';
import { geminiService } from './services/geminiService';

// Refactored Components
import Layout from './components/Layout';
import AlarmModal from './components/AlarmModal';
import GlobalAlert from './components/GlobalAlert';
import VoiceAssistant from './components/VoiceAssistant';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(Page.Home);
  const [lang, setLang] = useState<Language>('en');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlertModal, setActiveAlertModal] = useState<Alert | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  
  const [selectedMedForAlert, setSelectedMedForAlert] = useState<Medicine | null>(null);
  const [currentSummary, setCurrentSummary] = useState<{ patientId: string, notes: DoctorNote[], timestamp: string } | null>(null);
  
  const t = TRANSLATIONS[lang];

  // ✅ Load all data from backend on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // Load Patients
        const patientsRes = await fetch('http://localhost:8080/api/patients');
        if (patientsRes.ok) {
          const patientsData = await patientsRes.json();
          setPatients(patientsData);
          console.log("✅ Loaded patients:", patientsData);
        }

        // Load Medicines
        const medicinesRes = await fetch('http://localhost:8080/api/medicines');
        if (medicinesRes.ok) {
          const medicinesData = await medicinesRes.json();
          setMedicines(medicinesData);
          console.log("✅ Loaded medicines:", medicinesData);
        }

        // Load Reminders
        const remindersRes = await fetch('http://localhost:8080/api/reminders');
        if (remindersRes.ok) {
          const remindersData = await remindersRes.json();
          setReminders(remindersData);
          console.log("✅ Loaded reminders:", remindersData);
        }

        // Load Doctor Notes
        const notesRes = await fetch('http://localhost:8080/api/doctornotes');
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          const notesWithDates = notesData.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp)
          }));
          setDoctorNotes(notesWithDates);
          console.log("✅ Loaded doctor notes:", notesWithDates);
        }

        // Load Alerts
        const alertsRes = await fetch('http://localhost:8080/api/alerts');
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          const alertsWithDates = alertsData.map((alert: any) => ({
            ...alert,
            timestamp: new Date(alert.timestamp)
          }));
          setAlerts(alertsWithDates);
          console.log("✅ Loaded alerts:", alertsWithDates);
        }

      } catch (error) {
        console.error("❌ Error loading data:", error);
      }
    };

    loadAllData();
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const triggerBrowserNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Zaathi: ${title}`, { body, icon: "/favicon.ico" });
    }
  };

  const addAlert = useCallback((title: string, message: string, type: 'critical' | 'info' = 'info', sourceId?: string, sourceType?: 'medicine' | 'reminder') => {
      const newAlert: Alert = {
        id: Date.now().toString(),
        title,
        message,
        type,
        timestamp: new Date(),
        sourceId,
        sourceType
      };
      setAlerts(prev => [newAlert, ...prev]);
      setActiveAlertModal(newAlert);
      triggerBrowserNotification(title, message);
    }, []);


  const handleVoiceGuide = async (section: string) => {
    await geminiService.warmUp();
    if (isSpeaking) return;
    setIsSpeaking(true);
    const message = VOICE_MESSAGES[lang][section] || VOICE_MESSAGES['en'][section];
    await geminiService.speak(message);
    setIsSpeaking(false);
  };

  const handleAddPatient = async (name: string, age: number, condition: string) => {
      const newPatient = { id: Date.now().toString(), name, age, condition };

      console.log("🚀 Sending to backend:", newPatient);

      try {
        const response = await fetch('http://localhost:8080/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPatient)
        });

        console.log("📡 Response status:", response.status);
        const data = await response.json();
        console.log("📦 Response data:", data);

        if (response.ok) {
          setPatients(prev => [...prev, newPatient]);
          geminiService.speak(VOICE_MESSAGES[lang].successPatient);
        } else {
          console.error("❌ Failed to save patient");
        }
      } catch (error) {
        console.error("❌ Error:", error);
      }
    };

  // ✅ Updated to delete from backend
  const handleDeletePatient = async (id: string) => {
    const p = patients.find(x => x.id === id);
    
    try {
      const response = await fetch(`http://localhost:8080/api/patients/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPatients(prev => prev.filter(p => p.id !== id));
        if (p) geminiService.speak(`${p.name} removed.`);
        console.log("✅ Deleted patient:", id);
      } else {
        console.error("❌ Failed to delete patient");
      }
    } catch (error) {
      console.error("❌ Error deleting patient:", error);
    }
  };

    const handleAddMedicine = async (pId: string, name: string, dosage: string, schedule: string, stock: number) => {
        const newMed = { id: Date.now().toString(), patientId: pId, name, dosage, schedule, stock };

        console.log("💊 Sending medicine to backend:", newMed);

        try {
          const response = await fetch('http://localhost:8080/api/medicines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMed)
          });

          console.log("📡 Medicine response status:", response.status);

          if (response.ok) {
            const data = await response.json();
            console.log("📦 Medicine saved:", data);
            setMedicines(prev => [...prev, newMed]);
            geminiService.speak(VOICE_MESSAGES[lang].successMedicine);
          } else {
            console.error("❌ Failed to save medicine, status:", response.status);
            const errorText = await response.text();
            console.error("❌ Error details:", errorText);
          }
        } catch (error) {
          console.error("❌ Error saving medicine:", error);
        }
      };

      const handleDeleteMedicine = async (id: string) => {
        try {
          const response = await fetch(`http://localhost:8080/api/medicines/${id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            setMedicines(prev => prev.filter(m => m.id !== id));
          }
        } catch (error) {
          console.error("Error deleting medicine:", error);
        }
      };


    const handleAddDoctorNote = async (pId: string, note: string) => {
      // Create the note object to send to backend
      const newNote = {
        patientId: pId,
        note: note
      };

      console.log("📋 Sending doctor note to backend:", newNote);

      try {
        const response = await fetch('http://localhost:8080/api/doctornotes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'  // Added this
          },
          body: JSON.stringify(newNote)
        });

        console.log("📡 Doctor note response status:", response.status);

        if (response.ok) {
          const savedNote = await response.json();
          console.log("📦 Doctor note saved from backend:", savedNote);

          // ✅ Create the note with proper Date object
          const noteWithDate: DoctorNote = {
            id: savedNote.id,
            patientId: savedNote.patientId,
            note: savedNote.note,
            timestamp: new Date(savedNote.timestamp) // Convert string to Date
          };

          console.log("✅ Adding note to state:", noteWithDate);

          // ✅ Update state with the new note
          setDoctorNotes(prev => [noteWithDate, ...prev]);

          // ✅ Voice feedback
          const p = patients.find(x => x.id === pId);
          const feedback = `${VOICE_MESSAGES[lang].successNote} for ${p?.name || 'patient'}`;
          geminiService.speak(feedback);

          console.log("✅ Doctor note successfully saved!");
        } else {
          console.error("❌ Failed to save doctor note, status:", response.status);
          const errorText = await response.text();
          console.error("❌ Error details:", errorText);

          // Optional: Show error to user
          alert("Failed to save doctor note. Please try again.");
        }
      } catch (error) {
        console.error("❌ Error saving doctor note:", error);

        // Optional: Show error to user
        alert("Network error. Please check your connection and try again.");
      }
    };
    const handleShowSummary = (pId: string) => {
      const patient = patients.find(p => p.id === pId);
      if (!patient) return;

      const notes = doctorNotes.filter(n => n.patientId === pId).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());

      setCurrentSummary({
        patientId: pId,
        notes: notes,
        timestamp: new Date().toLocaleString()
      });

      geminiService.speak(VOICE_MESSAGES[lang].reportReady);
    };

    const handleAddReminder = async (pId: string, task: string, time: string) => {
        const newReminder: Reminder = { id: Date.now().toString(), patientId: pId, task, time, completed: false };

        console.log("⏰ Sending reminder to backend:", newReminder);

        try {
          const response = await fetch('http://localhost:8080/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newReminder)
          });

          console.log("📡 Reminder response status:", response.status);

          if (response.ok) {
            const data = await response.json();
            console.log("📦 Reminder saved:", data);
            setReminders(prev => [...prev, newReminder]);
            geminiService.speak(VOICE_MESSAGES[lang].successReminder);
            setSelectedMedForAlert(null);
          } else {
            console.error("❌ Failed to save reminder");
          }
        } catch (error) {
          console.error("❌ Error saving reminder:", error);
        }
      };

      const handleAlertTaken = (alert: Alert) => {
        if (alert.sourceType === 'medicine' && alert.sourceId) {
          setMedicines(prev => prev.map(m =>
            m.id === alert.sourceId ? { ...m, stock: Math.max(0, m.stock - 1) } : m
          ));
          geminiService.speak(VOICE_MESSAGES[lang].actionTaken || 'Marked as taken.');
        } else if (alert.sourceType === 'reminder' && alert.sourceId) {
          setReminders(prev => prev.map(r =>
            r.id === alert.sourceId ? { ...r, completed: true } : r
          ));
          geminiService.speak(VOICE_MESSAGES[lang].actionTaken || 'Marked as completed.');
        }
        setActiveAlertModal(null);
      };



      const handleAlertSnooze = (alert: Alert) => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        const snoozeTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (alert.sourceType === 'medicine' && alert.sourceId) {
          const med = medicines.find(m => m.id === alert.sourceId);
          if (med) {
            handleAddReminder(med.patientId, `SNOOZE: ${med.name} dose`, snoozeTime);
          }
        } else if (alert.sourceType === 'reminder' && alert.sourceId) {
          const rem = reminders.find(r => r.id === alert.sourceId);
          if (rem) {
            handleAddReminder(rem.patientId, `SNOOZE: ${rem.task}`, snoozeTime);
          }
        }
        geminiService.speak(VOICE_MESSAGES[lang].actionSnoozed || 'Snoozed for 5 minutes.');
        setActiveAlertModal(null);
      };

      const handleAlertReschedule = (alert: Alert, newTime: string) => {
        if (alert.sourceType === 'medicine' && alert.sourceId) {
          setMedicines(prev => prev.map(m =>
            m.id === alert.sourceId ? { ...m, schedule: newTime } : m
          ));
        } else if (alert.sourceType === 'reminder' && alert.sourceId) {
          setReminders(prev => prev.map(r =>
            r.id === alert.sourceId ? { ...r, time: newTime } : r
          ));
        }
        geminiService.speak(VOICE_MESSAGES[lang].actionRescheduled || 'Rescheduled.');
        setActiveAlertModal(null);
      };




    useEffect(() => {
      const interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        medicines.forEach(async (med) => {
          // Check if medicine is due
          if (med.schedule === currentTime) {
            const patient = patients.find(p => p.id === med.patientId);
            const patientName = patient?.name || 'patient';
            const alertMsg = `${med.name} dose for ${patientName} is due now.`;

            // Add alert
            addAlert(t.alerts.upcoming, alertMsg, 'info', med.id, 'medicine');
            geminiService.speak(`${VOICE_MESSAGES[lang].doseDue} ${med.name} for ${patientName}.`);
          }

          // Check if stock is low
          if (med.stock < 5) {
            const alreadyAlerted = alerts.some(a =>
              a.sourceId === med.id &&
              a.type === 'critical' &&
              a.message.includes('stock is low')
            );

            if (!alreadyAlerted) {
              const alertMsg = `${med.name} stock is low (${med.stock}).`;
              addAlert(t.alerts.critical, alertMsg, 'critical', med.id, 'medicine');
              geminiService.speak(`${VOICE_MESSAGES[lang].lowStock} ${med.name}.`);
            }
          }
        });

        reminders.forEach(async (rem) => {
          if (rem.time === currentTime && !rem.completed) {
            const patient = patients.find(p => p.id === rem.patientId);
            const patientName = patient?.name || 'patient';
            const alertMsg = `${rem.task} for ${patientName}`;

            // Add alert
            addAlert(t.alerts.reminder, alertMsg, 'info', rem.id, 'reminder');
            geminiService.speak(`${VOICE_MESSAGES[lang].alertTriggered} ${rem.task} for ${patientName}.`);

            // Update reminder as completed in backend
            try {
              const response = await fetch(`http://localhost:8080/api/reminders/${rem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...rem, completed: true })
              });

              if (response.ok) {
                setReminders(prev => prev.map(r =>
                  r.id === rem.id ? { ...r, completed: true } : r
                ));
                console.log("✅ Reminder marked as completed:", rem.id);
              }
            } catch (error) {
              console.error("❌ Error updating reminder:", error);
              // Still update frontend even if backend fails
              setReminders(prev => prev.map(r =>
                r.id === rem.id ? { ...r, completed: true } : r
              ));
            }
          }
        });
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }, [medicines, reminders, addAlert, alerts, t.alerts, patients, lang]);



  return (
    <Layout 
      lang={lang} 
      onLangChange={l => { setLang(l); geminiService.warmUp(); }} 
      onLogoClick={() => setActivePage(Page.Home)}
      onAssistantClick={() => setIsVoiceAssistantOpen(true)}
      activePage={activePage}
    >
      {/* Rest of your JSX remains exactly the same... */}
      {activePage === Page.Home && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard value={patients.length} label={t.stats.patients} color="bg-indigo-600" icon="👥" />
            <StatCard value={medicines.length} label={t.stats.medicines} color="bg-indigo-500" icon="💊" />
            <StatCard value={reminders.length + alerts.length} label={t.stats.alerts} color="bg-emerald-600" icon="⏰" />
            <StatCard value={doctorNotes.length} label={t.nav.doctor} color="bg-blue-600" icon="📋" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <NavCard icon="👤" title={t.nav.patients} desc={t.nav.patientsDesc} onClick={() => setActivePage(Page.Patients)} color="hover:border-indigo-200" />
            <NavCard icon="💊" title={t.nav.medicines} desc={t.nav.medicinesDesc} onClick={() => setActivePage(Page.Medicines)} color="hover:border-blue-200" />
            <NavCard icon="🔔" title={t.nav.alerts} desc={t.nav.alertsDesc} onClick={() => setActivePage(Page.Alerts)} color="hover:border-rose-200" />
            <NavCard icon="📋" title={t.nav.doctor} desc={t.nav.doctorDesc} onClick={() => setActivePage(Page.DoctorNotes)} color="hover:border-blue-300" />
            <NavCard icon="🤖" title={t.nav.assistant} desc={t.nav.assistantDesc} onClick={() => setIsVoiceAssistantOpen(true)} color="hover:border-emerald-200" />
          </div>
        </div>
      )}

      {activePage === Page.Patients && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 max-w-4xl mx-auto">
                <BackButton onClick={() => setActivePage(Page.Home)} label={t.forms.back} />
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900">👤 {t.nav.patients}</h2>
                  <VoiceButton active={isSpeaking} onClick={() => handleVoiceGuide('patients')} label={t.voice.guide} />
                </div>
                <form onSubmit={e => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleAddPatient(fd.get('name') as string, Number(fd.get('age')), fd.get('condition') as string);
                  e.currentTarget.reset();
                }} className="space-y-6 mb-12 bg-slate-50 p-8 rounded-3xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input name="name" label={t.forms.patientName} />
                    <Input name="age" label={t.forms.age} type="number" />
                  </div>
                  <Textarea name="condition" label={t.forms.condition} />
                  <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition">
                    {t.forms.addPatient}
                  </button>
                </form>
                <div className="grid grid-cols-1 gap-4">
                  {patients.map(p => (
                    <ListItem key={p.id} title={p.name} subtitle={`${t.forms.age}: ${p.age} • ${p.condition}`} onDelete={() => handleDeletePatient(p.id)} />
                  ))}
                </div>
              </div>
            )}

            {activePage === Page.Medicines && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 max-w-4xl mx-auto">
                <BackButton onClick={() => setActivePage(Page.Home)} label={t.forms.back} />
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900">💊 {t.nav.medicines}</h2>
                  <VoiceButton active={isSpeaking} onClick={() => handleVoiceGuide('medicines')} label={t.voice.guide} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
                  <form onSubmit={e => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    handleAddMedicine(fd.get('pId') as string, fd.get('name') as string, fd.get('dosage') as string, fd.get('schedule') as string, Number(fd.get('stock')));
                    e.currentTarget.reset();
                  }} className="lg:col-span-3 space-y-6 bg-slate-50 p-8 rounded-3xl h-fit">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t.forms.forPatient}</label>
                        <select name="pId" required className="w-full px-5 py-3 rounded-xl border bg-white outline-none font-medium">
                          <option value="">{t.forms.selectPatient}</option>
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <Input name="name" label={t.forms.medicineName} />
                      <Input name="dosage" label={t.forms.dosage} />
                      <Input name="schedule" label={t.forms.schedule} type="time" />
                      <Input name="stock" label={t.forms.stock} type="number" />
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition">
                      {t.forms.addMedicine}
                    </button>
                  </form>

                  <div className={`lg:col-span-2 bg-indigo-50 p-8 rounded-3xl border border-indigo-100 transition-opacity ${selectedMedForAlert ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                    <h3 className="text-lg font-bold text-indigo-900 mb-4">⏰ {t.forms.setMedAlert}</h3>
                    {selectedMedForAlert && <p className="text-sm font-semibold text-indigo-700 mb-4">{selectedMedForAlert.name} ({patients.find(p=>p.id===selectedMedForAlert.patientId)?.name})</p>}
                    <form onSubmit={e => {
                      e.preventDefault();
                      if(!selectedMedForAlert) return;
                      const fd = new FormData(e.currentTarget);
                      handleAddReminder(
                        selectedMedForAlert.patientId,
                        `Medicine: ${selectedMedForAlert.name} (${selectedMedForAlert.dosage})`,
                        fd.get('time') as string
                      );
                      e.currentTarget.reset();
                    }} className="space-y-4">
                       <Input name="time" label={t.forms.time} type="time" />
                       <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700">
                         {t.forms.submitAlert}
                       </button>
                       <button type="button" onClick={() => setSelectedMedForAlert(null)} className="w-full text-indigo-600 font-bold text-sm">Cancel</button>
                    </form>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {medicines.map(m => (
                    <div key={m.id} className="p-6 bg-white border border-slate-100 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center group shadow-sm hover:shadow-md transition gap-4">
                      <div className="flex-1">
                        <div className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition">
                          {m.name} {m.stock < 5 && <span className="ml-2 text-rose-500 text-xs font-bold uppercase tracking-widest">{t.alerts.critical}</span>}
                        </div>
                        <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                          {patients.find(p=>p.id===m.patientId)?.name} • {t.forms.dosage}: {m.dosage} • Time: {m.schedule} • Stock: {m.stock}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                         <button
                          onClick={() => { setSelectedMedForAlert(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="flex-1 sm:flex-none px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs hover:bg-indigo-200"
                         >
                           ⏰ {t.forms.setMedAlert}
                         </button>
                         <button onClick={() => setMedicines(medicines.filter(x => x.id !== m.id))} className="p-2 text-slate-300 hover:text-rose-500 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePage === Page.Alerts && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 max-w-4xl mx-auto">
                <BackButton onClick={() => setActivePage(Page.Home)} label={t.forms.back} />

                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900">🔔 {t.nav.alerts}</h2>
                  <VoiceButton active={isSpeaking} onClick={() => handleVoiceGuide('alerts')} label={t.voice.guide} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                  <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 flex flex-col gap-4 animate-fadeIn">
                    <h3 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">
                      ⏰ {t.forms.setReminder}
                    </h3>
                    <form onSubmit={e => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      handleAddReminder(fd.get('pId') as string, fd.get('task') as string, fd.get('time') as string);
                      e.currentTarget.reset();
                    }} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-indigo-800">{t.forms.forPatient}</label>
                        <select name="pId" required className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white outline-none font-bold text-sm">
                          <option value="">{t.forms.selectPatient}</option>
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1 text-indigo-800">{t.forms.task}</label>
                        <input name="task" placeholder={lang === 'ml' ? 'ഉദാ: ബിപി പരിശോധിക്കുക' : 'e.g. Check Temperature'} required className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white outline-none font-bold text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1 text-indigo-800">{t.forms.time}</label>
                        <input type="time" name="time" required className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white outline-none font-bold text-sm" />
                      </div>
                      <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-extrabold text-sm shadow-lg hover:bg-indigo-700 transition">
                         {t.forms.submitAlert}
                      </button>
                    </form>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {alerts.length === 0 && reminders.length === 0 ? (
                      <p className="text-center py-20 text-slate-400 font-medium italic">{t.alerts.empty}</p>
                    ) : (
                      <>
                        {reminders.map(r => (
                          <div key={r.id} className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm flex items-center gap-5 hover:border-indigo-100 transition">
                             <div className="text-2xl">⏰</div>
                             <div className="flex-1">
                                <h3 className="font-extrabold text-slate-900">{patients.find(p=>p.id===r.patientId)?.name}</h3>
                                <p className="text-slate-600 font-medium">{r.task} @ {r.time}</p>
                             </div>
                             <button onClick={() => setReminders(reminders.filter(rem => rem.id !== r.id))} className="text-slate-300 hover:text-rose-500 p-2 transition">
                              ✕
                             </button>
                          </div>
                        ))}
                        {alerts.map(a => (
                          <div key={a.id} className={`p-6 rounded-3xl border-l-[6px] shadow-sm flex items-center gap-5 ${a.type === 'critical' ? 'bg-rose-50 border-rose-500' : 'bg-indigo-50 border-indigo-500'}`}>
                            <div className="text-2xl">{a.type === 'critical' ? '⚠️' : 'ℹ️'}</div>
                            <div className="flex-1">
                              <h3 className="font-extrabold text-slate-900">{a.title}</h3>
                              <p className="text-slate-600 font-medium">{a.message}</p>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{a.timestamp.toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activePage === Page.DoctorNotes && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 max-w-5xl mx-auto">
                <BackButton onClick={() => setActivePage(Page.Home)} label={t.forms.back} />

                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-slate-900">📋 {t.nav.doctor}</h2>
                  <VoiceButton active={isSpeaking} onClick={() => handleVoiceGuide('doctor')} label={t.voice.guide} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={e => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      handleAddDoctorNote(fd.get('pId') as string, fd.get('note') as string);
                      e.currentTarget.reset();
                    }} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t.forms.forPatient}</label>
                        <select name="pId" required className="w-full px-5 py-3 rounded-xl border bg-white outline-none font-medium">
                          <option value="">{t.forms.selectPatient}</option>
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <Textarea name="note" label={t.forms.doctorInstruction} placeholder="e.g. Decrease salt intake and check BP daily." required />
                      <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold mt-4 shadow-lg hover:bg-blue-700 transition">
                        {t.forms.saveNote}
                      </button>
                    </form>

                    <div className="space-y-4">
                      {doctorNotes.length === 0 ? (
                        <p className="text-center py-10 text-slate-400 italic">No notes recorded yet.</p>
                      ) : (
                        doctorNotes.map(n => (
                          <div key={n.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                {patients.find(p=>p.id===n.patientId)?.name}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {n.timestamp.toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium text-sm leading-relaxed whitespace-pre-wrap">{n.note}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="bg-slate-100 p-6 rounded-[2rem] border border-slate-200 sticky top-32">
                      <h3 className="text-sm font-extrabold mb-4 uppercase tracking-widest text-slate-500">{t.forms.viewSummary}</h3>
                      <div className="space-y-3">
                        {patients.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleShowSummary(p.id)}
                            className="w-full bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-2xl text-left transition flex justify-between items-center group shadow-sm"
                          >
                            <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-bold group-hover:bg-indigo-100 transition">Report</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Structured Patient Care Report Modal */}
            {currentSummary && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn" onClick={() => setCurrentSummary(null)}>
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-10 pb-4 border-b border-slate-100">
                     <div className="flex justify-between items-start mb-6">
                       <div>
                         <h2 className="text-2xl font-black text-slate-900 mb-1">{t.forms.summaryTitle}</h2>
                         <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Caregiver Copy</p>
                       </div>
                       <button onClick={() => setCurrentSummary(null)} className="text-slate-300 hover:text-slate-600 text-2xl transition">✕</button>
                     </div>

                     <div className="mb-10">
                       <select
                         value={currentSummary.patientId}
                         onChange={(e) => handleShowSummary(e.target.value)}
                         className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-4 py-3 font-bold text-lg outline-none"
                       >
                         {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                     </div>

                     <div className="text-center">
                       <h1 className="text-4xl font-black text-slate-900 capitalize tracking-tight mb-2">
                         {patients.find(p=>p.id===currentSummary.patientId)?.name}
                       </h1>
                       <p className="text-slate-400 text-xs font-bold">{t.forms.generatedOn}: {currentSummary.timestamp}</p>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 space-y-12 print:overflow-visible">
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-900">{t.forms.patientProfile}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-6 rounded-2xl">
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{t.forms.age}</p>
                          <p className="text-xl font-bold text-slate-900">{patients.find(p=>p.id===currentSummary.patientId)?.age}</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl">
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{t.forms.condition}</p>
                          <p className="text-xl font-bold text-slate-900 capitalize">{patients.find(p=>p.id===currentSummary.patientId)?.condition || 'N/A'}</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-900">{t.forms.doctorAdvice}</h3>
                      </div>
                      {currentSummary.notes.length === 0 ? (
                        <p className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl">No clinical notes available for this patient.</p>
                      ) : (
                        <div className="space-y-6">
                          {currentSummary.notes.map((n, idx) => (
                            <div key={n.id} className="bg-yellow-50/50 border-l-4 border-yellow-200 p-8 rounded-2xl italic text-slate-700 leading-relaxed font-medium relative shadow-sm">
                              <span className="absolute top-2 right-4 text-[9px] font-bold text-slate-300 uppercase">{n.timestamp.toLocaleDateString()}</span>
                              {n.note}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-900">{t.forms.medSchedule}</h3>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">{t.forms.medicine}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">{t.forms.dosage}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">{t.forms.time}</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">{t.forms.stock}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {medicines.filter(m => m.patientId === currentSummary.patientId).map(m => (
                              <tr key={m.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-bold text-slate-900">{m.name}</td>
                                <td className="px-6 py-4 text-slate-600 font-medium">{m.dosage}</td>
                                <td className="px-6 py-4 text-slate-600 font-medium text-center">{m.schedule}</td>
                                <td className="px-6 py-4 text-slate-600 font-medium text-right font-mono">{m.stock}</td>
                              </tr>
                            ))}
                            {medicines.filter(m => m.patientId === currentSummary.patientId).length === 0 && (
                              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No medication scheduled</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <div className="p-8 border-t border-slate-100 flex gap-4">
                     <button
                       onClick={() => window.print()}
                       className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-3"
                     >
                       <span>🖨️</span> {t.forms.printReport}
                     </button>
                     <button
                       onClick={() => setCurrentSummary(null)}
                       className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition"
                     >
                       Close
                     </button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setIsVoiceAssistantOpen(true)} className="fixed bottom-8 right-8 w-20 h-20 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-3xl text-white hover:scale-110 active:scale-95 transition-all z-40 pulse-animation">🤖</button>

            <GlobalAlert alerts={alerts} />
            <AlarmModal
              lang={lang}
              alert={activeAlertModal}
              onClose={() => setActiveAlertModal(null)}
              onTaken={handleAlertTaken}
              onSnooze={handleAlertSnooze}
              onReschedule={handleAlertReschedule}
            />
            <VoiceAssistant
              lang={lang} patients={patients} medicines={medicines}
              isOpen={isVoiceAssistantOpen} onClose={() => setIsVoiceAssistantOpen(false)}
              onPatientAdd={handleAddPatient} onPatientDelete={handleDeletePatient}
              onMedicineAdd={handleAddMedicine} onReminderAdd={handleAddReminder}
            />

    </Layout>
  );
};

// All your stateless components remain the same
const StatCard = ({ value, label, color, icon }: any) => (
  <div className={`${color} p-8 rounded-[2rem] text-white shadow-2xl flex items-center justify-between relative group`}>
    <div className="relative z-10">
      <div className="text-5xl font-extrabold mb-1 tracking-tighter">{value}</div>
      <div className="opacity-90 text-sm font-bold uppercase tracking-widest">{label}</div>
    </div>
    <div className="text-7xl opacity-20 absolute -right-4 -bottom-4 transform group-hover:scale-110 transition duration-500">{icon}</div>
  </div>
);

const NavCard = ({ icon, title, desc, onClick, color }: any) => (
  <button onClick={onClick} className={`bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group ${color}`}>
    <div className="text-6xl mb-6 transform group-hover:scale-110 transition duration-300">{icon}</div>
    <h2 className="text-xl font-extrabold text-slate-900 mb-2 leading-tight">{title}</h2>
    <p className="text-slate-400 font-medium text-xs leading-relaxed">{desc}</p>
  </button>
);

const BackButton = ({ onClick, label }: any) => (
  <button onClick={onClick} className="flex items-center gap-2 text-indigo-600 font-extrabold mb-8 transition-all hover:-translate-x-1">← {label}</button>
);

const VoiceButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
    <span>🎤</span> {active ? 'Speaking...' : label}
  </button>
);

const Input = ({ label, ...props }: any) => (
  <div className="w-full">
    <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
    <input required className="w-full px-5 py-3 rounded-xl border border-slate-200 bg-white outline-none transition font-medium focus:border-indigo-500" {...props} />
  </div>
);

const Textarea = ({ label, ...props }: any) => (
  <div className="w-full">
    <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
    <textarea className="w-full px-5 py-3 rounded-xl border border-slate-200 bg-white outline-none transition font-medium focus:border-indigo-500" rows={3} {...props} />
  </div>
);

const ListItem = ({ title, subtitle, onDelete }: any) => (
  <div className="p-6 bg-white border border-slate-100 rounded-3xl flex justify-between items-center group shadow-sm hover:shadow-md transition">
    <div className="flex-1">
      <div className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition">{title}</div>
      <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{subtitle}</div>
    </div>
    <button onClick={onDelete} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition duration-200">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
);


export default App;