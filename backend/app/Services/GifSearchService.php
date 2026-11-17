<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GifSearchService
{
    public function provider(): string
    {
        $preferred = strtolower((string) config('services.gif.provider', 'auto'));

        if ($preferred === 'klipy' && $this->klipyKey()) {
            return 'klipy';
        }
        if ($preferred === 'giphy' && $this->giphyKey()) {
            return 'giphy';
        }
        if ($preferred === 'tenor' && $this->tenorKey()) {
            return 'tenor';
        }
        if ($preferred === 'gifsnap') {
            return 'gifsnap';
        }

        if ($this->klipyKey()) {
            return 'klipy';
        }
        if ($this->giphyKey()) {
            return 'giphy';
        }
        if ($this->tenorKey()) {
            return 'tenor';
        }

        // Keyless fallback so the Discord-style picker works out of the box.
        return 'gifsnap';
    }

    public function isConfigured(): bool
    {
        return in_array($this->provider(), ['klipy', 'giphy', 'tenor', 'gifsnap'], true);
    }

    public function search(string $query, int $limit = 24, ?string $customerId = null): array
    {
        $query = trim($query);
        if ($query === '') {
            return $this->trending($limit, $customerId);
        }

        return match ($this->provider()) {
            'klipy' => $this->searchKlipy($query, $limit, $customerId),
            'giphy' => $this->searchGiphy($query, $limit),
            'tenor' => $this->searchTenor($query, $limit),
            'gifsnap' => $this->searchGifsnap($query, $limit),
            default => [],
        };
    }

    public function trending(int $limit = 24, ?string $customerId = null): array
    {
        return match ($this->provider()) {
            'klipy' => $this->trendingKlipy($limit, $customerId),
            'giphy' => $this->trendingGiphy($limit),
            'tenor' => $this->featuredTenor($limit),
            'gifsnap' => $this->trendingGifsnap($limit),
            default => [],
        };
    }

    public function categories(?string $customerId = null): array
    {
        return match ($this->provider()) {
            'klipy' => $this->categoriesKlipy($customerId),
            'giphy' => $this->categoriesGiphy(),
            'tenor', 'gifsnap' => $this->defaultCategories(),
            default => $this->defaultCategories(),
        };
    }

    public function searchStickers(string $query, int $limit = 24, ?string $customerId = null): array
    {
        $query = trim($query);
        if ($query === '') {
            return $this->trendingStickers($limit, $customerId);
        }

        $items = match ($this->provider()) {
            'klipy' => $this->searchKlipyStickers($query, $limit, $customerId),
            'giphy' => $this->searchGiphyStickers($query, $limit),
            'tenor' => $this->searchTenorStickers($query, $limit),
            'gifsnap' => $this->searchGifsnapStickers($query, $limit),
            default => [],
        };

        // GifSnap sticker catalog can be empty; fall back to GIF search results as stickers.
        if ($items === [] && $this->provider() === 'gifsnap') {
            return array_map(
                fn (array $row) => array_merge($row, ['provider' => 'gifsnap', 'kind' => 'sticker']),
                $this->searchGifsnap($query, $limit)
            );
        }

        return $items;
    }

    public function trendingStickers(int $limit = 24, ?string $customerId = null): array
    {
        $items = match ($this->provider()) {
            'klipy' => $this->trendingKlipyStickers($limit, $customerId),
            'giphy' => $this->trendingGiphyStickers($limit),
            'tenor' => $this->searchTenorStickers('happy', $limit),
            'gifsnap' => $this->trendingGifsnapStickers($limit),
            default => [],
        };

        if ($items === [] && $this->provider() === 'gifsnap') {
            return array_map(
                fn (array $row) => array_merge($row, ['provider' => 'gifsnap', 'kind' => 'sticker']),
                $this->trendingGifsnap($limit)
            );
        }

        return $items;
    }

    private function klipyKey(): ?string
    {
        $key = trim((string) config('services.gif.klipy_key'));

        return $key !== '' ? $key : null;
    }

    private function giphyKey(): ?string
    {
        $key = trim((string) config('services.gif.giphy_key'));

        return $key !== '' ? $key : null;
    }

    private function tenorKey(): ?string
    {
        $key = trim((string) config('services.gif.tenor_key'));

        return $key !== '' ? $key : null;
    }

    private function searchKlipy(string $query, int $limit, ?string $customerId): array
    {
        $response = Http::timeout(12)->acceptJson()->get(
            'https://api.klipy.com/api/v1/'.$this->klipyKey().'/gifs/search',
            array_filter([
                'q' => $query,
                'page' => 1,
                'per_page' => max(8, min(50, $limit)),
                'customer_id' => $customerId,
                'locale' => 'us',
                'content_filter' => 'medium',
                'format_filter' => 'gif',
            ])
        );

        if (! $response->successful()) {
            return [];
        }

        return $this->mapKlipyItems(data_get($response->json(), 'data.data', []));
    }

    private function trendingKlipy(int $limit, ?string $customerId): array
    {
        $response = Http::timeout(12)->acceptJson()->get(
            'https://api.klipy.com/api/v1/'.$this->klipyKey().'/gifs/trending',
            array_filter([
                'page' => 1,
                'per_page' => max(8, min(50, $limit)),
                'customer_id' => $customerId,
                'locale' => 'us',
                'content_filter' => 'medium',
                'format_filter' => 'gif',
            ])
        );

        if (! $response->successful()) {
            return [];
        }

        return $this->mapKlipyItems(data_get($response->json(), 'data.data', []));
    }

    private function categoriesKlipy(?string $customerId): array
    {
        $response = Http::timeout(12)->acceptJson()->get(
            'https://api.klipy.com/api/v1/'.$this->klipyKey().'/gifs/categories',
            array_filter([
                'locale' => 'us',
                'customer_id' => $customerId,
            ])
        );

        if (! $response->successful()) {
            return $this->defaultCategories();
        }

        $rows = data_get($response->json(), 'data.data', data_get($response->json(), 'data', []));
        if (! is_array($rows)) {
            return $this->defaultCategories();
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? $row['title'] ?? $row['slug'] ?? ''));
            if ($name === '') {
                continue;
            }
            $out[] = [
                'id' => Str::slug($name),
                'label' => $name,
                'query' => $name,
                'cover' => (string) ($row['preview_url'] ?? $row['image'] ?? ''),
                'tint' => 'grey',
            ];
            if (count($out) >= 12) {
                break;
            }
        }

        return $out ?: $this->defaultCategories();
    }

    private function mapKlipyItems(mixed $items, string $kind = 'gif'): array
    {
        if (! is_array($items)) {
            return [];
        }

        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $slug = (string) ($item['slug'] ?? $item['id'] ?? '');
            $file = data_get($item, 'file.hd.webp.url')
                ?: data_get($item, 'file.md.webp.url')
                ?: data_get($item, 'file.hd.gif.url')
                ?: data_get($item, 'file.md.gif.url')
                ?: data_get($item, 'file.sm.gif.url')
                ?: data_get($item, 'file.sm.webp.url');
            $preview = data_get($item, 'file.sm.webp.url')
                ?: data_get($item, 'file.sm.gif.url')
                ?: data_get($item, 'file.md.webp.url')
                ?: $file;

            if (! $file) {
                continue;
            }

            $out[] = [
                'id' => $slug !== '' ? $slug : md5((string) $file),
                'title' => (string) ($item['title'] ?? $item['name'] ?? ($kind === 'sticker' ? 'Sticker' : 'GIF')),
                'url' => (string) $file,
                'preview_url' => (string) ($preview ?: $file),
                'provider' => 'klipy',
                'kind' => $kind,
            ];
        }

        return $out;
    }

    private function searchGiphy(string $query, int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://api.giphy.com/v1/gifs/search', [
            'api_key' => $this->giphyKey(),
            'q' => $query,
            'limit' => max(1, min(50, $limit)),
            'rating' => 'pg-13',
            'lang' => 'en',
            'bundle' => 'messaging_non_clips',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapGiphyItems($response->json('data') ?? []);
    }

    private function trendingGiphy(int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://api.giphy.com/v1/gifs/trending', [
            'api_key' => $this->giphyKey(),
            'limit' => max(1, min(50, $limit)),
            'rating' => 'pg-13',
            'bundle' => 'messaging_non_clips',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapGiphyItems($response->json('data') ?? []);
    }

    private function categoriesGiphy(): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://api.giphy.com/v1/gifs/categories', [
            'api_key' => $this->giphyKey(),
        ]);

        if (! $response->successful()) {
            return $this->defaultCategories();
        }

        $rows = $response->json('data') ?? [];
        $out = [
            [
                'id' => 'trending',
                'label' => 'Trending GIFs',
                'query' => '',
                'cover' => '',
                'tint' => 'slate',
                'icon' => 'chart',
            ],
        ];

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $gif = data_get($row, 'gif.images.fixed_width_small.url')
                ?: data_get($row, 'gif.images.preview_gif.url')
                ?: data_get($row, 'gif.images.original.url');
            $out[] = [
                'id' => Str::slug($name),
                'label' => strtolower($name),
                'query' => $name,
                'cover' => (string) ($gif ?: ''),
                'tint' => 'grey',
            ];
            if (count($out) >= 12) {
                break;
            }
        }

        return $out;
    }

    private function mapGiphyItems(mixed $items, string $kind = 'gif'): array
    {
        if (! is_array($items)) {
            return [];
        }

        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $url = data_get($item, 'images.original.url')
                ?: data_get($item, 'images.downsized.url')
                ?: data_get($item, 'images.fixed_height.url');
            $preview = data_get($item, 'images.fixed_width.url')
                ?: data_get($item, 'images.preview_gif.url')
                ?: $url;
            if (! $url) {
                continue;
            }
            $out[] = [
                'id' => (string) ($item['id'] ?? md5((string) $url)),
                'title' => (string) ($item['title'] ?? ($kind === 'sticker' ? 'Sticker' : 'GIF')),
                'url' => (string) $url,
                'preview_url' => (string) ($preview ?: $url),
                'provider' => 'giphy',
                'kind' => $kind,
            ];
        }

        return $out;
    }

    private function searchGifsnap(string $query, int $limit): array
    {
        $response = $this->gifsnapGet('https://gifsnap.com/api/v1/gifs/search', [
            'q' => $query,
            'page' => 1,
            'limit' => max(1, min(50, $limit)),
        ]);

        if (! $response || ! $response->successful()) {
            return [];
        }

        return $this->mapGifsnapItems($response->json('data') ?? []);
    }

    private function trendingGifsnap(int $limit): array
    {
        $response = $this->gifsnapGet('https://gifsnap.com/api/v1/gifs/trending', [
            'page' => 1,
            'limit' => max(1, min(50, $limit)),
        ]);

        if (! $response || ! $response->successful()) {
            return [];
        }

        return $this->mapGifsnapItems($response->json('data') ?? []);
    }

    private function searchGifsnapStickers(string $query, int $limit): array
    {
        $response = $this->gifsnapGet('https://gifsnap.com/api/v1/stickers/search', [
            'q' => $query,
            'page' => 1,
            'limit' => max(1, min(50, $limit)),
        ]);

        if (! $response || ! $response->successful()) {
            return [];
        }

        return $this->mapGifsnapItems($response->json('data') ?? [], 'sticker');
    }

    private function trendingGifsnapStickers(int $limit): array
    {
        $response = $this->gifsnapGet('https://gifsnap.com/api/v1/stickers/trending', [
            'page' => 1,
            'limit' => max(1, min(50, $limit)),
        ]);

        if (! $response || ! $response->successful()) {
            return [];
        }

        return $this->mapGifsnapItems($response->json('data') ?? [], 'sticker');
    }

    private function searchKlipyStickers(string $query, int $limit, ?string $customerId): array
    {
        $response = Http::timeout(12)->acceptJson()->get(
            'https://api.klipy.com/api/v1/'.$this->klipyKey().'/stickers/search',
            array_filter([
                'q' => $query,
                'page' => 1,
                'per_page' => max(8, min(50, $limit)),
                'customer_id' => $customerId,
                'locale' => 'us',
                'content_filter' => 'medium',
            ])
        );

        if (! $response->successful()) {
            return [];
        }

        return $this->mapKlipyItems(data_get($response->json(), 'data.data', []), 'sticker');
    }

    private function trendingKlipyStickers(int $limit, ?string $customerId): array
    {
        $response = Http::timeout(12)->acceptJson()->get(
            'https://api.klipy.com/api/v1/'.$this->klipyKey().'/stickers/trending',
            array_filter([
                'page' => 1,
                'per_page' => max(8, min(50, $limit)),
                'customer_id' => $customerId,
                'locale' => 'us',
                'content_filter' => 'medium',
            ])
        );

        if (! $response->successful()) {
            return [];
        }

        return $this->mapKlipyItems(data_get($response->json(), 'data.data', []), 'sticker');
    }

    private function searchGiphyStickers(string $query, int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://api.giphy.com/v1/stickers/search', [
            'api_key' => $this->giphyKey(),
            'q' => $query,
            'limit' => max(1, min(50, $limit)),
            'rating' => 'pg-13',
            'lang' => 'en',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapGiphyItems($response->json('data') ?? [], 'sticker');
    }

    private function trendingGiphyStickers(int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://api.giphy.com/v1/stickers/trending', [
            'api_key' => $this->giphyKey(),
            'limit' => max(1, min(50, $limit)),
            'rating' => 'pg-13',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapGiphyItems($response->json('data') ?? [], 'sticker');
    }

    private function searchTenorStickers(string $query, int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://tenor.googleapis.com/v2/search', [
            'key' => $this->tenorKey(),
            'q' => $query,
            'limit' => max(1, min(50, $limit)),
            'client_key' => '29gold_chat',
            'searchfilter' => 'sticker',
            'media_filter' => 'gif,tinygif,webp_transparent,tinywebp_transparent',
            'contentfilter' => 'medium',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapTenorItems($response->json('results') ?? [], 'sticker');
    }

    private function gifsnapGet(string $url, array $query)
    {
        try {
            return Http::timeout(25)
                ->connectTimeout(10)
                ->retry(2, 400)
                ->acceptJson()
                ->withHeaders([
                    'User-Agent' => '29GoldChat/1.0',
                ])
                ->get($url, $query);
        } catch (\Throwable) {
            return null;
        }
    }

    private function mapGifsnapItems(mixed $items, string $kind = 'gif'): array
    {
        if (! is_array($items)) {
            return [];
        }

        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $url = (string) ($item['url'] ?? '');
            $preview = (string) (
                data_get($item, 'animated_preview.url')
                ?: ($item['preview_url'] ?? '')
                ?: $url
            );
            if ($url === '') {
                continue;
            }
            $out[] = [
                'id' => (string) ($item['id'] ?? md5($url)),
                'title' => (string) ($item['title'] ?? ($kind === 'sticker' ? 'Sticker' : 'GIF')),
                'url' => $url,
                'preview_url' => $preview !== '' ? $preview : $url,
                'provider' => 'gifsnap',
                'kind' => $kind,
            ];
        }

        return $out;
    }

    private function searchTenor(string $query, int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://tenor.googleapis.com/v2/search', [
            'key' => $this->tenorKey(),
            'q' => $query,
            'limit' => max(1, min(50, $limit)),
            'client_key' => '29gold_chat',
            'media_filter' => 'gif,tinygif',
            'contentfilter' => 'medium',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapTenorItems($response->json('results') ?? []);
    }

    private function featuredTenor(int $limit): array
    {
        $response = Http::timeout(12)->acceptJson()->get('https://tenor.googleapis.com/v2/featured', [
            'key' => $this->tenorKey(),
            'limit' => max(1, min(50, $limit)),
            'client_key' => '29gold_chat',
            'media_filter' => 'gif,tinygif',
            'contentfilter' => 'medium',
        ]);

        if (! $response->successful()) {
            return [];
        }

        return $this->mapTenorItems($response->json('results') ?? []);
    }

    private function mapTenorItems(mixed $items, string $kind = 'gif'): array
    {
        if (! is_array($items)) {
            return [];
        }

        $out = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $url = data_get($item, 'media_formats.webp_transparent.url')
                ?: data_get($item, 'media_formats.gif.url')
                ?: data_get($item, 'media_formats.mediumgif.url')
                ?: data_get($item, 'media_formats.tinygif.url');
            $preview = data_get($item, 'media_formats.tinywebp_transparent.url')
                ?: data_get($item, 'media_formats.tinygif.url')
                ?: data_get($item, 'media_formats.nanogif.url')
                ?: $url;
            if (! $url) {
                continue;
            }
            $out[] = [
                'id' => (string) ($item['id'] ?? md5((string) $url)),
                'title' => (string) ($item['title'] ?? ($kind === 'sticker' ? 'Sticker' : 'GIF')),
                'url' => (string) $url,
                'preview_url' => (string) ($preview ?: $url),
                'provider' => 'tenor',
                'kind' => $kind,
            ];
        }

        return $out;
    }

    private function defaultCategories(): array
    {
        return [
            ['id' => 'trending', 'label' => 'Trending GIFs', 'query' => '', 'cover' => '', 'tint' => 'slate', 'icon' => 'chart'],
            ['id' => 'hello', 'label' => 'hello', 'query' => 'hello', 'cover' => '', 'tint' => 'grey'],
            ['id' => 'lol', 'label' => 'lol', 'query' => 'lol', 'cover' => '', 'tint' => 'grey'],
            ['id' => 'love', 'label' => 'love', 'query' => 'love', 'cover' => '', 'tint' => 'brown'],
            ['id' => 'happy-birthday', 'label' => 'happy birthday', 'query' => 'happy birthday', 'cover' => '', 'tint' => 'party'],
            ['id' => 'thank-you', 'label' => 'thank you', 'query' => 'thank you', 'cover' => '', 'tint' => 'blue'],
            ['id' => 'yes', 'label' => 'yes', 'query' => 'yes', 'cover' => '', 'tint' => 'grey'],
            ['id' => 'no', 'label' => 'no', 'query' => 'no', 'cover' => '', 'tint' => 'grey'],
            ['id' => 'congrats', 'label' => 'congrats', 'query' => 'congrats', 'cover' => '', 'tint' => 'party'],
            ['id' => 'ok', 'label' => 'ok', 'query' => 'ok', 'cover' => '', 'tint' => 'blue'],
        ];
    }
}
