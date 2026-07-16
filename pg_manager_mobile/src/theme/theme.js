export const theme = {
  colors: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#111111',
    textSecondary: '#666666',
    textTertiary: '#999999',
    primary: '#111111',
    border: '#EAEAEA',
    success: '#0CA678',
    error: '#FA5252',
    warning: '#FAB005',
    blue: '#339AF0',
    primaryLight: '#2C2C2C',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: '#111111', letterSpacing: -0.5 },
    h2: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#111111', letterSpacing: -0.3 },
    h3: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, color: '#111111' },
    body: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: '#111111' },
    bodySecondary: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: '#666666' },
    caption: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#666666' },
    small: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#999999' },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    }
  }
};
