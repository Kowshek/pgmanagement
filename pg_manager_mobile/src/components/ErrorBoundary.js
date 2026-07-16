import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '../theme/theme';

// Last-resort crash screen. Deliberately avoids custom fonts and app state —
// it must render even when those are the thing that broke.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in component tree:', error, info?.componentStack);
  }

  handleRetry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. Your data is safe on this device.
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  message: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  button: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 9999,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
