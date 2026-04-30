import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

let alertSound: Audio.Sound | null = null;

async function getAlertSound(): Promise<Audio.Sound> {
  if (alertSound) return alertSound;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[new-order-alert-sound] audio_mode_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const { sound } = await Audio.Sound.createAsync(
    require("../../../assets/sounds/new_order_strong_alert.mp3"),
    {
      shouldPlay: false,
      isLooping: false,
      volume: 1,
      progressUpdateIntervalMillis: 250,
    },
  );
  alertSound = sound;
  return sound;
}

export async function playNewOrderAlertSound(): Promise<void> {
  try {
    const sound = await getAlertSound();
    await sound.stopAsync().catch(() => undefined);
    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(1);
    await sound.playAsync();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[new-order-alert-sound] play_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function stopNewOrderAlertSound(): Promise<void> {
  if (!alertSound) return;
  try {
    await alertSound.stopAsync().catch(() => undefined);
    await alertSound.setPositionAsync(0).catch(() => undefined);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[new-order-alert-sound] stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
