<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PointLedger;
use App\Models\Purchase;
use App\Models\User;
use App\Services\AuditService;
use App\Support\DateRangeQuery;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function customers(Request $request): StreamedResponse
    {
        $query = User::query()
            ->where('role', 'customer')
            ->orderBy('id');

        if ($request->filled('tier')) {
            $query->where('tier', (string) $request->string('tier'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        AuditService::log(
            $request->user(),
            'export_customers',
            'Exported customers CSV',
            null,
            ['filters' => $request->only(['tier', 'search'])],
            $request,
        );

        return $this->streamCsv(
            'customers-'.now()->format('Ymd-His').'.csv',
            ['customer_code', 'name', 'email', 'phone', 'address', 'tier', 'redeemable_points', 'tier_points_365d', 'total_spent', 'last_activity_at', 'created_at'],
            function () use ($query) {
                foreach ($query->cursor() as $row) {
                    yield [
                        $row->customer_code,
                        $row->name,
                        $row->email,
                        $row->phone,
                        $row->address,
                        $row->tier,
                        $row->redeemable_points,
                        $row->tier_points_365d,
                        $row->total_spent,
                        optional($row->last_activity_at)?->toDateTimeString(),
                        optional($row->created_at)?->toDateTimeString(),
                    ];
                }
            },
        );
    }

    public function purchases(Request $request): StreamedResponse
    {
        $query = Purchase::query()
            ->with('user:id,customer_code,name,email,phone')
            ->orderBy('id');

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                    ->orWhere('product_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('customer_code', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        DateRangeQuery::applyCoalesce($query, $request, ['sold_at', 'created_at']);

        AuditService::log(
            $request->user(),
            'export_purchases',
            'Exported purchases CSV',
            null,
            ['filters' => $request->only(['search', 'date_from', 'date_to'])],
            $request,
        );

        return $this->streamCsv(
            'purchases-'.now()->format('Ymd-His').'.csv',
            ['id', 'customer_code', 'customer_name', 'product_name', 'product_code', 'product_type', 'amount', 'points_redeemed', 'net_amount', 'points_earned', 'payment_method', 'status', 'created_at'],
            function () use ($query) {
                foreach ($query->cursor() as $row) {
                    yield [
                        $row->id,
                        $row->user?->customer_code,
                        $row->user?->name,
                        $row->product_name,
                        $row->product_code,
                        $row->product_type,
                        $row->amount,
                        $row->points_redeemed,
                        $row->net_amount,
                        $row->points_earned,
                        $row->payment_method,
                        $row->status ?? 'recorded',
                        optional($row->created_at)?->toDateTimeString(),
                    ];
                }
            },
        );
    }

    public function ledger(Request $request): StreamedResponse
    {
        $query = PointLedger::query()
            ->with('user:id,customer_code,name,email')
            ->orderBy('id');

        if ($request->filled('type')) {
            $query->where('type', (string) $request->string('type'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        DateRangeQuery::apply($query, $request);

        AuditService::log(
            $request->user(),
            'export_ledger',
            'Exported ledger CSV',
            null,
            ['filters' => $request->only(['type', 'search', 'date_from', 'date_to'])],
            $request,
        );

        return $this->streamCsv(
            'ledger-'.now()->format('Ymd-His').'.csv',
            ['id', 'customer_code', 'customer_name', 'type', 'source', 'points', 'tier_eligible', 'meta', 'created_at'],
            function () use ($query) {
                foreach ($query->cursor() as $row) {
                    yield [
                        $row->id,
                        $row->user?->customer_code,
                        $row->user?->name,
                        $row->type,
                        $row->source,
                        $row->points,
                        $row->tier_eligible ? 1 : 0,
                        $row->meta ? json_encode($row->meta) : '',
                        optional($row->created_at)?->toDateTimeString(),
                    ];
                }
            },
        );
    }

    private function streamCsv(string $filename, array $headers, callable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, $headers);
            foreach ($rows() as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
