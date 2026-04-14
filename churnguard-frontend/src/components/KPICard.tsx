import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'error' | 'warning' | 'success' | 'info';
  trend?: { value: number; label: string };
}

export default function KPICard({ title, value, subtitle, icon, color = 'primary', trend }: Props) {
  const colors = {
    primary: '#1976d2',
    error:   '#d32f2f',
    warning: '#ed6c02',
    success: '#2e7d32',
    info:    '#0288d1',
  };

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        borderTop: `4px solid ${colors[color]}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={colors[color]} lineHeight={1.2}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Chip
                size="small"
                label={`${trend.value > 0 ? '+' : ''}${trend.value}% ${trend.label}`}
                color={trend.value < 0 ? 'success' : 'error'}
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                backgroundColor: `${colors[color]}20`,
                borderRadius: 2,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors[color],
                fontSize: '1.8rem',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
