<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ImportSqliteToMysql extends Command
{
    protected $signature = 'db:import-sqlite
        {--path= : SQLite file (default: database/database.sqlite)}
        {--truncate : Empty each MySQL table before copying rows}';

    protected $description = 'Copy data from the legacy SQLite file into the active MySQL database';

    /** @var list<string> */
    private const SKIP_TABLES = [
        'migrations',
        'sqlite_sequence',
    ];

    public function handle(): int
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->error('Set DB_CONNECTION=mysql in .env before importing.');

            return self::FAILURE;
        }

        $path = $this->option('path') ?: database_path('database.sqlite');
        if (! is_file($path)) {
            $this->error("SQLite file not found: {$path}");

            return self::FAILURE;
        }

        config(['database.connections.sqlite_import' => [
            'driver' => 'sqlite',
            'database' => $path,
            'prefix' => '',
            'foreign_key_constraints' => false,
        ]]);

        $sqlite = DB::connection('sqlite_import');
        $mysql = DB::connection();

        $tables = collect($sqlite->select(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ))->pluck('name')
            ->reject(fn (string $name) => in_array($name, self::SKIP_TABLES, true))
            ->values();

        if ($tables->isEmpty()) {
            $this->warn('No user tables found in SQLite file.');

            return self::SUCCESS;
        }

        Schema::disableForeignKeyConstraints();

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                $this->warn("Skipping {$table} (not in MySQL schema — run migrate first).");

                continue;
            }

            if ($this->option('truncate')) {
                DB::table($table)->truncate();
            } elseif (DB::table($table)->count() > 0) {
                $this->error("Table {$table} already has rows. Re-run with --truncate to replace.");

                Schema::enableForeignKeyConstraints();

                return self::FAILURE;
            }

            $total = 0;
            $offset = 0;
            $chunk = 500;

            while (true) {
                $rows = $sqlite->table($table)->offset($offset)->limit($chunk)->get();
                if ($rows->isEmpty()) {
                    break;
                }

                $payload = $rows->map(fn ($row) => (array) $row)->all();
                DB::table($table)->insert($payload);
                $total += count($payload);
                $offset += $chunk;
            }

            $this->line("{$table}: {$total} rows");
        }

        Schema::enableForeignKeyConstraints();

        $this->info('SQLite import finished.');

        return self::SUCCESS;
    }
}