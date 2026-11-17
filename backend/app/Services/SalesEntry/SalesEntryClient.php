<?php

namespace App\Services\SalesEntry;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class SalesEntryClient
{
    public function fetchMasterSetup(int $page = 1, ?int $perPage = null): array
    {
        $apiKey = (string) config('salesentry.api_key');
        if ($apiKey === '') {
            throw new RuntimeException('SALESENTRY_API_KEY is not configured.');
        }

        $perPage = $perPage ?: (int) config('salesentry.per_page', 100);
        $url = config('salesentry.base_url').'/api/master-setup';

        try {
            $request = Http::connectTimeout(30)
                ->timeout((int) config('salesentry.timeout', 90))
                ->retry(3, 1500, throw: false)
                ->acceptJson()
                ->withHeaders(['X-API-KEY' => $apiKey]);

            $caBundle = (string) config('salesentry.ca_bundle', '');
            if ($caBundle === '') {
                $defaultBundle = storage_path('certs/cacert.pem');
                if (is_file($defaultBundle)) {
                    $caBundle = $defaultBundle;
                }
            }
            if ($caBundle !== '' && is_file($caBundle)) {
                $request = $request->withOptions(['verify' => $caBundle]);
            }

            $response = $request->get($url, [
                'per_page' => $perPage,
                'page' => $page,
                'sort' => 'date',
                'order' => 'desc',
            ])->throw();
        } catch (\Throwable $e) {
            throw new RuntimeException('Sales Entry API request failed: '.$e->getMessage(), previous: $e);
        }

        $json = $response->json();
        if (! is_array($json) || empty($json['success'])) {
            throw new RuntimeException('Sales Entry API returned an unexpected payload.');
        }

        return $json;
    }
}
