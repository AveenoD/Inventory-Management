import { View, Pressable, StyleSheet, Platform, Text, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  Wrench,
  Zap,
} from "lucide-react-native";
import { colors, spacing } from "@/theme/tokens";

function TabIcon({
  Icon,
  color,
  size = 22,
  focused,
}: {
  Icon: typeof CreditCard;
  color: ColorValue;
  size?: number;
  focused?: boolean;
}) {
  return (
    <Icon
      size={focused ? size + 2 : size}
      color={String(color)}
      strokeWidth={focused ? 2.5 : 2}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CreditCard} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="repair"
        options={{
          title: "Repairs",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Wrench} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => {
            const focused = props.accessibilityState?.selected ?? false;
            return (
              <Pressable
                onPress={props.onPress}
                onLongPress={props.onLongPress}
                accessibilityState={props.accessibilityState}
                accessibilityLabel="Dashboard"
                testID={props.testID}
                style={styles.centerTab}
              >
                <View style={[styles.centerBtn, focused && styles.centerBtnFocused]}>
                  <LayoutDashboard size={24} color="#ffffff" strokeWidth={2.5} />
                </View>
                <Text style={[styles.centerTabLabel, focused && styles.centerTabLabelActive]}>
                  Dashboard
                </Text>
              </Pressable>
            );
          },
        }}
      />
      <Tabs.Screen
        name="recharge"
        options={{
          title: "Recharge",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Zap} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: "Transfer",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={ArrowLeftRight} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: Platform.OS === "ios" ? 88 : 72,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  centerTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 6 : 8,
  },
  centerBtn: {
    position: "absolute",
    top: -18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  centerBtnFocused: {
    backgroundColor: "#1d4ed8",
  },
  centerTabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  centerTabLabelActive: {
    color: colors.accent,
  },
});
