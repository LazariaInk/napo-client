import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function Screen({ children }) {
  const { colors } = useTheme();
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 18,
  },
});