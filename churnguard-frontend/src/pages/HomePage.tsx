import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, CardActionArea,
  Chip, Skeleton, Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { metricsApi } from '../services/api';
import { KPIData, Insight } from '../types';
import { useAuth } from '../context/AuthContext';
import KPICard from '../components/KPICard';

const NAV_TILES = [
  { label: 'Dashboard & Analytics',  icon: '📊', path: '/dashboard',  desc: '8 interactive charts — churn patterns across geography, demographics & financials' },
  { label: 'Retention Strategies',   icon: '🎯', path: '/retention',  desc: '5 targeted segments with data-driven strategy recommendations' },
  { label: 'Simulation Engine',      icon: '⚡', path: '/simulation', desc: '7 banking scenarios — see predicted churn reduction & revenue impact before you act' },
];

function fmt(n: number, prefix = '') {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [kpi,      setKpi]      = useState<KPIData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([metricsApi.kpi(), metricsApi.insights()])
      .then(([kRes, iRes]) => {
        setKpi(kRes.data);
        setInsights(iRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #1565c0 100%)',
          borderRadius: 3,
          p: { xs: 3, md: 5 },
          mb: 4,
          color: '#fff',
        }}
      >
        <Typography variant="h4" fontWeight={800} gutterBottom>
          🛡️ Welcome back, {user?.email.split('@')[0]}
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85, maxWidth: 600 }}>
          ChurnGuard — Customer Churn Prediction & Retention Intelligence Platform for Banking.
          Identify at-risk customers, understand patterns, and simulate retention strategies.
        </Typography>
        <Chip
          label={`Role: ${user?.role?.toUpperCase()}`}
          sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }}
        />
      </Box>

      {/* KPI Cards */}
      <Typography variant="h6" fontWeight={700} mb={2}>Key Performance Indicators</Typography>
      <Grid container spacing={2} mb={4}>
        {loading ? (
          [1,2,3,4,5].map((i) => (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))
        ) : kpi ? (
          <>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KPICard title="Total Customers" value={kpi.total_customers.toLocaleString()} icon="👥" color="primary" />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KPICard
                title="Churn Rate"
                value={`${(kpi.churn_rate * 100).toFixed(2)}%`}
                subtitle={`${kpi.churned_customers.toLocaleString()} customers at risk`}
                icon="📉"
                color="error"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KPICard
                title="Revenue at Risk"
                value={fmt(kpi.revenue_at_risk, '€')}
                subtitle="5% NIM on churned balances"
                icon="💰"
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KPICard
                title="Avg Balance (Churned)"
                value={`€${Math.round(kpi.avg_balance_churned).toLocaleString()}`}
                subtitle={`vs €${Math.round(kpi.avg_balance_retained).toLocaleString()} retained`}
                icon="🏦"
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <KPICard
                title="Retained Customers"
                value={kpi.retained_customers.toLocaleString()}
                subtitle={`${(100 - kpi.churn_rate * 100).toFixed(1)}% retention rate`}
                icon="✅"
                color="success"
              />
            </Grid>
          </>
        ) : null}
      </Grid>

      {/* Insights */}
      {insights.length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" fontWeight={700} mb={2}>Key Insights</Typography>
          <Grid container spacing={2}>
            {insights.map((ins, idx) => (
              <Grid item xs={12} sm={6} key={idx}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    borderLeft: '4px solid #1976d2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderRadius: 2,
                  }}
                >
                  <Typography fontSize="1.5rem">{ins.icon}</Typography>
                  <Typography variant="body2" color="text.primary">{ins.text}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Navigation Tiles */}
      <Typography variant="h6" fontWeight={700} mb={2}>Explore ChurnGuard</Typography>
      <Grid container spacing={2} mb={4}>
        {NAV_TILES.map((tile) => (
          <Grid item xs={12} md={4} key={tile.path}>
            <Card elevation={2} sx={{ height: '100%', borderRadius: 2 }}>
              <CardActionArea onClick={() => navigate(tile.path)} sx={{ height: '100%', p: 1 }}>
                <CardContent>
                  <Typography fontSize="2.5rem" mb={1}>{tile.icon}</Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>{tile.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{tile.desc}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Model Health */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2, bgcolor: '#f3f4f6' }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>🤖 Model Health</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Dataset</Typography>
            <Typography fontWeight={600}>10,000 customers · 14 features</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Churn Rate</Typography>
            <Typography fontWeight={600}>20.37% (2,037 exited)</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">Models Trained</Typography>
            <Typography fontWeight={600}>LR · Random Forest · XGBoost · Neural Net</Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
