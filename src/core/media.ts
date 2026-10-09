export interface MediaCapability { provider: 'youtube' | 'remote-file' | 'unsupported'; enabled: false; title: string; message: string; }
export const YOUTUBE_RESOLVER_ENABLED = false;
export function classifyMediaLink(input: string): MediaCapability {
  if(input.length > 2048) throw new Error('This link is too long. Use a link under 2048 characters.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a complete HTTPS link.'); }
  if(url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Use HTTPS without embedded credentials or a custom port.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if(host==='youtu.be' || host==='youtube.com' || host.endsWith('.youtube.com')) return {provider:'youtube',enabled:false,title:'YouTube is recognized, but gated',message:'Downloading is unavailable while platform permissions and product policy are reviewed. For your own uploads, use an authorized export route. No request was sent to YouTube.'};
  // This is classification only, never an SSRF validator or authorization for fetching.
  if(/\.(mp4|mov|mp3|m4a|wav|webm)$/i.test(url.pathname)) return {provider:'remote-file',enabled:false,title:'Remote media is not enabled yet',message:'Ownership or permission is required, and the source must allow the retrieval method. No connection was made. Local audio/video conversion is also planned, not available in this build.'};
  return {provider:'unsupported',enabled:false,title:'This provider is not supported',message:'No content was fetched. You can work with a local PNG, JPEG or WebP image instead.'};
}
