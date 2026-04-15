import { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Tabs, Tab,
} from '@mui/material';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import { dashboardApi } from '../services/api';
import type {
  ChurnDistribution, GeoData, DemographicsData,
  ProductsActivityData, FinancialsData, FeatureImportance, ModelMetrics,
} from '../types';
import ChartWrapper from '../components/ChartWrapper';
import RoleGuard from '../components/RoleGuard';

const COLORS = ['#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0'];

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

export default function DashboardPage() {
  const [tab, setTab]   = useState(0);
  const [dist,  setDist]  = useState<ChurnDistribution | null>(null);
  const [geo,   setGeo]   = useState<GeoData[]>([]);
  const [demo,  setDemo]  = useState<DemographicsData | null>(null);
  const [prod,  setProd]  = useState<ProductsActivityData | null>(null);
  const [fin,   setFin]   = useState<FinancialsData | null>(null);
  const [fi,    setFi]    = useState<FeatureImportance[]>([]);
  const [models,setModels]= useState<ModelMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requests = [
      dashboardApi.churnDistribution(),
      dashboardApi.geography(),
      dashboardApi.demographics(),
      dashboardApi.productsActivity(),
      dashboardApi.financials(),
      dashboardApi.featureImportance(),
    ];
    Promise.allSettled(requests).then((results) => {
      if (results[0].status === 'fulfilled') setDist(results[0].value.data);
      if (results[1].status === 'fulfilled') setGeo(results[1].value.data);
      if (results[2].status === 'fulfilled') setDemo(results[2].value.data);
      if (results[3].status === 'fulfilled') setProd(results[3].value.data);
      if (results[4].status === 'fulfilled') setFin(results[4].value.data);
      if (results[5].status === 'fulfilled') setFi(results[5].value.data);
      setLoading(false);
    });
    // Admin: model comparison
    dashboardApi.modelComparison().then(r => setModels(r.data)).catch(() => {});
  }, []);

  const distData = dist
    ? [{ name: 'Churned', value: dist.exited }, { name: 'Retained', value: dist.retained }]
    : [];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Typography variant="h5" fontWeight={800} mb={1}>📊 Dashboard & Analytics</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Churn patterns across geography, demographics, products, and financials
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Demographics" />
        <Tab label="Products & Activity" />
        <Tab label="Financials" />
        <Tab label="Feature Importance" />
        <Tab label="Model Comparison" />
      </Tabs>

      {/* ── Tab 0: Overview ──────────────────────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Churn Distribution" subtitle="Exited vs Retained" loading={loading}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={distData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {distData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>

          <Grid item xs={12} md={8}>
            <ChartWrapper title="Churn Rate by Geography" subtitle="Germany leads with 32.4% churn" loading={loading}>
              <ResponsiveContainer>
                <BarChart data={geo}>
                  <XAxis dataKey="geography" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#f44336" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 1: Demographics ──────────────────────────────────────────── */}
      {tab === 1 && demo && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ChartWrapper title="Churn by Gender">
              <ResponsiveContainer>
                <BarChart data={demo.gender}>
                  <XAxis dataKey="gender" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#9c27b0" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={6}>
            <ChartWrapper title="Churn by Age Group" subtitle="41–50 highest risk">
              <ResponsiveContainer>
                <BarChart data={demo.age_groups}>
                  <XAxis dataKey="age_group" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#ff9800" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 2: Products & Activity ───────────────────────────────────── */}
      {tab === 2 && prod && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Churn by Number of Products">
              <ResponsiveContainer>
                <BarChart data={prod.products}>
                  <XAxis dataKey="num_of_products" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#1976d2" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Active vs Inactive Members">
              <ResponsiveContainer>
                <BarChart data={prod.activity}>
                  <XAxis dataKey="member_status" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#f44336" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Credit Card Holders">
              <ResponsiveContainer>
                <BarChart data={prod.credit_card}>
                  <XAxis dataKey="card_status" />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#4caf50" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 3: Financials ────────────────────────────────────────────── */}
      {tab === 3 && fin && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Churn by Balance Bucket">
              <ResponsiveContainer>
                <BarChart data={fin.balance_buckets}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#1976d2" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Churn by Credit Score">
              <ResponsiveContainer>
                <BarChart data={fin.credit_score_buckets}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#ff9800" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={4}>
            <ChartWrapper title="Churn by Estimated Salary">
              <ResponsiveContainer>
                <BarChart data={fin.salary_buckets}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="churn_rate" name="Churn Rate" fill="#4caf50" radius={[4,4,0,0]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 4: Feature Importance ────────────────────────────────────── */}
      {tab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <ChartWrapper title="Feature Importance" subtitle="Top predictors from best model" loading={loading}>
              <ResponsiveContainer>
                <BarChart data={fi} layout="vertical" margin={{ left: 120 }}>
                  <XAxis type="number" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="feature" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <Bar dataKey="importance" name="Importance" fill="#1976d2" radius={[0,4,4,0]} />
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Top Risk Factors</Typography>
              {fi.slice(0, 6).map((item, idx) => (
                <Box key={idx} display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1976d2' }} />
                    <Typography variant="body2">{item.feature}</Typography>
                  </Box>
                  <Chip label={`${(item.importance * 100).toFixed(1)}%`} size="small" color="primary" variant="outlined" />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 5: Model Comparison (Admin only) ────────────────────────── */}
      {tab === 5 && (
        <RoleGuard adminOnly fallback={
          <Box p={4} textAlign="center">
            <Typography variant="h6" color="text.secondary">🔒 Admin access required to view model comparison</Typography>
          </Box>
        }>
          {models.length > 0 ? (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Best model highlighted in green (selected by highest Recall with Precision ≥ 0.65)
              </Typography>
              <TableContainer component={Paper} elevation={2}>
                <Table>
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      {['Model', 'Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC', 'Status'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {models.map((m, i) => (
                      <TableRow key={i} sx={{ bgcolor: m.is_best ? '#e8f5e9' : 'inherit' }}>
                        <TableCell>
                          <Typography fontWeight={m.is_best ? 700 : 400}>{m.model}</Typography>
                        </TableCell>
                        <TableCell>{pct(m.accuracy)}</TableCell>
                        <TableCell>{pct(m.precision)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{pct(m.recall)}</TableCell>
                        <TableCell>{pct(m.f1)}</TableCell>
                        <TableCell>{pct(m.roc_auc)}</TableCell>
                        <TableCell>
                          {m.is_best && <Chip label="Production" color="success" size="small" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box mt={3}>
                <ChartWrapper title="Model Comparison — Key Metrics" height={280}>
                  <ResponsiveContainer>
                    <BarChart data={models} margin={{ top: 10 }}>
                      <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0.5, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="recall"    name="Recall"    fill="#f44336" radius={[4,4,0,0]} />
                      <Bar dataKey="precision" name="Precision" fill="#1976d2" radius={[4,4,0,0]} />
                      <Bar dataKey="roc_auc"   name="ROC-AUC"  fill="#4caf50" radius={[4,4,0,0]} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrapper>
              </Box>
            </Box>
          ) : (
            <Box p={4} textAlign="center">
              <Typography color="text.secondary">Train models first to see comparison. Run: python scripts/train_models.py</Typography>
            </Box>
          )}
        </RoleGuard>
      )}
    </Box>
  );
}
