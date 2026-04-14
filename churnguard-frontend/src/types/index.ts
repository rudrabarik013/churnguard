// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'admin' | 'manager';
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export interface KPIData {
  total_customers: number;
  churn_rate: number;
  churned_customers: number;
  retained_customers: number;
  revenue_at_risk: number;
  avg_balance_churned: number;
  avg_balance_retained: number;
}

export interface Insight {
  icon: string;
  text: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface ChurnDistribution {
  exited: number;
  retained: number;
}

export interface GeoData {
  geography: string;
  total: number;
  churned: number;
  churn_rate: number;
}

export interface DemographicsData {
  gender: { gender: string; total: number; churned: number; churn_rate: number }[];
  age_groups: { age_group: string; total: number; churned: number; churn_rate: number }[];
}

export interface ProductsActivityData {
  products:    { num_of_products: string; total: number; churned: number; churn_rate: number }[];
  activity:    { member_status: string; total: number; churned: number; churn_rate: number }[];
  credit_card: { card_status: string; total: number; churned: number; churn_rate: number }[];
}

export interface FinancialsData {
  balance_buckets:      { bucket: string; total: number; churned: number; churn_rate: number }[];
  credit_score_buckets: { bucket: string; total: number; churned: number; churn_rate: number }[];
  salary_buckets:       { bucket: string; total: number; churned: number; churn_rate: number }[];
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ModelMetrics {
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  is_best: boolean;
}

// ── Retention ─────────────────────────────────────────────────────────────────
export interface RetentionSegment {
  id: number;
  name: string;
  size: number;
  churn_rate: number;
  priority: string;
  ease: number;
  impact: number;
  strategy: string;
  tactics: string[];
  expected_reduction: string;
  revenue_at_risk: number;
}

// ── Simulation ────────────────────────────────────────────────────────────────
export interface ScenarioInfo {
  key: string;
  label: string;
  description: string;
}

export interface SimulationResult {
  scenario_name: string;
  churn_before: number;
  churn_after: number;
  customers_affected: number;
  revenue_impact: number;
  precision?: number;
  recall?: number;
}

// ── Prediction ────────────────────────────────────────────────────────────────
export interface SinglePredictionRequest {
  credit_score: number;
  geography: string;
  gender: string;
  age: number;
  tenure: number;
  balance: number;
  num_of_products: number;
  has_cr_card: boolean;
  is_active_member: boolean;
  estimated_salary: number;
}

export interface PredictionResult {
  churn_probability: number;
  risk_level: 'High' | 'Medium' | 'Low';
  top_risk_factors: string[];
  model_used: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}
