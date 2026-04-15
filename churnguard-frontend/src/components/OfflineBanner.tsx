
import { Box, Alert, Button, Typography } from '@mui/material';
import { useBackendStatus } from '../context/BackendStatusContext';

export default function OfflineBanner() {
  const { isOffline, retry } = useBackendStatus();
  if (!isOffline) return null;

  return (
    <Box
      sx={{
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 1200,
        p: 1,
      }}
    >
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={retry} variant="outlined">
            Retry Connection
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>Backend services are currently offline.</strong> Please contact the administrator to start the server.
          Static navigation is still available.
        </Typography>
      </Alert>
    </Box>
  );
}
