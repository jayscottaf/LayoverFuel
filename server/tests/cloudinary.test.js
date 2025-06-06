import test from 'node:test';
import assert from 'node:assert/strict';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sampleBase64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYA' +
  'AAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const credsProvided =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

test('uploads image to Cloudinary', { skip: !credsProvided }, async () => {
  const result = await cloudinary.uploader.upload(sampleBase64, {
    folder: 'layover-fuel-test',
  });

  assert.ok(result.secure_url);
});
