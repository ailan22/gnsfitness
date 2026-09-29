import { Capacitor } from '@capacitor/core'
import { AccessControl, BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric'
import { BiometricSession } from './biometricSession'

export const nativePlatform = Capacitor.isNativePlatform()

export function nativeSessionStorage(sessionKey: string) {
  if (!nativePlatform) return undefined
  const key = `uy.gnsfitness.app.${sessionKey}.key.v1`
  return new BiometricSession(sessionKey, window.localStorage, {
    save: value => NativeBiometric.setData({ key, value, accessControl: AccessControl.BIOMETRY_CURRENT_SET,
      authValidityDuration: 0, title: 'Activar acceso biométrico', negativeButtonText: 'Cancelar' }),
    read: async () => (await NativeBiometric.getSecureData({ key,
      reason: 'Desbloqueá tu acceso a GNS FITNESS', title: 'GNS FITNESS',
      negativeButtonText: 'Usar contraseña', fallbackTitle: '' })).value,
    remove: () => NativeBiometric.deleteData({ key }),
  })
}

export async function biometricAvailability() {
  if (!nativePlatform) return { available: false, label: 'biometría' }
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: false })
    return { available: result.isAvailable && result.strongBiometryIsAvailable,
      label: result.biometryType === BiometryType.FACE_ID ? 'Face ID'
        : result.biometryType === BiometryType.TOUCH_ID ? 'Touch ID' : 'biometría' }
  } catch { return { available: false, label: 'biometría' } }
}
