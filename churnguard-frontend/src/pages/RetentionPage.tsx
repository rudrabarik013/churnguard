import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, Chip, Button,
  List, ListItem, ListItemIcon, ListItemText, Divider, Skeleton,
  CircularProgress,
} from '@mui/material';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Label,
} from 'recharts';
import { retentionApi } from '../services/api';
import { RetentionSegment } from '../types';

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  Critical: 'error',
  High:     'warning',
  Medium:   'info',
  Low:      'success',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toLocaleString()}`;
}

function exportToPdf(segments: RetentionSegment[]) {
  const content = segments.map(s => `
Segment: ${s.name}
Priority: ${s.priority}
Customers: ${s.size.toLocaleString()}
Churn Rate: ${(s.churn_rate * 100).toFixed(1)}%
Strategy: ${s.strategy}
Expected Reduction: ${s.expected_reduction}
Tactics:
${s.tactics.map(t => `  • ${t}`).join('\n')}
Revenue at Risk: ${fmt(s.revenue_at_risk)}
${'─'.repeat(60)}
`).join('\n');

  const blob = new Blob([`ChurnGuard — Retention Strategy Report\n\n${content}`], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'ChurnGuard_Retention_Strategies.txt';
  a.click();
}

export default function RetentionPage() {
  const [segments, setSegments] = useState<RetentionSegment[]>([]);
  const [selected, setSelected] = useState<RetentionSegment | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    retentionApi.segments()
      .then(r => {
        setSegments(r.data);
        setSelected(r.data[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bubbleData = segments.map(s => ({
    x:    s.ease,
    y:    s.impact,
    z:    s.size,
    name: s.name,
    priority: s.priority,
  }));

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Grid container spacing={2} mt={1}>
          {[1,2,3,4,5].map(i => <Grid item xs={12} md={4} key={i}><Skeleton variant="rounded" height={120} /></Grid>)}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>🎯 Retention Strategies</Typography>
          <Typography variant="body2" color="text.secondary">
            5 data-driven segments with prioritised intervention strategies
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => exportToPdf(segments)}
          disabled={segments.length === 0}
        >
          📄 Export PDF One-Pager
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Segment cards */}
        <Grid item xs={12} md={4}>
          {segments.map(seg => (
            <Card
              key={seg.id}
              elevation={selected?.id === seg.id ? 4 : 1}
              onClick={() => setSelected(seg)}
              sx={{
                mb: 2,
                cursor: 'pointer',
                border: selected?.id === seg.id ? '2px solid #1976d2' : '2px solid transparent',
                transition: 'all 0.2s',
                '&:hover': { elevation: 3 },
              }}
            >
              <CardContent sx={{ pb: '12px !important' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="body1" fontWeight={700} fontSize="0.9rem" sx={{ flex: 1, pr: 1 }}>
                    {seg.name}
                  </Typography>
                  <Chip
                    label={seg.priority}
                    color={PRIORITY_COLORS[seg.priority]}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <Box display="flex" gap={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Customers</Typography>
                    <Typography fontWeight={700}>{seg.size.toLocaleString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Churn Rate</Typography>
                    <Typography fontWeight={700} color="error.main">{(seg.churn_rate * 100).toFixed(1)}%</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Revenue at Risk</Typography>
                    <Typography fontWeight={700} color="warning.main">{fmt(seg.revenue_at_risk)}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Grid>

        {/* Right: Selected segment detail */}
        <Grid item xs={12} md={8}>
          {selected ? (
            <Card elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{selected.name}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>{selected.strategy}</Typography>
                </Box>
                <Chip label={selected.expected_reduction} color="success" sx={{ fontWeight: 600 }} />
              </Box>

              <Grid container spacing={2} mb={3}>
                {[
                  { label: 'Segment Size',    value: selected.size.toLocaleString(), color: '#1976d2' },
                  { label: 'Churn Rate',      value: `${(selected.churn_rate * 100).toFixed(1)}%`, color: '#f44336' },
                  { label: 'Revenue at Risk', value: fmt(selected.revenue_at_risk), color: '#ed6c02' },
                  { label: 'Ease of Execution',value: `${selected.ease}/10`, color: '#4caf50' },
                  { label: 'Business Impact', value: `${selected.impact}/10`, color: '#9c27b0' },
                ].map(({ label, value, color }) => (
                  <Grid item xs={6} sm={4} key={label}>
                    <Box sx={{ p: 1.5, bgcolor: `${color}15`, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography fontWeight={700} color={color}>{value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle1" fontWeight={700} mb={1}>📋 Recommended Tactics</Typography>
              <List dense>
                {selected.tactics.map((tactic, i) => (
                  <ListItem key={i} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28, color: '#1976d2' }}>✓</ListItemIcon>
                    <ListItemText primary={tactic} />
                  </ListItem>
                ))}
              </List>
            </Card>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" height={300}>
              <Typography color="text.secondary">Select a segment to view details</Typography>
            </Box>
          )}

          {/* Priority Matrix */}
          <Card elevation={2} sx={{ mt: 3, p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Priority Matrix — Ease vs Impact
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Bubble size = customer count · X-axis = ease of execution · Y-axis = business impact
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" domain={[0, 10]} name="Ease">
                  <Label value="Ease of Execution" position="insideBottom" offset={-15} />
                </XAxis>
                <YAxis type="number" dataKey="y" domain={[0, 10]} name="Impact">
                  <Label value="Business Impact" angle={-90} position="insideLeft" />
                </YAxis>
                <ZAxis type="number" dataKey="z" range={[200, 1500]} name="Customers" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <Box sx={{ bgcolor: 'white', p: 1.5, border: '1px solid #ddd', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight={700}>{d.name}</Typography>
                        <Typography variant="caption" display="block">Ease: {d.x}/10</Typography>
                        <Typography variant="caption" display="block">Impact: {d.y}/10</Typography>
                        <Typography variant="caption" display="block">Customers: {d.z.toLocaleString()}</Typography>
                      </Box>
                    );
                  }}
                />
                <Scatter data={bubbleData} fill="#1976d2" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
