import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Button, IconButton,
  Drawer, List, ListItem, ListItemButton, ListItemText,
  Chip, Avatar, Menu, MenuItem, Divider,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home',       path: '/' },
  { label: 'Dashboard',  path: '/dashboard' },
  { label: 'Retention',  path: '/retention' },
  { label: 'Simulation', path: '/simulation' },
];

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [drawer,  setDrawer]  = useState(false);
  const [anchor,  setAnchor]  = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: 1100, bgcolor: '#1a237e' }}>
        <Toolbar sx={{ gap: 1 }}>
          {/* Logo */}
          <Typography
            variant="h6"
            fontWeight={800}
            sx={{ cursor: 'pointer', letterSpacing: '-0.5px', color: '#fff', mr: 2 }}
            onClick={() => navigate('/')}
          >
            🛡️ ChurnGuard
          </Typography>

          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flexGrow: 1 }}>
            {NAV_LINKS.map((link) => (
              <Button
                key={link.path}
                onClick={() => navigate(link.path)}
                sx={{
                  color: location.pathname === link.path ? '#90caf9' : '#fff',
                  fontWeight: location.pathname === link.path ? 700 : 400,
                  borderBottom: location.pathname === link.path ? '2px solid #90caf9' : 'none',
                  borderRadius: 0,
                }}
              >
                {link.label}
              </Button>
            ))}
            {isAdmin && (
              <Button
                onClick={() => navigate('/users')}
                sx={{
                  color: location.pathname === '/users' ? '#90caf9' : '#fff',
                  fontWeight: location.pathname === '/users' ? 700 : 400,
                  borderBottom: location.pathname === '/users' ? '2px solid #90caf9' : 'none',
                  borderRadius: 0,
                }}
              >
                Users
              </Button>
            )}
          </Box>

          {/* Role chip + user menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={isAdmin ? 'Admin' : 'Manager'}
              size="small"
              sx={{
                bgcolor: isAdmin ? '#f44336' : '#4caf50',
                color: '#fff',
                fontWeight: 600,
                display: { xs: 'none', sm: 'flex' },
              }}
            />
            <Avatar
              sx={{ width: 32, height: 32, bgcolor: '#3f51b5', cursor: 'pointer', fontSize: '0.85rem' }}
              onClick={(e) => setAnchor(e.currentTarget)}
            >
              {user.email[0].toUpperCase()}
            </Avatar>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>

            {/* Mobile hamburger */}
            <IconButton sx={{ display: { md: 'none' }, color: '#fff' }} onClick={() => setDrawer(true)}>
              ☰
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)}>
        <List sx={{ width: 220, pt: 2 }}>
          {NAV_LINKS.map((link) => (
            <ListItem key={link.path} disablePadding>
              <ListItemButton
                onClick={() => { navigate(link.path); setDrawer(false); }}
                selected={location.pathname === link.path}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
          {isAdmin && (
            <ListItem disablePadding>
              <ListItemButton onClick={() => { navigate('/users'); setDrawer(false); }}>
                <ListItemText primary="Users" />
              </ListItemButton>
            </ListItem>
          )}
          <Divider sx={{ my: 1 }} />
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemText primary="Logout" sx={{ color: 'error.main' }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}
