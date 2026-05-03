import { describe, it, expect, vi } from 'vitest';
import { pathToFileURL } from 'node:url';

describe('Media Loader Protocol Logic', () => {
  it('should correctly decode and convert paths', () => {
    const requestUrl = 'media-loader://local/C%3A%2FVideos%2Ftest%20video.mp4';
    const url = new URL(requestUrl);
    let decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.startsWith('/')) {
      decodedPath = decodedPath.substring(1);
    }
    
    expect(decodedPath).toBe('C:/Videos/test video.mp4');
    
    const fileUrl = pathToFileURL(decodedPath).toString();
    // On Windows: file:///C:/Videos/test%20video.mp4
    // On Linux: file:///C:%5CVideos%5Ctest%20video.mp4 (though C:\ is not common there)
    
    expect(fileUrl.startsWith('file:///')).toBe(true);
    expect(fileUrl).toContain('test%20video.mp4');
  });

  it('should correctly encode paths in the UI (openLocalPreview logic)', () => {
    const filePath = 'C:\\Videos\\test video.mp4';
    const normalizedPath = filePath.replace(/\\/g, '/');
    const encodedPath = encodeURIComponent(normalizedPath);
    const protocolUrl = `media-loader://local/${encodedPath}`;
    
    expect(protocolUrl).toBe('media-loader://local/C%3A%2FVideos%2Ftest%20video.mp4');
  });
});
