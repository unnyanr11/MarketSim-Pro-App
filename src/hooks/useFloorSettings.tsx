import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FLOOR_SETTING_KEY = "selected_floor";

interface FloorSettingsContextType {
  selectedFloor: number;
  setSelectedFloor: (floor: number) => Promise<void>;
  availableFloors: number[];
}

const FloorSettingsContext = createContext<FloorSettingsContextType | undefined>(undefined);

export const FloorSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFloor, setSelectedFloorState] = useState<number>(0);
  
  // Get available floors from rooms (0 = Ground, 1 = 1st, 2 = 2nd, etc.)
  // Based on room numbers: 101-199 = Floor 0, 201-299 = Floor 1, etc.
  const availableFloors = [0, 1, 2, 3, 4]; // Adjust based on your hotel

  useEffect(() => {
    // Load saved floor preference
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(FLOOR_SETTING_KEY);
        if (saved !== null) {
          setSelectedFloorState(parseInt(saved, 10));
        }
      } catch (error) {
        console.log("Failed to load floor setting", error);
      }
    })();
  }, []);

  const setSelectedFloor = async (floor: number) => {
    try {
      await AsyncStorage.setItem(FLOOR_SETTING_KEY, String(floor));
      setSelectedFloorState(floor);
    } catch (error) {
      console.log("Failed to save floor setting", error);
    }
  };

  return (
    <FloorSettingsContext.Provider value={{ selectedFloor, setSelectedFloor, availableFloors }}>
      {children}
    </FloorSettingsContext.Provider>
  );
};

export const useFloorSettings = () => {
  const ctx = useContext(FloorSettingsContext);
  if (!ctx) {
    throw new Error("useFloorSettings must be used within FloorSettingsProvider");
  }
  return ctx;
};