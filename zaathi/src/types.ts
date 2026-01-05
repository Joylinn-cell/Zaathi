
export type Language = 'en' | 'ml' | 'hi' | 'ta' | 'kn';

export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
}

export interface Medicine {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  schedule: string;
  stock: number;
}

export interface Reminder {
  id: string;
  patientId: string;
  task: string;
  time: string;
  completed: boolean;
}

export interface DoctorNote {
  id: string;
  patientId: string;
  note: string;
  timestamp: Date;
}

export interface Alert {
  id: string;
  type: 'critical' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  sourceId?: string;
  sourceType?: 'medicine' | 'reminder';
}

export enum Page {
  Home = 'home',
  Patients = 'patients',
  Medicines = 'medicines',
  Alerts = 'alerts',
  DoctorNotes = 'doctor',
  Assistant = 'assistant'
}
