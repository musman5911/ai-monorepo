import { extractImageIds, findUnreferencedImageIds } from '../flock_farm/backend/image-references.mjs';

const imageA = 'a'.repeat(24);
const imageB = 'b'.repeat(24);

describe('Flock image reference discovery', () => {
  it('finds image URLs in legacy and nested photo fields', () => {
    expect([...extractImageIds({ image: '/api/images/' + imageA, diary: [{ photos: [{ data: '/api/images/' + imageB }] }] })].sort())
      .toEqual([imageA, imageB]);
  });

  it('ignores external URLs, malformed IDs and arbitrary strings', () => {
    expect([...extractImageIds({ image: 'https://example.com/photo.jpg', bad: '/api/images/not-an-id', note: 'hello' })]).toEqual([]);
  });

  it('keeps an image if any current bucket still references it', () => {
    expect(findUnreferencedImageIds([imageA, imageB], [
      { birds: [{ image: '/api/images/' + imageA }] },
      { diary: [{ photos: [{ data: '/api/images/' + imageB }] }] },
    ])).toEqual([]);
  });

  it('returns only candidate images absent from every current bucket', () => {
    expect(findUnreferencedImageIds([imageA, imageB], [{ birds: [{ image: '/api/images/' + imageA }] }]))
      .toEqual([imageB]);
  });
});
