import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, Box, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  height?: number;
  onExportPng?: () => void;
}

export default function ChartWrapper({ title, subtitle, children, loading, error, height = 320, onExportPng }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (onExportPng) {
      onExportPng();
      return;
    }
    if (!ref.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(ref.current);
      const link   = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch {
      // html2canvas not loaded yet — silently ignore
    }
  };

  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardHeader
        title={<Typography variant="h6" fontSize="0.95rem" fontWeight={600}>{title}</Typography>}
        subheader={subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        action={
          <Tooltip title="Export as PNG">
            <IconButton size="small" onClick={handleExport} aria-label="export chart">
              📥
            </IconButton>
          </Tooltip>
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography color="text.secondary" variant="body2">{error}</Typography>
          </Box>
        ) : (
          <div ref={ref} style={{ height }}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
