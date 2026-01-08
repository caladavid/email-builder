// ComparisonSystem.ts
import { ParseError } from "./ParseErrorTest";

export interface ComparisonResult {
    element: {
        tag: string;
        id?: string;
        classes?: string;
        html?: string;
    };
    legacyResult: any;
    matcherResult: any;
    matcherName: string;
    differences: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class ComparisonSystem {
    private comparisonResults: ComparisonResult[] = [];
    private legacyBlocksCache: Map<Element, { id: string; block: any }> = new Map();
    private loggingEnabled: boolean = true;
    private startTime: number = 0;

    constructor() {
        this.startTime = performance.now()
    }

    /**
     * Compara dos bloques (legacy vs matcher)
     */
    public compare(
        element: Element,
        legacyData: { id: string; block: any } | null,
        matcherResult: { id: string; block: any } | null,
        matcherName: string
    ): void {
        if (!legacyData || !matcherResult) {
            // Si uno de los dos falta, es una diferencia crítica
            if (legacyData && !matcherResult) {
                this.recordDifference(
                    element,
                    legacyData,
                    null,
                    matcherName,
                    ['MATCHER_MISSING'],
                    'HIGH'
                );
            } else if (!legacyData && matcherResult) {
                this.recordDifference(
                    element,
                    null,
                    matcherResult,
                    matcherName,
                    ['LEGACY_MISSING'],
                    'HIGH'
                );
            }
            return;
        }

        const differences: string[] = [];
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

        // Comparar tipo de bloque
        if (legacyData.block?.type !== matcherResult.block?.type) {
            differences.push(
                `TIPO DIFERENTE: Legacy=${legacyData.block?.type}, Matcher=${matcherResult.block?.type}`
            );
            severity = 'HIGH';
        }

        // Comparar estructura de datos
        const legacyProps = legacyData.block?.data?.props;
        const matcherProps = matcherResult.block?.data?.props;

        if (JSON.stringify(legacyProps) !== JSON.stringify(matcherProps)) {
            differences.push('PROPS DIFERENTES');
            severity = severity === 'LOW' ? 'MEDIUM' : severity;
        }

        // Comparar estilos
        const legacyStyles = legacyData.block?.data?.style;
        const matcherStyles = matcherResult.block?.data?.style;

        const styleDiff = this.compareStyles(legacyStyles, matcherStyles);
        if (styleDiff.length > 0) {
            differences.push(`ESTILOS DIFERENTES: ${styleDiff.join(', ')}`);
            severity = severity === 'LOW' ? 'MEDIUM' : severity;
        }

        if (differences.length > 0) {
            this.recordDifference(
                element,
                legacyData,
                matcherResult,
                matcherName,
                differences,
                severity
            );
        }
    }

    private compareStyles(style1: any, style2: any): string[] {
        const differences: string[] = [];

        if (!style1 || !style2) return differences;

        const allKeys = new Set([
            ...Object.keys(style1 || {}),
            ...Object.keys(style2 || {})
        ]);

        allKeys.forEach(key => {
            const val1 = style1[key];
            const val2 = style2[key];

            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                const norm1 = this.normalizeStyleValue(val1);
                const norm2 = this.normalizeStyleValue(val2);

                if (norm1 !== norm2) {
                    differences.push(key);
                }
            }
        });

        return differences;
    }

    private normalizeStyleValue(value: any): string {
        if (value === null || value === undefined) return '';

        if (typeof value === 'string') {
            return value
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/['"]/g, '')
                .replace(/px/g, '')
                .replace(/important/g, '')
                .trim();
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    private recordDifference(
        element: Element,
        legacyData: any,
        matcherResult: any,
        matcherName: string,
        differences: string[],
        severity: 'LOW' | 'MEDIUM' | 'HIGH'
    ): void {
        this.comparisonResults.push({
            element: {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                classes: element.className,
                html: element.outerHTML.substring(0, 200)
            },
            legacyResult: legacyData,
            matcherResult: matcherResult,
            matcherName,
            differences,
            severity
        });

        // Log crítico en consola
        if (this.loggingEnabled && severity === 'HIGH') {
            console.log(
                `%c[COMPARISON CRITICAL] ${differences.join(' | ')}`,
                'color: red; font-weight: bold; background: yellow; padding: 2px;',
                element
            );
        }
    }

    public setLoggingEnabled(enabled: boolean): void {
        this.loggingEnabled = enabled;
    }

    public getResults(): ComparisonResult[] {
        return this.comparisonResults;
    }

    public clearResults(): void {
        this.comparisonResults = [];
        this.legacyBlocksCache.clear();
        this.startTime = performance.now();
    }

    public generateReport(): {
        summary: {
            totalComparisons: number;
            bySeverity: { LOW: number; MEDIUM: number; HIGH: number };
            byMatcher: Record<string, number>;
            criticalElements: string[];
        };
        details: ComparisonResult[];
    } {
        const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0 };
        const byMatcher: Record<string, number> = {};
        const criticalElements: string[] = [];

        this.comparisonResults.forEach(result => {
            bySeverity[result.severity]++;
            byMatcher[result.matcherName] = (byMatcher[result.matcherName] || 0) + 1;

            if (result.severity === 'HIGH') {
                criticalElements.push(`${result.element.tag} (${result.matcherName})`);
            }
        });

        return {
            summary: {
                totalComparisons: this.comparisonResults.length,
                bySeverity,
                byMatcher,
                criticalElements: [...new Set(criticalElements)]
            },
            details: this.comparisonResults
        };
    }

    public printReport(): void {
        if (!this.loggingEnabled) return;

        const endTime = performance.now();
        const durationMs = (endTime - this.startTime).toFixed(2);
        const durationSec = ((endTime - this.startTime) / 1000).toFixed(2);

        const report = this.generateReport();

        console.group(
            '%c=== COMPARISON REPORT ===',
            'color: #333; font-weight: bold; background: #fff3e0; padding: 5px;'
        );

        console.log(`⏱️ Tiempo de Comparación: %c${durationMs} ms (${durationSec} s)`, 'font-weight: bold; color: blue;');

        console.log('📊 Resumen:');
        console.log(`   Total comparaciones: ${report.summary.totalComparisons}`);
        console.log(`   Por severidad:`, report.summary.bySeverity);

        if (report.summary.criticalElements.length > 0) {
            console.log('\n🚨 Elementos CRÍTICOS:');
            report.summary.criticalElements.forEach((elem, i) => {
                console.log(`   ${i + 1}. ${elem}`);
            });
        }

        console.log('\n🔍 Matchers problemáticos:');
        Object.entries(report.summary.byMatcher)
            .sort(([, a], [, b]) => b - a)
            .forEach(([matcher, count]) => {
                console.log(`   ${matcher}: ${count} diferencias`);
            });

        console.groupEnd();
    }
}