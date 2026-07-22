import { describe, expect, it } from "vitest";
import {
  youtubeId,
  spotifyEmbedUrl,
  driveFileId,
} from "../../src/features/modules/parse.ts";

describe("youtubeId", () => {
  it("watch, kısa link, shorts, embed ve çıplak id'yi çözer", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      youtubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(youtubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("liste parametresiyle watch linkini çözer", () => {
    expect(
      youtubeId("https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("geçersiz girdide undefined döner", () => {
    expect(youtubeId("https://vimeo.com/12345")).toBeUndefined();
    expect(youtubeId("kısa")).toBeUndefined();
  });
});

describe("spotifyEmbedUrl", () => {
  it("track/album/playlist/episode linklerini embed'e çevirir", () => {
    expect(
      spotifyEmbedUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"),
    ).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(
      spotifyEmbedUrl(
        "https://open.spotify.com/intl-tr/album/1ATL5GLyefJaxhQzSPVrLX?si=x",
      ),
    ).toBe("https://open.spotify.com/embed/album/1ATL5GLyefJaxhQzSPVrLX");
    expect(
      spotifyEmbedUrl("https://open.spotify.com/embed/playlist/37i9dQZF1DX0"),
    ).toBe("https://open.spotify.com/embed/playlist/37i9dQZF1DX0");
  });

  it("spotify: URI'sini çevirir", () => {
    expect(spotifyEmbedUrl("spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toBe(
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    );
  });

  it("geçersiz girdide undefined döner", () => {
    expect(spotifyEmbedUrl("https://example.com")).toBeUndefined();
  });
});

describe("driveFileId", () => {
  const id = "1WVA5lPQDIWy-bNZvGGyNT6hifjpTDocF";
  it("file/d, open?id, uc?id linklerini ve çıplak id'yi çözer", () => {
    expect(driveFileId(`https://drive.google.com/file/d/${id}/view`)).toBe(id);
    expect(driveFileId(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(driveFileId(`https://drive.google.com/uc?export=view&id=${id}`)).toBe(
      id,
    );
    expect(driveFileId(id)).toBe(id);
  });

  it("geçersiz girdide undefined döner", () => {
    expect(driveFileId("https://example.com/dosya.pdf")).toBeUndefined();
    expect(driveFileId("kısa-id")).toBeUndefined();
  });
});
