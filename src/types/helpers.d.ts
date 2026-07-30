// src/types/helpers.d.ts

declare module '*/utils/helpers' {
    export function asInteger(value: any): number | null;
    export function normalizeDateToISO(val: any): string | null;
    export function formatDateToBR(val: any): string | null;
    export function selectAll(tableName: string, whereClause?: string, params?: any[]): Promise<any[]>;
    export function getLogAuditoria(): Promise<any[]>;
    export function getLogNotificacoes(): Promise<any[]>;
    export function getLogExecucoes(): Promise<any[]>;
    export function getFilaRunner(): Promise<any[]>;
}
