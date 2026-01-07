/**
 * Gamepak integration for arcade-terrain
 *
 * Server-side only - loads config from pixeljam-arcade org
 */

import { Gamepak } from '@tetra/gamepak';

let _pak = null;

/**
 * Get the Gamepak instance (lazy initialization)
 */
export async function getPak() {
  if (!_pak) {
    _pak = await Gamepak.forOrg('pixeljam-arcade');
  }
  return _pak;
}

/**
 * Get games list (for catalog pages)
 */
export async function getGamesList() {
  const pak = await getPak();
  return pak.list({ showHidden: false });
}

/**
 * Get single game
 */
export async function getGame(slug) {
  const pak = await getPak();
  return pak.get(slug);
}

/**
 * Get file stream from S3 (for proxying)
 */
export async function getGameFileStream(path) {
  const pak = await getPak();
  return pak.getFileStream(path);
}

/**
 * Get signed URL for game file
 */
export async function getGameFileUrl(path, expiresIn = 7200) {
  const pak = await getPak();
  return pak.getSignedUrl(path, expiresIn);
}
