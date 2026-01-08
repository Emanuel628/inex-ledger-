import { encryptToken } from '../services/encryptionService.js';

export const savePlaidItem = async (db, userId, itemId, rawAccessToken) => {
  if (!db || !userId || !itemId || !rawAccessToken) {
    throw new Error('Missing arguments for savePlaidItem');
  }

  const encryptedToken = encryptToken(rawAccessToken);

  return db('plaid_items')
    .insert({
      user_id: userId,
      plaid_item_id: itemId,
      encrypted_access_token: encryptedToken,
      created_at: new Date(),
    })
    .onConflict('plaid_item_id')
    .merge({
      encrypted_access_token: encryptedToken,
      updated_at: new Date(),
    });
};
