import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { convexClient } from '@/lib/convexClient';
import { colors } from '@/lib/theme';

export {
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: '#ffffff',
    card: '#ffffff',
    text: colors.text,
    border: '#f3f4f6',
  },
};

const headerStyle = {
  backgroundColor: '#ffffff',
  ...(Platform.OS === 'ios'
    ? { shadowColor: 'transparent' }
    : { elevation: 0 }),
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const app = (
    <GluestackUIProvider mode="light">
      <ThemeProvider value={AppTheme}>
        <Stack
          screenOptions={{
            headerBackTitle: 'Back',
            gestureEnabled: true,
            headerStyle,
            headerTintColor: colors.primary,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 17,
              color: colors.text,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="tabs" options={{ headerShown: false }} />
          <Stack.Screen
            name="items/new"
            options={{
              title: 'New Exercise',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="items/[itemId]"
            options={{
              title: 'Edit Exercise',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="my-exercises"
            options={{
              title: 'My Exercises',
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="timer"
            options={{
              title: '',
              presentation: 'card',
              headerStyle: {
                backgroundColor: '#111827',
              },
              headerTintColor: '#ffffff',
            }}
          />
          <Stack.Screen
            name="plan-history"
            options={{
              title: 'Past Sessions',
              presentation: 'card',
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );

  return convexClient ? (
    <ConvexAuthProvider
      client={convexClient}
      storage={
        Platform.OS === 'android' || Platform.OS === 'ios'
          ? secureStorage
          : undefined
      }
    >
      {app}
    </ConvexAuthProvider>
  ) : (
    app
  );
}
