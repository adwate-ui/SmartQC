
export interface ProductDetails {
  sku: string;
  name: string;
  material: string;
  estimatedCost: string;
  retailer: string;
  description: string;
  category: string;
  productUrl: string;
  imageUrl?: string;
}

export enum QCStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  NEEDS_INFO = 'NEEDS_INFO'
}

export interface QCFault {
  location: string;
  issue: string;
  severity: 'low' | 'medium' | 'critical';
}

export interface QCSection {
  title: string;
  score: number; // 0-100
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  details: string[]; // Bullet points of observations
}

export interface QCFollowUp {
  required: boolean;
  missingInfo: string;
  suggestedAngles: string[];
}

export interface QCReport {
  id: string;
  timestamp: number;
  status: QCStatus;
  overallScore: number; // 0-100
  summary: string;
  faults: QCFault[]; // Kept for high-level issues
  sections: QCSection[]; // Detailed breakdown
  followUp: QCFollowUp;
  images: string[]; // Base64 of images used in this inspection
  isExpertMode?: boolean;
}

export type ProcessingStatus = 'idle' | 'identifying' | 'analyzing' | 'error';

export interface Product {
  id: string;
  mainImage: string; // Base64
  details: ProductDetails;
  qcReports: QCReport[];
  createdAt: number;
  processingStatus?: ProcessingStatus;
  progress?: number; // 0-100
  error?: string;
}

export type ViewState = 'dashboard' | 'identify' | 'product_detail';

export type AiMode = 'fast' | 'detailed';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}
