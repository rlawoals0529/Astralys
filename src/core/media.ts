export interface MediaCapability { provider: 'youtube' | 'remote-file' | 'unsupported'; enabled: false; title: string; message: string; links?: {label:string;href:string}[]; }
export const YOUTUBE_RESOLVER_ENABLED = false;
export function classifyMediaLink(input: string): MediaCapability {
  if(input.length > 2048) throw new Error('This link is too long. Use a link under 2048 characters.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a complete HTTPS link.'); }
  if(url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Use HTTPS without embedded credentials or a custom port.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if(host==='youtu.be' || host==='youtube.com' || host.endsWith('.youtube.com')) return {provider:'youtube',enabled:false,title:'YouTube downloads remain gated',message:'Open the original page to watch. For your own uploads: YouTube Studio → Content → video menu → Download, subject to YouTube availability and limits. Google Takeout can export your uploads. Astralys does not extract streams or download YouTube videos. No request was sent. Links below leave Astralys only when clicked.',links:[{label:'Open original on YouTube',href:url.href},{label:'Owner download instructions',href:'https://support.google.com/youtube/answer/56100'},{label:'Open YouTube Studio',href:'https://studio.youtube.com/'},{label:'Export your uploads with Google Takeout',href:'https://takeout.google.com/'}]};
  // This is classification only, never an SSRF validator or authorization for fetching.
  if(/\.(mp4|mov|mp3|m4a|wav|webm)$/i.test(url.pathname)) {
    // Navigation is opt-in, not a fetch proxy; never offer local/private destinations or protected stream hosts.
    const blocked=host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||host==='googlevideo.com'||host.endsWith('.googlevideo.com');
    return {provider:'remote-file',enabled:false,title:'Open a direct media source',message:'Remote processing is not enabled. Only open a source you trust, own or have permission to download from, using a method the source permits. A file extension does not verify content or rights. Your browser and the source decide whether this opens a player or downloads; Astralys cannot guarantee either. Opening leaves Astralys and contacts the source. No connection was made during this check.',links:blocked?undefined:[{label:'Open supplied media URL',href:url.href}]};
  }
  return {provider:'unsupported',enabled:false,title:'This provider is not supported',message:'No content was fetched. You can work with a local PNG, JPEG or WebP image instead.'};
}
