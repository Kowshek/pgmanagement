// Minimal RFC4122 v4-ish UUID generator, used only as a client-generated
// idempotency key for payment creation (see api.js paymentsApi.create).
// Not cryptographically secure — deliberately avoids pulling in
// expo-crypto / react-native-get-random-values as a new dependency for a
// value that only needs to be unique per submit, not unguessable.
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
