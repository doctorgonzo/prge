// Minimal ambient types for the `yt-search` package (which ships JS without
// type declarations). We only describe the surface track-resolver.ts uses;
// the package has many other modes (videoId lookup, listId, channels, etc.)
// we don't touch here.
declare module "yt-search" {
  interface YtsVideoResult {
    type?: string;
    videoId?: string;
    title?: string;
    author?: { name?: string; url?: string };
    seconds?: number;
    duration?: { seconds: number; timestamp: string };
  }

  interface YtsSearchResult {
    videos?: YtsVideoResult[];
    playlists?: unknown[];
    channels?: unknown[];
    live?: unknown[];
  }

  function yts(query: string): Promise<YtsSearchResult>;
  export default yts;
  export = yts;
}
