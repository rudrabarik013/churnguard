import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardActionArea, CardContent, Button,
  CircularProgress, Alert, Chip, Divider, Table, TableBody,
  TableCell, TableContainer, TableRow, Paper, TextField, MenuItem,
  Select, FormControl, InputLabel, Switch, FormControlLabel,
} from '@mui/material';
import { simulationApi, predictApi } from '../services/api';
import { ScenarioInfo, SimulationResult, SinglePredictionRequest, PredictionResult } from '../types';
import RoleGuard from '../components/RoleGuard';

const SCENARIO_ICONS: Record<string, string> = {
  activate_inactive_members:  '😴→😊',
  germany_retention:          '🇩🇪',
  cross_sell_single_product:  '🛍️',
  credit_score_improvement:   '📈',
  age_targeted_retention:     '👴',
  zero_balance_engagement:    '💰',
  comprehensive_package:      '🎯',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toLocaleString()}`;
}

function downloadCsv(result: SimulationResult) {
  const rows = [
    ['Scenario', result.scenario_name],
    ['Churn Before', `${result.churn_before}%`],
    ['Churn After',  `${result.churn_after}%`],
    ['Reduction',    `${(result.churn_before - result.churn_after).toFixed(2)}%`],
    ['Customers Affected', result.customers_affected],
    ['Revenue Impact', fmt(result.revenue_impact)],
  ];
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `simulation_${result.scenario_name.replace(/\s+/g, '_')}.csv`;
  a.click();
}

const RISK_COLORS: Record<string, 'error' | 'warning' | 'success'> = {
  High: 'error', Medium: 'warning', Low: 'success',
};

export default function SimulationPage() {
  const [scenarios,  setScenarios]  = useState<ScenarioInfo[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [result,     setResult]     = useState<SimulationResult | null>(null);
  const [running,    setRunning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Admin: Individual Prediction
  const [predForm,   setPredForm]   = useState<SinglePredictionRequest>({
    credit_score: 650, geography: 'France', gender: 'Male',
    age: 35, tenure: 5, balance: 75000,
    num_of_products: 1, has_cr_card: true, is_active_member: true,
    estimated_salary: 50000,
  });
  const [predResult, setPredResult] = useState<PredictionResult | null>(null);
  const [predLoading,setPredLoading]= useState(false);

  // Admin: Batch upload
  const [batchFile,  setBatchFile]  = useState<File | null>(null);
  const [batchLoading,setBatchLoading]= useState(false);

  useEffect(() => {
    simulationApi.scenarios()
      .then(r => setScenarios(r.data))
      .catch(() => {});
  }, []);

  const runScenario = async () => {
    if (!selected) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await simulationApi.run(selected);
      setResult(r.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const runPrediction = async () => {
    setPredLoading(true);
    setPredResult(null);
    try {
      const r = await predictApi.single(predForm);
      setPredResult(r.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Prediction failed');
    } finally {
      setPredLoading(false);
    }
  };

  const handleBatchUpload = async () => {
    if (!batchFile) return;
    setBatchLoading(true);
    try {
      const r = await predictApi.batch(batchFile);
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'churnguard_predictions.csv';
      a.click();
    } catch {
      setError('Batch prediction failed. Check the CSV format.');
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Typography variant="h5" fontWeight={800} mb={1}>⚡ Simulation Engine</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Test 7 banking scenarios — see predicted churn reduction and revenue impact before you act
      </Typography>

      <Grid container spacing={3}>
        {/* Left: Scenario cards */}
        <Grid item xs={12} md={5}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>Select a Scenario</Typography>
          {scenarios.map(sc => (
            <Card
              key={sc.key}
              elevation={selected === sc.key ? 4 : 1}
              sx={{
                mb: 1.5,
                border: selected === sc.key ? '2px solid #1976d2' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => { setSelected(sc.key); setResult(null); setError(null); }}
            >
              <CardContent sx={{ py: '12px !important' }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Typography fontSize="1.5rem">{SCENARIO_ICONS[sc.key] || '📊'}</Typography>
                  <Box>
                    <Typography variant="body1" fontWeight={700}>{sc.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{sc.description}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={runScenario}
            disabled={!selected || running}
            sx={{ mt: 1, fontWeight: 700, py: 1.5 }}
          >
            {running ? <CircularProgress size={22} color="inherit" /> : '▶ Run Simulation'}
          </Button>
        </Grid>

        {/* Right: Results */}
        <Grid item xs={12} md={7}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {!result && !running && (
            <Box
              sx={{
                height: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #ddd',
                borderRadius: 3,
                color: 'text.secondary',
              }}
            >
              <Box textAlign="center">
                <Typography fontSize="3rem">⚡</Typography>
                <Typography variant="h6">Select a scenario and click Run</Typography>
                <Typography variant="body2">Results appear here with before/after metrics</Typography>
              </Box>
            </Box>
          )}

          {result && (
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={800} mb={2}>{result.scenario_name}</Typography>

                {/* Before / After */}
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Churn Before</Typography>
                      <Typography variant="h4" fontWeight={800} color="error.main">{result.churn_before}%</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Churn After</Typography>
                      <Typography variant="h4" fontWeight={800} color="success.main">{result.churn_after}%</Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {[
                        { label: 'Churn Reduction', value: `${(result.churn_before - result.churn_after).toFixed(2)} pp` },
                        { label: 'Customers Affected', value: result.customers_affected.toLocaleString() },
                        { label: 'Est. Revenue Impact', value: fmt(result.revenue_impact) },
                      ].map(r => (
                        <TableRow key={r.label}>
                          <TableCell sx={{ fontWeight: 500, color: 'text.secondary', border: 0 }}>{r.label}</TableCell>
                          <TableCell sx={{ fontWeight: 700, border: 0 }}>{r.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box display="flex" gap={1} mt={2}>
                  <Button variant="outlined" size="small" onClick={() => downloadCsv(result!)}>
                    📥 Export CSV
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Admin: Individual Prediction */}
          <RoleGuard adminOnly>
            <Card elevation={2} sx={{ mt: 3, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} mb={2}>🔍 Individual Customer Prediction (Admin)</Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'Credit Score', key: 'credit_score', type: 'number' },
                    { label: 'Age', key: 'age', type: 'number' },
                    { label: 'Tenure (years)', key: 'tenure', type: 'number' },
                    { label: 'Balance (€)', key: 'balance', type: 'number' },
                    { label: 'Num of Products', key: 'num_of_products', type: 'number' },
                    { label: 'Estimated Salary (€)', key: 'estimated_salary', type: 'number' },
                  ].map(field => (
                    <Grid item xs={12} sm={6} key={field.key}>
                      <TextField
                        label={field.label}
                        type="number"
                        fullWidth
                        size="small"
                        value={predForm[field.key as keyof SinglePredictionRequest] as number}
                        onChange={e => setPredForm(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                      />
                    </Grid>
                  ))}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Geography</InputLabel>
                      <Select value={predForm.geography} label="Geography" onChange={e => setPredForm(prev => ({ ...prev, geography: e.target.value }))}>
                        {['France', 'Germany', 'Spain'].map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Gender</InputLabel>
                      <Select value={predForm.gender} label="Gender" onChange={e => setPredForm(prev => ({ ...prev, gender: e.target.value }))}>
                        <MenuItem value="Male">Male</MenuItem>
                        <MenuItem value="Female">Female</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={<Switch checked={predForm.has_cr_card} onChange={e => setPredForm(p => ({ ...p, has_cr_card: e.target.checked }))} />}
                      label="Has Credit Card"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel
                      control={<Switch checked={predForm.is_active_member} onChange={e => setPredForm(p => ({ ...p, is_active_member: e.target.checked }))} />}
                      label="Active Member"
                    />
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  onClick={runPrediction}
                  disabled={predLoading}
                  sx={{ mt: 2 }}
                >
                  {predLoading ? <CircularProgress size={18} color="inherit" /> : 'Predict Churn'}
                </Button>

                {predResult && (
                  <Box mt={2} p={2} sx={{ bgcolor: '#f5f5f5', borderRadius: 2 }}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Typography fontWeight={700}>Churn Probability:</Typography>
                      <Typography fontWeight={800} color={predResult.churn_probability > 0.5 ? 'error.main' : 'success.main'} fontSize="1.3rem">
                        {(predResult.churn_probability * 100).toFixed(1)}%
                      </Typography>
                      <Chip label={predResult.risk_level} color={RISK_COLORS[predResult.risk_level]} />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>Top Risk Factors:</Typography>
                    {predResult.top_risk_factors.map((f, i) => (
                      <Typography key={i} variant="body2" color="text.secondary" sx={{ ml: 1 }}>• {f}</Typography>
                    ))}
                    <Typography variant="caption" color="text.secondary">Model: {predResult.model_used}</Typography>
                  </Box>
                )}

                {/* Batch Upload */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} mb={1}>📂 Batch CSV Prediction</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Upload a CSV with columns: CustomerId, CreditScore, Geography, Gender, Age, Tenure, Balance, NumOfProducts, HasCrCard, IsActiveMember, EstimatedSalary
                </Typography>
                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                  <Button variant="outlined" component="label" size="small">
                    Choose CSV
                    <input type="file" accept=".csv" hidden onChange={e => setBatchFile(e.target.files?.[0] || null)} />
                  </Button>
                  {batchFile && <Typography variant="caption">{batchFile.name}</Typography>}
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!batchFile || batchLoading}
                    onClick={handleBatchUpload}
                  >
                    {batchLoading ? <CircularProgress size={16} color="inherit" /> : '📥 Run & Download'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </RoleGuard>
        </Grid>
      </Grid>
    </Box>
  );
}
