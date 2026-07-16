import { Linking } from 'react-native';

import { notify } from './confirm';

export async function callPhone(phone) {
  const digits = String(phone || '').replace(/[^+\d]/g, '');
  if (!digits) {
    notify('No phone number', 'This guest has no phone number saved.');
    return;
  }
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch {
    notify('Unable to call', `Dial ${phone} manually.`);
  }
}
