<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class DateRangeQuery
{
    public static function apply(Builder $query, Request $request, string $column = 'created_at'): Builder
    {
        [$from, $to] = self::bounds($request);

        if ($from !== null) {
            $query->whereDate($column, '>=', $from);
        }
        if ($to !== null) {
            $query->whereDate($column, '<=', $to);
        }

        return $query;
    }

    /**
     * Filter by DATE(COALESCE(...)) for columns like purchase sold_at/created_at.
     *
     * @param  list<string>  $columns
     */
    public static function applyCoalesce(Builder $query, Request $request, array $columns): Builder
    {
        [$from, $to] = self::bounds($request);
        if ($from === null && $to === null) {
            return $query;
        }

        $expr = 'COALESCE('.implode(', ', $columns).')';

        if ($from !== null) {
            $query->whereRaw("DATE({$expr}) >= ?", [$from]);
        }
        if ($to !== null) {
            $query->whereRaw("DATE({$expr}) <= ?", [$to]);
        }

        return $query;
    }

    /**
     * @return array{0:?string,1:?string}
     */
    public static function bounds(Request $request): array
    {
        $from = trim((string) $request->input('date_from', ''));
        $to = trim((string) $request->input('date_to', ''));

        if ($from !== '' && ! self::isDate($from)) {
            $from = '';
        }
        if ($to !== '' && ! self::isDate($to)) {
            $to = '';
        }

        if ($from !== '' && $to !== '' && $from > $to) {
            [$from, $to] = [$to, $from];
        }

        return [
            $from !== '' ? $from : null,
            $to !== '' ? $to : null,
        ];
    }

    private static function isDate(string $value): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
    }
}
