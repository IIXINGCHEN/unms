import { z } from 'zod';
export declare const ApiResponseSchema: z.ZodObject<
  {
    code: z.ZodNumber;
    message: z.ZodString;
    data: z.ZodNullable<z.ZodUnknown>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    requestId: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    code: number;
    message: string;
    data?: unknown;
    timestamp?: number | undefined;
    requestId?: string | undefined;
  },
  {
    code: number;
    message: string;
    data?: unknown;
    timestamp?: number | undefined;
    requestId?: string | undefined;
  }
>;
export type ApiResponse<T = unknown> = {
  code: number;
  message: string;
  data: T | null;
  timestamp?: number;
  requestId?: string;
};
export declare const MusicSourceSchema: z.ZodEnum<
  [
    'netease',
    'tencent',
    'tidal',
    'spotify',
    'ytmusic',
    'qobuz',
    'joox',
    'deezer',
    'migu',
    'kugou',
    'kuwo',
    'ximalaya',
  ]
>;
export type MusicSource = z.infer<typeof MusicSourceSchema>;
export declare const SongInfoSchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    artist: z.ZodString;
    album: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    pic_id: z.ZodOptional<z.ZodString>;
    lyric_id: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    name: string;
    artist: string;
    album?: string | undefined;
    duration?: number | undefined;
    pic_id?: string | undefined;
    lyric_id?: string | undefined;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    id: string;
    name: string;
    artist: string;
    album?: string | undefined;
    duration?: number | undefined;
    pic_id?: string | undefined;
    lyric_id?: string | undefined;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  }
>;
export type SongInfo = z.infer<typeof SongInfoSchema>;
export declare const SongUrlSchema: z.ZodObject<
  {
    id: z.ZodString;
    url: z.ZodString;
    br: z.ZodOptional<z.ZodNumber>;
    size: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    md5: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
    proxyUrl: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    url: string;
    type?: string | undefined;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    br?: number | undefined;
    size?: number | undefined;
    md5?: string | undefined;
    proxyUrl?: string | undefined;
  },
  {
    id: string;
    url: string;
    type?: string | undefined;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    br?: number | undefined;
    size?: number | undefined;
    md5?: string | undefined;
    proxyUrl?: string | undefined;
  }
>;
export type SongUrl = z.infer<typeof SongUrlSchema>;
export declare const SearchResultSchema: z.ZodArray<
  z.ZodObject<
    {
      id: z.ZodString;
      name: z.ZodString;
      artist: z.ZodString;
      album: z.ZodOptional<z.ZodString>;
      duration: z.ZodOptional<z.ZodNumber>;
      pic_id: z.ZodOptional<z.ZodString>;
      lyric_id: z.ZodOptional<z.ZodString>;
      source: z.ZodOptional<
        z.ZodEnum<
          [
            'netease',
            'tencent',
            'tidal',
            'spotify',
            'ytmusic',
            'qobuz',
            'joox',
            'deezer',
            'migu',
            'kugou',
            'kuwo',
            'ximalaya',
          ]
        >
      >;
    },
    'strip',
    z.ZodTypeAny,
    {
      id: string;
      name: string;
      artist: string;
      album?: string | undefined;
      duration?: number | undefined;
      pic_id?: string | undefined;
      lyric_id?: string | undefined;
      source?:
        | 'netease'
        | 'tencent'
        | 'tidal'
        | 'spotify'
        | 'ytmusic'
        | 'qobuz'
        | 'joox'
        | 'deezer'
        | 'migu'
        | 'kugou'
        | 'kuwo'
        | 'ximalaya'
        | undefined;
    },
    {
      id: string;
      name: string;
      artist: string;
      album?: string | undefined;
      duration?: number | undefined;
      pic_id?: string | undefined;
      lyric_id?: string | undefined;
      source?:
        | 'netease'
        | 'tencent'
        | 'tidal'
        | 'spotify'
        | 'ytmusic'
        | 'qobuz'
        | 'joox'
        | 'deezer'
        | 'migu'
        | 'kugou'
        | 'kuwo'
        | 'ximalaya'
        | undefined;
    }
  >,
  'many'
>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export declare const LyricSchema: z.ZodObject<
  {
    lyric: z.ZodString;
    tlyric: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    lyric: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    tlyric?: string | undefined;
  },
  {
    lyric: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    tlyric?: string | undefined;
  }
>;
export type Lyric = z.infer<typeof LyricSchema>;
export declare const PicInfoSchema: z.ZodObject<
  {
    url: z.ZodString;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    url: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    url: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  }
>;
export type PicInfo = z.infer<typeof PicInfoSchema>;
export declare const UrlRequestSchema: z.ZodObject<
  {
    id: z.ZodString;
    br: z.ZodDefault<z.ZodEnum<['128', '192', '320', '740', '999']>>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    br: '128' | '192' | '320' | '740' | '999';
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    id: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    br?: '128' | '192' | '320' | '740' | '999' | undefined;
  }
>;
export declare const SearchRequestSchema: z.ZodObject<
  {
    name: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
    pages: z.ZodDefault<z.ZodNumber>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    count: number;
    pages: number;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    name: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    count?: number | undefined;
    pages?: number | undefined;
  }
>;
export declare const PicRequestSchema: z.ZodObject<
  {
    id: z.ZodString;
    size: z.ZodDefault<z.ZodEnum<['300', '500']>>;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    size: '300' | '500';
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    id: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
    size?: '300' | '500' | undefined;
  }
>;
export declare const LyricRequestSchema: z.ZodObject<
  {
    id: z.ZodString;
    source: z.ZodOptional<
      z.ZodEnum<
        [
          'netease',
          'tencent',
          'tidal',
          'spotify',
          'ytmusic',
          'qobuz',
          'joox',
          'deezer',
          'migu',
          'kugou',
          'kuwo',
          'ximalaya',
        ]
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  },
  {
    id: string;
    source?:
      | 'netease'
      | 'tencent'
      | 'tidal'
      | 'spotify'
      | 'ytmusic'
      | 'qobuz'
      | 'joox'
      | 'deezer'
      | 'migu'
      | 'kugou'
      | 'kuwo'
      | 'ximalaya'
      | undefined;
  }
>;
export declare const MatchRequestSchema: z.ZodObject<
  {
    id: z.ZodString;
    server: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    server?: string | undefined;
  },
  {
    id: string;
    server?: string | undefined;
  }
>;
export type UrlRequest = z.infer<typeof UrlRequestSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type PicRequest = z.infer<typeof PicRequestSchema>;
export type LyricRequest = z.infer<typeof LyricRequestSchema>;
export type MatchRequest = z.infer<typeof MatchRequestSchema>;
export declare class ApiError extends Error {
  code: number;
  data?: unknown | undefined;
  constructor(code: number, message: string, data?: unknown | undefined);
}
export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  allowedDomain: string | string[];
  cacheEnabled: boolean;
  cacheDefaultTTL: number;
  proxyUrl?: string;
  databaseUrl?: string;
  redisUrl?: string;
}
export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  ttlConfig: Record<string, number>;
}
export interface UnmConfig {
  defaultSources: string[];
  testSongId: string;
}
export interface GdStudioConfig {
  baseUrl: string;
  defaultSource: MusicSource;
  validSources: MusicSource[];
  fallbackSource: MusicSource;
  requestTimeout: number;
}
//# sourceMappingURL=types.d.ts.map
