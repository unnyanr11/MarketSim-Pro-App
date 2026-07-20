import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  GestureResponderEvent,
  ActivityIndicator,
} from "react-native";

interface Props {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
}

const Button: React.FC<Props> = ({
  title,
  onPress,
  color = "#3498db",
  disabled,
  loading,
}) => (
  <TouchableOpacity
    style={[
      styles.button,
      { backgroundColor: disabled || loading ? "#95a5a6" : color },
    ]}
    onPress={onPress}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.text}>{title}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 6,
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default Button;